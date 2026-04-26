import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import "../modules/auth/auth.schema.js";
import "../modules/health/health.routes.js";
import { buildOpenApiDocument } from "./spec.js";

const out = resolve(process.cwd(), "openapi.json");
writeFileSync(out, JSON.stringify(buildOpenApiDocument(), null, 2));
console.log(`wrote ${out}`);
