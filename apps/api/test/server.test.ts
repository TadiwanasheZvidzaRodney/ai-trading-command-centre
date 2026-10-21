import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.js";
import { buildServer } from "../src/server.js";

test("health reports liveness without implying database readiness", async (t) => {
  const server = buildServer(loadConfig({ NODE_ENV: "test" }));
  t.after(() => server.close());

  const response = await server.inject({ method: "GET", url: "/health" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok", service: "api" });
});

test("readiness fails closed when MongoDB is not configured", async (t) => {
  const server = buildServer(loadConfig({ NODE_ENV: "test" }));
  t.after(() => server.close());

  const response = await server.inject({ method: "GET", url: "/ready" });

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), {
    status: "not_ready",
    checks: { database: "not_configured" },
  });
});
