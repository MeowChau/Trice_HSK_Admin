import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { LatestRequest } from "../src/lib/latest-request.ts";
import { errorMessage } from "../src/lib/error-message.ts";
import { apiFetch, saveSession, getToken } from "../src/lib/api.ts";

const originalFetch = globalThis.fetch;
beforeEach(() => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  globalThis.document = { cookie: "" };
  globalThis.window = { location: { pathname: "/exams", href: "" } };
  saveSession({ token: "old", refreshToken: "refresh" });
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  delete globalThis.localStorage;
  delete globalThis.document;
  delete globalThis.window;
});
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

test("new filters cancel the old request and late JSON decoding cannot overwrite the new result", () => {
  const requests = new LatestRequest();
  const old = requests.start(),
    current = requests.start();
  assert.equal(old.signal.aborted, true);
  assert.equal(old.isCurrent(), false);
  assert.equal(current.isCurrent(), true);
  requests.cancel();
  assert.equal(current.signal.aborted, true);
  assert.equal(current.isCurrent(), false);
});
test("unknown thrown values produce a useful error without unsafe property access", () => {
  assert.equal(errorMessage(new Error("Network failed")), "Network failed");
  assert.equal(errorMessage({ message: "Server error" }), "Server error");
  assert.equal(errorMessage(null, "Fallback"), "Fallback");
  assert.equal(errorMessage("unstructured", "Fallback"), "Fallback");
});
test("simultaneous 401s share a refresh and retain the body and content type on replay", async () => {
  let refreshes = 0;
  const refresh = deferred(),
    started = deferred();
  const bodies = [];
  globalThis.fetch = async (url, init) => {
    if (url.endsWith("/auth/refresh")) {
      refreshes++;
      started.resolve();
      return refresh.promise;
    }
    if (init.headers.get("Authorization") === "Bearer old")
      return json({}, 401);
    bodies.push(init.body);
    assert.equal(init.headers.get("Content-Type"), "application/json");
    return json({ ok: true });
  };
  const first = apiFetch("one", { method: "POST", body: '{"answer":"A"}' });
  const second = apiFetch("two", { method: "POST", body: '{"answer":"B"}' });
  await started.promise;
  refresh.resolve(json({ token: "fresh", refreshToken: "renewed" }));
  const results = await Promise.all([first, second]);
  assert.equal(refreshes, 1);
  assert.ok(results.every((result) => result.ok));
  assert.deepEqual(bodies.sort(), ['{"answer":"A"}', '{"answer":"B"}']);
});
test("a late 401 reuses the already refreshed token without a second session rotation", async () => {
  let refreshes = 0;
  const slow = deferred();
  globalThis.fetch = async (url, init) => {
    if (url.endsWith("/auth/refresh")) {
      refreshes++;
      return json({ token: "fresh" });
    }
    if (init.headers.get("Authorization") === "Bearer fresh")
      return json({ ok: true });
    if (url.endsWith("/slow")) return slow.promise;
    return json({}, 401);
  };
  const delayed = apiFetch("slow");
  assert.ok((await apiFetch("fast")).ok);
  slow.resolve(json({}, 401));
  assert.ok((await delayed).ok);
  assert.equal(refreshes, 1);
});
test("an aborted request never starts a token refresh or logs out the active session", async () => {
  const controller = new AbortController();
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    controller.abort();
    return json({}, 401);
  };
  await assert.rejects(
    apiFetch("cancelled", { signal: controller.signal }),
    (error) => error.name === "AbortError",
  );
  assert.equal(calls, 1);
  assert.equal(getToken(), "old");
  assert.equal(window.location.href, "");
});
test("a failed refresh clears the expired session and returns to sign-in", async () => {
  globalThis.fetch = async () => json({}, 401);
  assert.equal((await apiFetch("expired")).status, 401);
  assert.ok(!getToken());
  assert.equal(window.location.href, "/signin");
});
