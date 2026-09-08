import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const headers = await readFile(new URL("../_headers", import.meta.url), "utf8");

test("security policy permits automatic Cloudflare Web Analytics injection", () => {
  assert.match(
    headers,
    /script-src[^\n]*https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js/,
  );
  assert.match(headers, /connect-src[^\n]*'self'/);
  assert.doesNotMatch(headers, /no-transform/i);
});
