import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const headers = await readFile(new URL("../_headers", import.meta.url), "utf8");
const homepage = await readFile(new URL("../index.html", import.meta.url), "utf8");
const mainScript = await readFile(new URL("../js/main.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");

test("security policy permits automatic Cloudflare Web Analytics injection", () => {
  assert.match(
    headers,
    /script-src[^\n]*https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js/,
  );
  assert.match(
    headers,
    /script-src[^\n]*https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js\//,
  );
  assert.match(headers, /connect-src[^\n]*'self'/);
  assert.doesNotMatch(headers, /no-transform/i);
});

test("deployed HTML does not expose a harvestable contact address", () => {
  assert.match(homepage, /id="reveal-email"/);
  assert.match(homepage, /class="footer-contact-action"/);
  assert.match(homepage, /Protected from automated scraping\./);
  assert.doesNotMatch(homepage, /mailto:/i);
  assert.doesNotMatch(homepage, /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i);
});

test("export dialog locks background scrolling until it closes", () => {
  assert.match(mainScript, /showModal\(\);\s*document\.documentElement\.classList\.add\("has-open-dialog"\)/);
  assert.match(mainScript, /addEventListener\("close",[\s\S]*?classList\.remove\("has-open-dialog"\)/);
  assert.match(styles, /html\.has-open-dialog,\s*html\.has-open-dialog body\s*{[^}]*overflow:\s*hidden/s);
  assert.match(styles, /\.export-dialog\s*{[^}]*overscroll-behavior:\s*contain/s);
});
