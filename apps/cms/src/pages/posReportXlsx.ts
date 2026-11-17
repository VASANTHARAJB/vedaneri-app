// Builds the Point of Sale report as ONE Excel workbook: Summary, Sales, Purchases and Stock sheets, each with the shop's name and
// address on top, colours, dates as DD/MM/YYYY and times in 12 hour form. Used by PosReports.tsx ("Download report").
// This file has no screen code, so it can be tested on its own.

export type Rep = {
  summary: { bills: number; subtotal: number; discount: number; gst: number; total: number; cost: number; profit: number; purchases: number; purchaseBills: number };
  byDay: { d: string; bills: number; total: number }[];
  byMode: { mode: string; bills: number; total: number }[];
  byItem: { name: string; unit: string; qty: number; amount: number; profit: number }[];
  byCategory: { category: string; qty: number; amount: number }[];
};

export type ReportInput = {
  org: { name: string; address: string[] };
  from: string;                 // YYYY-MM-DD, or '' for "from the start"
  to: string;                   // YYYY-MM-DD, or '' for "up to today"
  generatedAt: Date;
  generatedBy: string;
  rep: Rep;
  salesCsv: string;             // the text of /pos/export?type=sales
  purchasesCsv: string;         // the text of /pos/export?type=purchases
  stockCsv: string;             // the text of /pos/export?type=stock
  modeLabel: Record<string, string>;
};

// ---------- small helpers ----------
const MAROON = 'FF7A1C1C', AMBER = 'FFFBBF24', CREAM = 'FFFFF8EC', ZEBRA = 'FFFFFAF4', LINE = 'FFF0E2C8', INK = 'FF3B0D0D', SOFT = 'FFFDE7B0', RED = 'FFB91C1C', GREEN = 'FF15803D';
const MONEY = '"₹" #,##0.00';
const DATE = 'dd/mm/yyyy';
const DATETIME = 'dd/mm/yyyy hh:mm AM/PM';
const QTY = '#,##0.###';

