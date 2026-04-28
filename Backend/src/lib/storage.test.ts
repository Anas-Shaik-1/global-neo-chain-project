import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

beforeAll(() => {
  Object.assign(process.env, {
    PORT: "3000",
    MONGO_URI: "mongodb://localhost/test",
    FRONTEND_ORIGIN: "http://localhost:5173",
    JWT_ACCESS_SECRET: "x".repeat(32),
    JWT_REFRESH_SECRET: "y".repeat(32),
    JWT_ACCESS_TTL: "15m",
    JWT_REFRESH_TTL: "7d",
    SEED_ADMIN_EMAIL: "a@b.com",
    SEED_ADMIN_PASSWORD: "Password-1!",
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
  });
});

let tmpRoot = "";
beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "ems-storage-"));
  process.env.UPLOADS_DIR = tmpRoot;
  process.env.PUBLIC_BASE_URL = "http://test";
});
afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe("LocalStorage", () => {
  it("save writes a file under <scope>/<userId>-<uuid>.<ext> and returns key+url", async () => {
    const { createFileStorage } = await import("./storage.js");
    const s = createFileStorage();
    const result = await s.save("avatar", "u1", {
      originalName: "me.png",
      mimeType: "image/png",
      buffer: Buffer.from("PNGDATA"),
    });
    expect(result.key).toMatch(/^avatar\/u1-[0-9a-f-]+\.png$/);
    expect(result.url).toBe(`http://test/files/${result.key}`);
    expect(existsSync(join(tmpRoot, result.key))).toBe(true);
    expect(readFileSync(join(tmpRoot, result.key)).toString()).toBe("PNGDATA");
  });

  it("save rejects unsupported mimeType", async () => {
    const { createFileStorage } = await import("./storage.js");
    const s = createFileStorage();
    await expect(
      s.save("avatar", "u1", {
        originalName: "x.tiff",
        mimeType: "image/tiff",
        buffer: Buffer.from("X"),
      }),
    ).rejects.toThrow(/unsupported/i);
  });

  it("delete removes the file", async () => {
    const { createFileStorage } = await import("./storage.js");
    const s = createFileStorage();
    const r = await s.save("resume", "u1", {
      originalName: "cv.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("PDF"),
    });
    expect(existsSync(join(tmpRoot, r.key))).toBe(true);
    await s.delete(r.key);
    expect(existsSync(join(tmpRoot, r.key))).toBe(false);
  });

  it("delete on missing key is a no-op", async () => {
    const { createFileStorage } = await import("./storage.js");
    const s = createFileStorage();
    await expect(s.delete("avatar/nope.png")).resolves.toBeUndefined();
  });
});
