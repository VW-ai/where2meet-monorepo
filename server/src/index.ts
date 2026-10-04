import "dotenv/config";
import { makeApp } from "./app.js";
import { loadConfig } from "./runtime/config.js";

async function start(): Promise<void> {
  const config = loadConfig();
  const app = await makeApp(config);
  const shutdown = () => {
    void app.close().catch(() => {
      process.exitCode = 1;
    });
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  try {
    await app.listen({ host: config.host, port: config.port });
  } catch {
    app.log.error("Server failed to start");
    await app.close();
    process.exitCode = 1;
  }
}

void start().catch(() => {
  process.stderr.write("Server configuration or startup failed\n");
  process.exitCode = 1;
});
