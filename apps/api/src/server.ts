import Fastify from "fastify";
import { MongoClient } from "mongodb";
import type { AppConfig } from "./config.js";

export function buildServer(config: AppConfig) {
  const mongoClient = config.MONGODB_URI
    ? new MongoClient(config.MONGODB_URI, { serverSelectionTimeoutMS: 1000 })
    : undefined;

  const server = Fastify({
    logger: {
      level: config.NODE_ENV === "test" ? "silent" : "info",
      redact: {
        paths: ["req.headers.authorization", "req.headers.cookie"],
        censor: "[REDACTED]",
      },
    },
  });

  server.get("/health", async () => ({ status: "ok", service: "api" }));

  server.get("/ready", async (request, reply) => {
    if (!mongoClient) {
      return reply.code(503).send({
        status: "not_ready",
        checks: { database: "not_configured" },
      });
    }

    try {
      await mongoClient.db().command({ ping: 1 });
      return { status: "ready", checks: { database: "ok" } };
    } catch {
      request.log.warn({ dependency: "mongodb" }, "Readiness check failed");
      return reply.code(503).send({
        status: "not_ready",
        checks: { database: "unavailable" },
      });
    }
  });

  server.addHook("onClose", async () => {
    await mongoClient?.close();
  });

  return server;
}