const pad = (n: number) => String(n).padStart(2, '0');
export const dmy = (d: string) => (/^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : d);
// 12 hour clock text, for the lines of text on the sheets
export const stamp12 = (d: Date) => {
  const h = d.getHours(), ap = h >= 12 ? 'PM' : 'AM', h12 = h % 12 === 0 ? 12 : h % 12;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(h12)}:${pad(d.getMinutes())} ${ap}`;
};
// A date written as 2026-11-17 or 2026-11-17T13:42:05 becomes a real Excel date (read as written, no time zone shift)
const toDate = (s: string): Date | string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(s || '');
  if (!m) return s || '';
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)));
};
const num = (s: string): number | string => (s === '' || s == null || !Number.isFinite(Number(s)) ? (s || '') : Number(s));

// The server writes CSV with quotes, and puts an apostrophe before a value that starts with = + - or @ (a phone number such as +91...)
export function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.length > 1 || (r[0] || '') !== '').map((r) => r.map((v) => (/^'[=+\-@]/.test(v) ? v.slice(1) : v)));
}

export async function buildReportXlsx(inp: ReportInput): Promise<ArrayBuffer> {
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

  // The top of every sheet: shop name, address, report title, period and print time. Returns the next free row.
  function banner(ws: any, cols: number, title: string, note?: string, periodText?: string): number {
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
    bar(inp.org.name, { size: 20, bold: true, fill: MAROON, color: 'FFFFFFFF', height: 34 });
    for (const line of inp.org.address.filter(Boolean)) bar(line, { size: 11, fill: MAROON, color: SOFT, height: 18 });
    bar(title, { size: 15, bold: true, fill: AMBER, color: INK, height: 26 });
    bar(periodText || period, { size: 11, bold: true, fill: CREAM, color: INK, height: 20 });
    bar(note ? `${printed}   |   ${note}` : printed, { size: 10, fill: CREAM, color: 'FF6B4A3A', height: 18 });
    return r + 1; // one empty row
  }

  function setup(ws: any, cols: number, headerRow: number) {
    ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 } };
    ws.headerFooter = { oddFooter: `&L${inp.org.name}&CPage &P of &N` };
    ws.views = [{ state: 'frozen', ySplit: headerRow, showGridLines: false }];
    ws.getRow(headerRow).height = 22;
    void cols;
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

  // =============== Summary ===============
  {
    const ws = wb.addWorksheet('Summary', { properties: { tabColor: { argb: MAROON } } });
    const cols = 5;
    ws.columns = [{ width: 36 }, { width: 14 }, { width: 18 }, { width: 18 }, { width: 18 }];
    let r = banner(ws, cols, 'SALE REPORT');
    const s = inp.rep.summary;
    ws.views = [{ showGridLines: false }];

    sectionBar(ws, r++, cols, 'Key figures');
    const figures: [string, number, string][] = [
      ['Bills made', s.bills, '#,##0'], ['Sub total', s.subtotal, MONEY], ['Discount given', s.discount, MONEY], ['Total sales', s.total, MONEY],
      ['GST inside the sales', s.gst, MONEY], ['Cost of goods sold', s.cost, MONEY], ['Profit (sales - GST - cost)', s.profit, MONEY],
      [`Bought from suppliers (${s.purchaseBills} purchase${s.purchaseBills === 1 ? '' : 's'})`, s.purchases, MONEY],
    ];
    figures.forEach(([label, value, fmt], i) => {
      const strong = label.startsWith('Total sales') || label.startsWith('Profit');
      bodyCell(ws.getCell(r, 1), i, { bold: strong });
      ws.getCell(r, 1).value = label;
      ws.mergeCells(r, 2, r, 3);
      bodyCell(ws.getCell(r, 2), i, { fmt, right: true, bold: strong, color: label.startsWith('Profit') && value < 0 ? RED : label.startsWith('Profit') ? GREEN : INK });
      ws.getCell(r, 3).border = box;
      ws.getCell(r, 2).value = value;
      r++;
    });
    r++;

    sectionBar(ws, r++, cols, 'By payment mode');
    headRow(ws, r++, ['Mode', 'Bills', 'Amount'], [2, 3]);
    inp.rep.byMode.forEach((m, i) => {
      bodyCell(ws.getCell(r, 1), i, {}); ws.getCell(r, 1).value = inp.modeLabel[m.mode] || m.mode;
      bodyCell(ws.getCell(r, 2), i, { fmt: '#,##0', right: true }); ws.getCell(r, 2).value = m.bills;
      bodyCell(ws.getCell(r, 3), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 3).value = m.total;
      r++;
    });
    if (!inp.rep.byMode.length) { ws.getCell(r, 1).value = 'No sales in this period.'; ws.getCell(r, 1).font = { italic: true, color: { argb: 'FF6B7280' } }; r++; }
    r++;

    sectionBar(ws, r++, cols, 'By category');
    headRow(ws, r++, ['Category', 'Quantity', 'Amount'], [2, 3]);
    inp.rep.byCategory.forEach((c, i) => {
      bodyCell(ws.getCell(r, 1), i, {}); ws.getCell(r, 1).value = c.category;
      bodyCell(ws.getCell(r, 2), i, { fmt: QTY, right: true }); ws.getCell(r, 2).value = c.qty;
      bodyCell(ws.getCell(r, 3), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 3).value = c.amount;
      r++;
    });
    if (!inp.rep.byCategory.length) { ws.getCell(r, 1).value = 'No sales in this period.'; ws.getCell(r, 1).font = { italic: true, color: { argb: 'FF6B7280' } }; r++; }
    r++;

    sectionBar(ws, r++, cols, 'Sales by day');
    headRow(ws, r++, ['Date', 'Bills', 'Amount'], [2, 3]);
    inp.rep.byDay.forEach((d, i) => {
      bodyCell(ws.getCell(r, 1), i, { fmt: DATE, right: false }); ws.getCell(r, 1).value = toDate(d.d);
      bodyCell(ws.getCell(r, 2), i, { fmt: '#,##0', right: true }); ws.getCell(r, 2).value = d.bills;
      bodyCell(ws.getCell(r, 3), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 3).value = d.total;
      r++;
    });
    if (!inp.rep.byDay.length) { ws.getCell(r, 1).value = 'No sales in this period.'; ws.getCell(r, 1).font = { italic: true, color: { argb: 'FF6B7280' } }; r++; }
    r++;

    sectionBar(ws, r++, cols, `Items sold${inp.rep.byItem.length >= 100 ? ' (top 100)' : ''}`);
    headRow(ws, r++, ['Item', 'Quantity', 'Unit', 'Sales', 'Profit (before GST)'], [2, 4, 5]);
    inp.rep.byItem.forEach((it, i) => {
      bodyCell(ws.getCell(r, 1), i, {}); ws.getCell(r, 1).value = it.name;
      bodyCell(ws.getCell(r, 2), i, { fmt: QTY, right: true }); ws.getCell(r, 2).value = it.qty;
      bodyCell(ws.getCell(r, 3), i, {}); ws.getCell(r, 3).value = it.unit;
      bodyCell(ws.getCell(r, 4), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 4).value = it.amount;
      bodyCell(ws.getCell(r, 5), i, { fmt: MONEY, right: true, color: it.profit < 0 ? RED : INK }); ws.getCell(r, 5).value = it.profit;
      r++;
    });
    if (!inp.rep.byItem.length) { ws.getCell(r, 1).value = 'No sales in this period.'; ws.getCell(r, 1).font = { italic: true, color: { argb: 'FF6B7280' } }; r++; }
    ws.pageSetup = { orientation: 'portrait', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 } };
    ws.headerFooter = { oddFooter: `&L${inp.org.name}&CPage &P of &N` };
  }

  // =============== Sales (one row per bill) ===============
  {
    const rows = parseCsv(inp.salesCsv).slice(1);
    const heads = ['Bill no', 'Date and time', 'Customer', 'Mobile', 'Sub total', 'Discount', 'GST included', 'Total', 'Payment', 'Reference', 'Status', 'Cancel reason', 'Billed by'];
    const cols = heads.length;
    const ws = wb.addWorksheet('Sales', { properties: { tabColor: { argb: 'FFEA580C' } } });
    ws.columns = [14, 22, 24, 15, 14, 12, 14, 14, 12, 18, 12, 24, 20].map((width) => ({ width }));
    const head = banner(ws, cols, 'SALES - EVERY BILL', 'Cancelled bills are shown in red and are not counted in the total');
    headRow(ws, head, heads, [5, 6, 7, 8]);
    setup(ws, cols, head);
    let sums = [0, 0, 0, 0];
    rows.forEach((x, i) => {
      const r = head + 1 + i, cancelled = (x[10] || '') === 'CANCELLED';
      const color = cancelled ? RED : INK, fill = cancelled ? 'FFFEF2F2' : undefined;
      const set = (c: number, v: any, o: any = {}) => { bodyCell(ws.getCell(r, c), i, { color, fill, ...o }); ws.getCell(r, c).value = v; };
      set(1, x[0], { bold: true }); set(2, toDate(x[1]), { fmt: DATETIME }); set(3, x[2]); set(4, x[3]);
      set(5, num(x[4]), { fmt: MONEY, right: true }); set(6, num(x[5]), { fmt: MONEY, right: true }); set(7, num(x[6]), { fmt: MONEY, right: true }); set(8, num(x[7]), { fmt: MONEY, right: true, bold: true });
      set(9, inp.modeLabel[x[8]] || x[8]); set(10, x[9]); set(11, cancelled ? 'Cancelled' : 'Done'); set(12, x[11]); set(13, x[12]);
      if (!cancelled) sums = sums.map((t, k) => t + (Number(x[4 + k]) || 0));
    });
    const last = head + rows.length, tr = last + 1;
    ws.getCell(tr, 1).value = rows.length ? 'TOTAL (bills not cancelled)' : 'No sales in this period.';
    for (let c = 1; c <= cols; c++) { const cell = ws.getCell(tr, c); cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SOFT } }; cell.font = { bold: true, color: { argb: INK } }; cell.border = box; }
    if (rows.length) {
      ['E', 'F', 'G', 'H'].forEach((col, k) => {
        const cell = ws.getCell(`${col}${tr}`);
        cell.value = { formula: `SUMIFS(${col}${head + 1}:${col}${last},K${head + 1}:K${last},"Done")`, result: Math.round(sums[k] * 100) / 100 };
        cell.numFmt = MONEY; cell.alignment = { horizontal: 'right' };
      });
      ws.autoFilter = { from: { row: head, column: 1 }, to: { row: last, column: cols } };
    }
  }

  // =============== Purchases ===============
  {
    const rows = parseCsv(inp.purchasesCsv).slice(1);
    const heads = ['Purchase no', 'Date', 'Supplier', 'Supplier bill', 'Total', 'Status', 'Entered by'];
    const cols = heads.length;
    const ws = wb.addWorksheet('Purchases', { properties: { tabColor: { argb: 'FF0F766E' } } });
    ws.columns = [16, 14, 28, 16, 16, 14, 20].map((width) => ({ width }));
    const head = banner(ws, cols, 'PURCHASES - STOCK BOUGHT FROM SUPPLIERS', 'Cancelled purchases are shown in red and are not counted in the total');
    headRow(ws, head, heads, [5]);
    setup(ws, cols, head);
    let sum = 0;
    rows.forEach((x, i) => {
      const r = head + 1 + i, cancelled = (x[5] || '') === 'CANCELLED';
      const color = cancelled ? RED : INK, fill = cancelled ? 'FFFEF2F2' : undefined;
      const set = (c: number, v: any, o: any = {}) => { bodyCell(ws.getCell(r, c), i, { color, fill, ...o }); ws.getCell(r, c).value = v; };
      set(1, x[0], { bold: true }); set(2, toDate(x[1]), { fmt: DATE }); set(3, x[2]); set(4, x[3]); set(5, num(x[4]), { fmt: MONEY, right: true, bold: true });
      set(6, cancelled ? 'Cancelled' : 'Done'); set(7, x[6]);
      if (!cancelled) sum += Number(x[4]) || 0;
    });
    const last = head + rows.length, tr = last + 1;
    ws.getCell(tr, 1).value = rows.length ? 'TOTAL (purchases not cancelled)' : 'No purchases in this period.';
    for (let c = 1; c <= cols; c++) { const cell = ws.getCell(tr, c); cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SOFT } }; cell.font = { bold: true, color: { argb: INK } }; cell.border = box; }
    if (rows.length) {
      const cell = ws.getCell(`E${tr}`);
      cell.value = { formula: `SUMIFS(E${head + 1}:E${last},F${head + 1}:F${last},"Done")`, result: Math.round(sum * 100) / 100 };
      cell.numFmt = MONEY; cell.alignment = { horizontal: 'right' };
      ws.autoFilter = { from: { row: head, column: 1 }, to: { row: last, column: cols } };
    }
  }

  // =============== Stock (as it is now) ===============
  {
    const rows = parseCsv(inp.stockCsv).slice(1);
    const heads = ['Code', 'Barcode', 'Item', 'Category', 'Unit', 'Price', 'Cost', 'GST %', 'Stock', 'Low stock alert', 'Stock value (cost)', 'For sale'];
    const cols = heads.length;
    const ws = wb.addWorksheet('Stock', { properties: { tabColor: { argb: 'FFF59E0B' } } });
    ws.columns = [14, 16, 30, 18, 9, 12, 12, 9, 11, 14, 18, 10].map((width) => ({ width }));
    const head = banner(ws, cols, 'STOCK - WHAT IS ON THE SHELF', 'Rows in amber are at or below the low stock alert', `Stock as on ${stamp12(inp.generatedAt)}`);
    headRow(ws, head, heads, [6, 7, 8, 9, 10, 11]);
    setup(ws, cols, head);
    let value = 0;
    rows.forEach((x, i) => {
      const r = head + 1 + i;
      const stock = x[8] === '' ? null : Number(x[8]), alert = Number(x[9]) || 0;
      const low = stock !== null && stock <= alert;
      const fill = low ? 'FFFEF3C7' : undefined;
      const set = (c: number, v: any, o: any = {}) => { bodyCell(ws.getCell(r, c), i, { fill, ...o }); ws.getCell(r, c).value = v; };
      set(1, x[0], { bold: true }); set(2, x[1]); set(3, x[2]); set(4, x[3]); set(5, x[4]);
      set(6, num(x[5]), { fmt: MONEY, right: true }); set(7, num(x[6]), { fmt: MONEY, right: true }); set(8, num(x[7]), { fmt: '0.##', right: true });
      set(9, stock === null ? 'not counted' : stock, { fmt: QTY, right: true, bold: true, color: stock !== null && stock <= 0 ? RED : INK });
      set(10, stock === null ? '' : alert, { fmt: QTY, right: true });
      set(11, num(x[10]), { fmt: MONEY, right: true }); set(12, x[11]);
      value += Number(x[10]) || 0;
    });
    const last = head + rows.length, tr = last + 1;
    ws.getCell(tr, 1).value = rows.length ? 'TOTAL STOCK VALUE (at cost)' : 'No items.';
    for (let c = 1; c <= cols; c++) { const cell = ws.getCell(tr, c); cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SOFT } }; cell.font = { bold: true, color: { argb: INK } }; cell.border = box; }
    if (rows.length) {
      const cell = ws.getCell(`K${tr}`);
      cell.value = { formula: `SUM(K${head + 1}:K${last})`, result: Math.round(value * 100) / 100 };
      cell.numFmt = MONEY; cell.alignment = { horizontal: 'right' };
      ws.autoFilter = { from: { row: head, column: 1 }, to: { row: last, column: cols } };
    }
  }

  // Copy into a plain ArrayBuffer so the browser's Blob accepts it with every TypeScript version
  const out: any = await wb.xlsx.writeBuffer();
  const copy = new ArrayBuffer(out.byteLength);
  new Uint8Array(copy).set(new Uint8Array(out.buffer ? out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) : out));
  return copy;
}