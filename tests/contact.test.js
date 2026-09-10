import assert from "node:assert/strict";
import test from "node:test";

import { decodeContactAddress } from "../js/contact.js";

test("contact address is reconstructed only in the browser", () => {
  const address = decodeContactAddress();
  assert.equal(address.split("@").length, 2);
  assert.ok(address.startsWith("contact"));
  assert.ok(address.endsWith(".tv"));
});
