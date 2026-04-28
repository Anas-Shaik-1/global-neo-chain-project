import { mkdir, writeFile, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { v4 as uuid } from "uuid";

export type StorageScope = "avatar" | "resume" | "receipt" | "payslip";

export interface SavedFile {
  key: string;
  url: string;
  contentType: string;
  size: number;
}

export interface FileInput {
  originalName: string;
  mimeType: string;
  buffer: Buffer;
}

export interface FileStorage {
  save(scope: StorageScope, userId: string, file: FileInput): Promise<SavedFile>;
  delete(key: string): Promise<void>;
}

const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

const ALLOWED_BY_SCOPE: Record<StorageScope, string[]> = {
  avatar: ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"],
  resume: ["application/pdf"],
  receipt: ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"],
  payslip: ["application/pdf"],
};

class LocalStorage implements FileStorage {
  constructor(private rootDir: string, private publicBaseUrl: string) {}

  async save(scope: StorageScope, userId: string, file: FileInput): Promise<SavedFile> {
    if (!ALLOWED_BY_SCOPE[scope].includes(file.mimeType)) {
      throw new Error(`unsupported mimeType ${file.mimeType} for scope ${scope}`);
    }
    const ext = MIME_EXTENSIONS[file.mimeType];
    if (!ext) throw new Error(`unsupported mimeType ${file.mimeType}`);
    const key = `${scope}/${userId}-${uuid()}.${ext}`;
    const fullPath = join(this.rootDir, key);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, file.buffer);
    return {
      key,
      url: `${this.publicBaseUrl}/files/${key}`,
      contentType: file.mimeType,
      size: file.buffer.length,
    };
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(join(this.rootDir, key));
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw err;
    }
  }
}

export function createFileStorage(): FileStorage {
  const root = resolve(process.env.UPLOADS_DIR ?? "uploads");
  const base = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
  return new LocalStorage(root, base);
}
