import assert from "node:assert/strict";
import test from "node:test";

import { loadProfiles } from "../js/profiles.js";

function withStoredProfiles(value, callback) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => value } });
  try {
    return callback();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete globalThis.localStorage;
  }
}

test("saved profiles load only as named objects", () => {
  for (const stored of ["null", "[]", "42", "\"text\"", "{not json"]) {
    assert.deepEqual(withStoredProfiles(stored, loadProfiles), {}, stored);
  }
  const stored = JSON.stringify({ Mine: { titleFormat: "name" }, Broken: null, List: [], Text: "x" });
  assert.deepEqual(withStoredProfiles(stored, loadProfiles), { Mine: { titleFormat: "name" } });
});
