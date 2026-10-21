import { loadConfig } from "./config.js";
import { buildServer } from "./server.js";

const config = loadConfig();
const server = buildServer(config);

try {
  await server.listen({ host: config.API_HOST, port: config.API_PORT });
} catch {
  server.log.error("API failed to start; verify configuration and server availability");
  process.exitCode = 1;
}
