// Shared by the Excel reports of the Payments pages (Payments, Seva, and the ones to come): the same maroon and amber look,
// the two logos on the top band, DD/MM/YYYY dates and 12 hour times. This file has no screen code, so it can be tested on its own.
import { dmy, stamp12 } from './posReportXlsx';

export type Logo = { data: ArrayBuffer; width: number; height: number };
export type KitInput = {
  org: { name: string; address: string[] };
  from: string;                 // YYYY-MM-DD, or '' for "from the start"
  to: string;                   // YYYY-MM-DD, or '' for "up to today"
  generatedAt: Date;
  generatedBy: string;
  logos: { left: Logo | null; right: Logo | null };
};

export const MAROON = 'FF7A1C1C', AMBER = 'FFFBBF24', CREAM = 'FFFFF8EC', ZEBRA = 'FFFFFAF4', LINE = 'FFF0E2C8', INK = 'FF3B0D0D', SOFT = 'FFFDE7B0';
export const RED = 'FFB91C1C', GREEN = 'FF15803D', AMBERTXT = 'FFB45309';
export const MONEY = '"₹" #,##0.00';
export const DATE = 'dd/mm/yyyy';
export const DATETIME = 'dd/mm/yyyy hh:mm AM/PM';
export const STATUS_WORD: Record<string, string> = { PAID: 'Paid', PENDING: 'Pending', FAILED: 'Failed' };
export const STATUS_TXT: Record<string, string> = { PAID: GREEN, PENDING: AMBERTXT, FAILED: RED };

// Reads a picture from its address, and measures it (the sheet needs the size to keep the picture's shape)
export async function loadLogo(url: string): Promise<Logo | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const data = await blob.arrayBuffer();
    let width = 0, height = 0;
    try { const bmp = await createImageBitmap(blob); width = bmp.width; height = bmp.height; bmp.close(); } catch { /* size stays 0 */ }
    if (!width || !height) { width = 100; height = 100; }
    return { data, width, height };
  } catch { return null; }
}

// The server writes times in UTC ("2026-11-17 08:12:05"). The dashboard shows them in the browser's clock, so the sheet does too.
// Excel has no time zones, so the local clock time is written as it reads.
export function localCell(s: string): Date | string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(s || '');
  if (!m) return s || '';
  const utc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  return new Date(utc - new Date(utc).getTimezoneOffset() * 60000);
}
// A day written as 2026-11-17 (no clock time) becomes an Excel date
export const dayCell = (s: string): Date | string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : s || '';
};
export const num = (s: string): number | string => (s === '' || s == null || !Number.isFinite(Number(s)) ? (s || '') : Number(s));

// 1 2 3 ... 8 9 10 ... 20 : the pages to show next to the current one (used by the page buttons under the tables)
export function pageList(page: number, pages: number): (number | '...')[] {
  const keep = new Set<number>([1, pages, page - 1, page, page + 1]);
  const out: (number | '...')[] = [];
  let prev = 0;
  [...keep].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b).forEach((n) => {
    if (n - prev > 1) out.push('...');
    out.push(n); prev = n;
  });
  return out;
}

