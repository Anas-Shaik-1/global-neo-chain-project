/**
 * Minimal RFC-4180-ish CSV codec — no library dependency.
 *
 * Handles:
 *   • commas inside quoted fields
 *   • embedded newlines inside quoted fields
 *   • escaped quotes (`""`) inside quoted fields
 *   • CRLF and LF line endings
 *
 * Doesn't try to be smart about Excel locale quirks like semicolon
 * separators — exports/imports both speak comma. Excel imports comma-CSV
 * fine via "Data → Text to Columns" or by saving as `.csv`.
 */

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  // Strip BOM if present (Excel exports UTF-8 with BOM by default).
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1; // skip the escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\r") {
      // ignore — CRLF handled by the next \n
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  // Flush the last cell / row if the file didn't end with a newline.
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  // Drop a trailing empty row (common when files end with "\n").
  while (rows.length > 0) {
    const last = rows[rows.length - 1]!;
    if (last.length === 1 && last[0] === "") rows.pop();
    else break;
  }
  return rows;
}

export function toCSV(rows: (string | number)[][]): string {
  return rows
    .map((row) =>
      row
        .map((v) => {
          const s = String(v ?? "");
          if (/[",\n\r]/.test(s)) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        })
        .join(","),
    )
    .join("\n");
}

/**
 * Trigger a browser download for an in-memory CSV string. Prepends the
 * UTF-8 BOM so Excel renders non-ASCII characters correctly when the user
 * double-clicks the file.
 */
export function downloadCSV(filename: string, content: string): void {
  const blob = new Blob(["﻿", content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
