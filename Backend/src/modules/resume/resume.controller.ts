import type { Request, Response, NextFunction } from "express";
import { UnauthorizedError } from "../../lib/errors.js";
import * as svc from "./resume.service.js";
import type { ResumeBodyType } from "./resume.schema.js";
import { extractPdfText, parseResumeText } from "./resume.parser.js";
import { ValidationError } from "../../lib/errors.js";

function meId(req: Request): string {
  if (!req.user) throw new UnauthorizedError();
  return req.user.id;
}

export async function getMine(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await svc.getMyResume(meId(req));
    res.json(r);
  } catch (err) {
    next(err);
  }
}

export async function putMine(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.validated as ResumeBodyType;
    const r = await svc.saveMyResume(meId(req), body);
    res.json(r);
  } catch (err) {
    next(err);
  }
}

export async function postImport(req: Request, res: Response, next: NextFunction) {
  try {
    // Auth check — even though parsing is stateless, we don't want to
    // expose a free text-parsing endpoint to the public internet.
    if (!req.user) throw new UnauthorizedError();
    const body = req.validated as { text: string };
    const parsed = parseResumeText(body.text);
    res.json(parsed);
  } catch (err) {
    next(err);
  }
}

/**
 * Accept a multipart upload of an existing resume PDF, extract text via
 * pdfjs (pdf-parse), then run the same heuristic parser the paste-text
 * path uses. We never persist the uploaded bytes — they live in the
 * multer in-memory buffer for the duration of this request only.
 */
export async function postImportPdf(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const file = req.file;
    if (!file?.buffer) {
      throw new ValidationError("No PDF file uploaded — attach a `file` field.");
    }
    const text = await extractPdfText(new Uint8Array(file.buffer));
    if (!text || text.length < 20) {
      throw new ValidationError(
        "Couldn't extract any text from that PDF. Image-only / scanned PDFs aren't supported — paste the text instead.",
      );
    }
    const parsed = parseResumeText(text);
    res.json(parsed);
  } catch (err) {
    next(err);
  }
}

export async function getMinePdf(req: Request, res: Response, next: NextFunction) {
  try {
    const buf = await svc.generateResumePdf(meId(req));
    const safeName =
      (req.user?.id ?? "resume").replace(/[^a-z0-9]/gi, "-").slice(0, 32) +
      "-resume.pdf";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    res.setHeader("Content-Length", String(buf.length));
    res.send(buf);
  } catch (err) {
    next(err);
  }
}