export async function newReport(inp: KitInput) {
  const mod: any = await import('exceljs');
  const ExcelJS = mod.default || mod;
  const wb = new ExcelJS.Workbook();
  wb.creator = inp.org.name; wb.created = inp.generatedAt;

  const period = inp.from || inp.to
    ? `Period: ${inp.from ? dmy(inp.from) : 'start'} to ${inp.to ? dmy(inp.to) : stamp12(inp.generatedAt).slice(0, 10)}`
    : 'Period: all dates';
  const printed = `Printed on: ${stamp12(inp.generatedAt)}${inp.generatedBy ? `   |   By: ${inp.generatedBy}` : ''}`;

  const thin = { style: 'thin', color: { argb: LINE } } as const;
  const box = { top: thin, left: thin, bottom: thin, right: thin };

  const leftId = inp.logos.left ? wb.addImage({ buffer: inp.logos.left.data, extension: 'png' }) : null;
  const rightId = inp.logos.right ? wb.addImage({ buffer: inp.logos.right.data, extension: 'png' }) : null;

  // The top of every sheet: the two logos, the name, the address, the report title, the period and the print time. Returns the next free row.
  function banner(ws: any, widths: number[], title: string, note?: string): number {
    const cols = widths.length;
    let r = 1;
    const bar = (text: string, o: { size: number; bold?: boolean; fill: string; color: string; height: number }) => {
      ws.mergeCells(r, 1, r, cols);
      const c = ws.getCell(r, 1);
      c.value = text;
      c.font = { name: 'Calibri', size: o.size, bold: !!o.bold, color: { argb: o.color } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: o.fill } };
      c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      ws.getRow(r).height = o.height;
      r++;
    };
    const topHeight = 66; // points; the logos sit in this first band
    bar(inp.org.name, { size: 20, bold: true, fill: MAROON, color: 'FFFFFFFF', height: topHeight });
    for (const line of inp.org.address.filter(Boolean)) bar(line, { size: 11, fill: MAROON, color: SOFT, height: 18 });
    bar(title, { size: 15, bold: true, fill: AMBER, color: INK, height: 26 });
    bar(period, { size: 11, bold: true, fill: CREAM, color: INK, height: 20 });
    bar(note ? `${printed}   |   ${note}` : printed, { size: 10, fill: CREAM, color: 'FF6B4A3A', height: 18 });

    const bandPx = topHeight * (96 / 72);
    const place = (logo: Logo | null, id: number | null, side: 'left' | 'right') => {
      if (!logo || id === null) return;
      const h = Math.min(58, bandPx - 8);
      let w = Math.round((logo.width / logo.height) * h);
      let hh = h;
      if (w > 170) { w = 170; hh = Math.round((logo.height / logo.width) * w); }
      const rowOff = Math.max(0, (bandPx - hh) / 2 / bandPx);
      if (side === 'left') {
        ws.addImage(id, { tl: { col: 0.04, row: rowOff }, ext: { width: w, height: hh } });
      } else {
        const last = cols - 1, lastPx = widths[last] * 7 + 5;
        const colPos = w + 10 < lastPx ? last + (lastPx - w - 8) / lastPx : last;
        ws.addImage(id, { tl: { col: colPos, row: rowOff }, ext: { width: w, height: hh } });
      }
    };
    place(inp.logos.left, leftId, 'left');
    place(inp.logos.right, rightId, 'right');
    return r + 1; // one empty row
  }

  function setup(ws: any, headerRow: number, orientation: 'portrait' | 'landscape') {
    ws.pageSetup = { orientation, paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 } };
    ws.headerFooter = { oddFooter: `&L${inp.org.name}&CPage &P of &N` };
    if (headerRow > 0) { ws.views = [{ state: 'frozen', ySplit: headerRow, showGridLines: false }]; ws.getRow(headerRow).height = 22; }
    else ws.views = [{ showGridLines: false }];
  }

  function headRow(ws: any, row: number, heads: string[], right: number[] = []) {
    heads.forEach((h, i) => {
      const c = ws.getCell(row, i + 1);
      c.value = h;
      c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MAROON } };
      c.alignment = { vertical: 'middle', horizontal: right.includes(i + 1) ? 'right' : 'left', wrapText: true };
      c.border = box;
    });
  }

  function bodyCell(c: any, i: number, o: { fmt?: string; right?: boolean; bold?: boolean; color?: string; fill?: string }) {
    c.border = box;
    c.alignment = { vertical: 'middle', horizontal: o.right ? 'right' : 'left', wrapText: true };
    if (o.fmt) c.numFmt = o.fmt;
    c.font = { size: 11, bold: !!o.bold, color: { argb: o.color || INK } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: o.fill || (i % 2 ? ZEBRA : 'FFFFFFFF') } };
  }

  function sectionBar(ws: any, row: number, cols: number, text: string) {
    ws.mergeCells(row, 1, row, cols);
    const c = ws.getCell(row, 1);
    c.value = text;
    c.font = { bold: true, size: 12, color: { argb: INK } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SOFT } };
    c.alignment = { vertical: 'middle' };
    ws.getRow(row).height = 22;
  }

  const empty = (ws: any, r: number, text: string) => { ws.getCell(r, 1).value = text; ws.getCell(r, 1).font = { italic: true, color: { argb: 'FF6B7280' } }; };

  // One line of "label | value" figures (the value is spread over two columns)
  function figures(ws: any, r: number, items: [string, number | string, string, string?][]): number {
    items.forEach(([label, value, fmt, color], i) => {
      const strong = i === 0;
      bodyCell(ws.getCell(r, 1), i, { bold: strong });
      ws.getCell(r, 1).value = label;
      ws.mergeCells(r, 2, r, 3);
      bodyCell(ws.getCell(r, 2), i, { fmt, right: true, bold: strong, color: color || INK });
      ws.getCell(r, 3).border = box;
      ws.getCell(r, 2).value = value;
      r++;
    });
    return r;
  }

  // The shaded last row of a list, with the sum of the paid amounts
  function totalRow(ws: any, row: number, cols: number, label: string) {
    ws.getCell(row, 1).value = label;
    for (let c = 1; c <= cols; c++) { const cell = ws.getCell(row, c); cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SOFT } }; cell.font = { bold: true, color: { argb: INK } }; cell.border = box; }
  }

  async function finish(): Promise<ArrayBuffer> {
    // Copy into a plain ArrayBuffer so the browser's Blob accepts it with every TypeScript version
    const out: any = await wb.xlsx.writeBuffer();
    const copy = new ArrayBuffer(out.byteLength);
    new Uint8Array(copy).set(new Uint8Array(out.buffer ? out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) : out));
    return copy;
  }

  return { wb, banner, setup, headRow, bodyCell, sectionBar, empty, figures, totalRow, finish, box };
}