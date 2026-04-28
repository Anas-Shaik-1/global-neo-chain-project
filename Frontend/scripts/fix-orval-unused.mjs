#!/usr/bin/env node
/**
 * Post-processes orval-generated files to silence TS6133 (unused parameter)
 * errors caused by orval's multipart-with-body-schema generation, which emits
 * a body parameter but never appends it to the FormData. Prefixes the unused
 * body param with `_` so TS treats it as intentionally unused.
 *
 * Pattern targeted (orval 7.x output):
 *   export const postFooBar = (
 *     id: string,
 *     postFooBarBody: PostFooBarBody,        <-- unused
 *    signal?: AbortSignal
 *   ) => {
 *     const formData = new FormData();
 *     return orvalAxios<...>({ ... data: formData, signal });
 *   }
 *
 * We rename the body param (and its single usage in `getXMutationOptions`'
 * inner `mutationFn` call) to `_<name>` ONLY when the function body never
 * references the original name (i.e. truly unused).
 */
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";

const GEN_DIR = new URL("../src/api/generated/", import.meta.url).pathname;

async function walk(dir) {
  const entries = await readdir(dir);
  const out = [];
  for (const e of entries) {
    const p = join(dir, e);
    const s = await stat(p);
    if (s.isDirectory()) out.push(...(await walk(p)));
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

function fixFile(src) {
  // Match `export const fnName = (` ... `) => {` blocks and their bodies.
  // For multipart endpoints orval inserts `const formData = new FormData();`
  // then `data: formData` without ever appending the body. Detect that.
  const fnRe =
    /export const (\w+) = \(\s*([^)]*)\)\s*=>\s*\{([\s\S]*?)\n\s{4}\}\s*\n/g;
  let changed = false;
  const out = src.replace(fnRe, (match, name, params, body) => {
    if (!body.includes("new FormData()")) return match;
    // Find body params of shape `<paramName>: <Type>` (skip id/signal/etc).
    const paramList = params
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    let mutated = false;
    const newParams = paramList.map((p) => {
      const m = p.match(/^(\w+)\s*:\s*(.+)$/s);
      if (!m) return p;
      const [, pname, ptype] = m;
      if (pname === "signal" || pname === "id" || pname.startsWith("_")) return p;
      // Heuristic: body param is the one whose type ends with "Body".
      if (!/Body\b/.test(ptype)) return p;
      // Only rewrite if the body doesn't reference the name.
      const bodyRe = new RegExp(`\\b${pname}\\b`);
      if (bodyRe.test(body)) return p;
      mutated = true;
      return `_${pname}: ${ptype}`;
    });
    if (!mutated) return match;
    changed = true;
    return match.replace(params, newParams.join(",\n    "));
  });
  return changed ? out : null;
}

const files = await walk(GEN_DIR);
let touched = 0;
for (const f of files) {
  const src = await readFile(f, "utf8");
  const fixed = fixFile(src);
  if (fixed != null) {
    await writeFile(f, fixed);
    touched++;
  }
}
console.log(`fix-orval-unused: patched ${touched} file(s)`);
