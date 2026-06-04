import { cpSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, '..', 'src', 'assets');
const dest = join(__dirname, '..', 'dist', 'assets');

cpSync(src, dest, { recursive: true });
