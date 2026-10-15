import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveFileUrl } from "../src/lib/media-url.ts";

test("uses the dashboard API for local uploads even while the public API DNS is pending", () => {
  for (const name of ["56433e2488aa14ac19b45.jpg", "057080df3a1666fc957e8.webp"]) {
    assert.equal(resolveFileUrl(`https://api.tricehsk.id.vn/api/v1/files/${name}`, "/api/v1"),
      `/api/v1/files/${name}`);
  }
});

test("normalizes Windows upload separators and avoids repeating the API prefix", () => {
  for (const path of ["/api/v1/files\\avatar.jpg", "api/v1/files/avatar.jpg", "files/avatar.jpg"])
    assert.equal(resolveFileUrl(path, "/api/v1/"), "/api/v1/files/avatar.jpg");
});

test("uses the configured remote API when the frontend and API have separate origins", () => {
  assert.equal(resolveFileUrl("http://localhost:3001/api/v1/files/avatar.jpg", "https://api.example.com/api/v1"),
    "https://api.example.com/api/v1/files/avatar.jpg");
});

test("keeps query strings, escaped filenames and fragments on local image URLs", () => {
  assert.equal(resolveFileUrl("https://old.example/api/v1/files/a%20b.jpg?v=2#photo", "/api/v1"),
    "/api/v1/files/a%20b.jpg?v=2#photo");
});

test("preserves external and signed cloud URLs", () => {
  for (const url of ["https://images.example.com/avatar.jpg", "//images.example.com/avatar.jpg",
    "https://bucket.s3.amazonaws.com/api/v1/files/avatar.jpg?X-Amz-Signature=test%2Fsignature"])
    assert.equal(resolveFileUrl(url, "/api/v1"), url);
});

test("rejects missing or unsupported image URL schemes", () => {
  for (const path of [undefined, null, "", " ", "javascript:alert(1)", "file:///private/avatar.jpg"])
    assert.equal(resolveFileUrl(path, "/api/v1"), null);
});

test("supports a customized API prefix and does not rewrite unrelated external paths", () => {
  assert.equal(resolveFileUrl("https://old.example/service/v2/files/a.jpg", "/service/v2"), "/service/v2/files/a.jpg");
  assert.equal(resolveFileUrl("https://images.example.com/api/v1/files/a.jpg", "/service/v2"),
    "https://images.example.com/api/v1/files/a.jpg");
});
