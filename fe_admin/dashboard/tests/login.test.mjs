import assert from "node:assert/strict";
import { test, beforeEach, afterEach } from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
import { requestLogin, redirectAfterLogin } from "../src/lib/login-request.ts";
import { getLoginErrorMessage } from "../src/lib/login-error.ts";
import { saveSession, getToken } from "../src/lib/api.ts";

const originalFetch = globalThis.fetch;
let email, password;
beforeEach(() => {
  email = `${randomUUID()}@test.invalid`;
  password = randomBytes(24).toString("base64url");
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  globalThis.document = { cookie: "" };
  globalThis.window = { location: { replace() {} } };
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  delete globalThis.localStorage;
  delete globalThis.document;
  delete globalThis.window;
});

test("successful login uses entered credentials and only trims the email", async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "/api/v1/auth/email/login");
    assert.equal(init.method, "POST");
    assert.deepEqual(JSON.parse(init.body), {
      email,
      password: ` ${password} `,
    });
    assert.ok(init.signal);
    return Response.json({ token: "new-session", refreshToken: "new-refresh" });
  };
  const result = await requestLogin("/api/v1", ` ${email} `, ` ${password} `);
  assert.equal(result.ok, true);
  assert.equal(result.data.token, "new-session");
});

test("a server that never answers is aborted with a useful timeout error", async () => {
  globalThis.fetch = (_url, init) =>
    new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(init.signal.reason));
    });
  await assert.rejects(
    requestLogin("/api/v1", email, password, 10),
    /phản hồi quá lâu/,
  );
});

test("the timeout also covers a stalled response body after HTTP 200", async () => {
  globalThis.fetch = async (_url, init) => ({
    ok: true,
    status: 200,
    json: () =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(init.signal.reason));
      }),
  });
  await assert.rejects(
    requestLogin("/api/v1", email, password, 10),
    /phản hồi quá lâu/,
  );
});

test("incorrect credentials remain an API error and never save a session", async () => {
  globalThis.fetch = async () =>
    Response.json(
      { errors: { email: "incorrectEmailOrPassword" } },
      { status: 422 },
    );
  const result = await requestLogin("/api/v1", email, password);
  assert.equal(result.ok, false);
  assert.equal(
    getLoginErrorMessage(result.status, result.data),
    "Email hoặc mật khẩu không đúng.",
  );
  assert.equal(getToken(), null);
});

test("HTML and empty proxy errors preserve the status for a server error message", async () => {
  globalThis.fetch = async () =>
    new Response("<html>proxy error</html>", { status: 502 });
  const result = await requestLogin("/api/v1", email, password);
  assert.equal(result.data, null);
  assert.match(
    getLoginErrorMessage(result.status, result.data),
    /Máy chủ đang gặp lỗi/,
  );
});

test("network failures propagate so the form can show its connection error", async () => {
  globalThis.fetch = async () => {
    throw new TypeError("Failed to fetch");
  };
  await assert.rejects(requestLogin("/api/v1", email, password), TypeError);
});

test("login saves the new cookie before a fresh dashboard document navigation", () => {
  let replaced;
  window.location.replace = (path) => {
    assert.equal(getToken(), "new-session");
    assert.match(document.cookie, /^token=new-session;/);
    replaced = path;
  };
  saveSession({ token: "new-session" });
  redirectAfterLogin();
  assert.equal(replaced, "/");
});

test("blocked cookies fail clearly and discard the partial login", () => {
  Object.defineProperty(document, "cookie", { get: () => "", set: () => {} });
  assert.throws(
    () => saveSession({ token: "new-session", refreshToken: "refresh" }),
    /cho phép cookie/,
  );
  assert.equal(getToken(), null);
  assert.equal(localStorage.getItem("refreshToken"), null);
});
