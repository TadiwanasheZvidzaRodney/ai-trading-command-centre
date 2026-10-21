import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.js";

test("uses safe local defaults", () => {
  assert.deepEqual(loadConfig({ NODE_ENV: "test" }), {
    NODE_ENV: "test",
    API_HOST: "127.0.0.1",
    API_PORT: 4000,
  });
});

test("rejects an invalid port without including environment values", () => {
  assert.throws(
    () => loadConfig({ API_PORT: "70000", MONGODB_URI: "******host/db" }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /API_PORT/);
      assert.doesNotMatch(error.message, /secret|mongodb/);
      return true;
    },
  );
});

test("only accepts MongoDB connection URI schemes", () => {
  assert.throws(() => loadConfig({ MONGODB_URI: "https://example.invalid" }), /MONGODB_URI/);
});
