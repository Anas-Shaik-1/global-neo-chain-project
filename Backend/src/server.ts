import { createServer } from "node:http";
import { createApp } from "./app.js";
import { connectDb } from "./db/index.js";
import { config } from "./config/index.js";
import { logger } from "./lib/logger.js";
import { attachSocketServer } from "./realtime/index.js";

async function main() {
  await connectDb();
  const app = createApp();
  const http = createServer(app);
  attachSocketServer(http);
  http.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, `EMS backend listening`);
    logger.info(`Swagger: http://localhost:${config.PORT}/docs`);
  });
}

main().catch((err) => {
  logger.fatal({ err }, "failed to start");
  process.exit(1);
});
