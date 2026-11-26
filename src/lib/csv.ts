/** CSV for Excel / Google Sheets: UTF-8 with BOM (₹ and Malayalam text open correctly), CRLF rows, quoted when needed. */
const cell = (v: unknown): string => {
  let t = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; // a customer-typed "=HYPERLINK(...)" must not run as a spreadsheet formula
  return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
export const toCsv = (header: string[], rows: unknown[][]): string => "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";

export const csvResponse = (body: string, name: string) =>
  new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
