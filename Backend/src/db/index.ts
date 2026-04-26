import mongoose from "mongoose";
import { config } from "../config/index.js";
import { logger } from "../lib/logger.js";

export async function connectDb(uri: string = config.MONGO_URI): Promise<void> {
  await mongoose.connect(uri);
  logger.info({ host: mongoose.connection.host }, "mongo connected");
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
