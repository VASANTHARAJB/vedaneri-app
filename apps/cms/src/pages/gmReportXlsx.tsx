// Builds the General Manager's report as ONE Excel workbook. Which sheets it has depends on what was asked for:
// Summary, Transactions, Registrations, POS Sales / POS Items / POS Purchases, Devotees.
// Every sheet has the organisation's name and address on top, dates as DD/MM/YYYY and times in 12 hour form.
// This file has no screen code. GmDashboard.tsx fetches /dashboards/gm/report and passes the result here.

export type Row = Record<string, any>;
export type GmReport = {
  generated_at: string;
  from: string;
  to: string;
  parts: string[];
  truncated: string[];
  kinds?: { kind: string; entries: number; amount: number; offline_entries: number; offline_amount: number; pending: number; failed: number; cancelled: number; modes: { mode: string; n: number; amount: number }[] }[];
  pos?: { available: boolean; summary: Row | null; sales: Row[]; items: Row[]; purchases: Row[] };
  devotee_count?: number;
  transactions?: Row[];
  registrations?: Row[];
  devotees?: Row[];
};

const MAROON = 'FF7A1C1C', AMBER = 'FFFBBF24', CREAM = 'FFFFF8EC', ZEBRA = 'FFFFFAF4', LINE = 'FFF0E2C8', INK = 'FF3B0D0D', SOFT = 'FFFDE7B0', RED = 'FFB91C1C', GREEN = 'FF15803D';
const MONEY = '"₹" #,##0.00';
const DATE = 'dd/mm/yyyy';
const DATETIME = 'dd/mm/yyyy hh:mm AM/PM';
const QTY = '#,##0.###';

const KIND: Record<string, string> = { seva: 'Seva', donation: 'Donation', magazine: 'Magazine', camp: 'Camp' };
const STATUS: Record<string, string> = { PAID: 'Paid', FREE: 'Free', PENDING: 'Waiting for payment', FAILED: 'Failed', CANCELLED: 'Cancelled', ACTIVE: 'Active' };
const MODE: Record<string, string> = { cash: 'Cash', upi: 'UPI', card: 'Card', online: 'Online', cheque: 'Cheque', dd: 'Demand draft', neft: 'Bank transfer', other: 'Other' };
const modeText = (m: string) => MODE[m] || (m ? m.charAt(0).toUpperCase() + m.slice(1) : '');

const pad = (n: number) => String(n).padStart(2, '0');
export const dmy = (d: string) => (/^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : d);
const stamp12 = (d: Date) => {
  const h = d.getHours(), ap = h >= 12 ? 'PM' : 'AM', h12 = h % 12 === 0 ? 12 : h % 12;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(h12)}:${pad(d.getMinutes())} ${ap}`;
};
// 2026-11-17 or 2026-11-17 13:42:05 becomes a real Excel date (read as written, no time zone shift); anything else stays text
const toDate = (s: unknown): Date | string => {
  const t = String(s ?? '');
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(t);
  if (!m) return t;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)));
};
const hasTime = (s: unknown) => /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(String(s ?? ''));

type Col = { h: string; w: number; get: (r: Row, i: number) => any; fmt?: string; right?: boolean; center?: boolean };

export async function buildGmReport(rep: GmReport, org: { name: string; address: string[] }, generatedBy: string): Promise<ArrayBuffer> {
  const mod: any = await import('exceljs');
  const ExcelJS = mod.default || mod;
  const wb = new ExcelJS.Workbook();
  const now = new Date(rep.generated_at);
  wb.creator = org.name; wb.created = now;

  const period = `Period: ${dmy(rep.from)} to ${dmy(rep.to)}`;
  const printed = `Printed on: ${stamp12(now)}${generatedBy ? `   |   By: ${generatedBy}` : ''}`;
  const thin = { style: 'thin', color: { argb: LINE } } as const;
  const box = { top: thin, left: thin, bottom: thin, right: thin };

  function banner(ws: any, cols: number, title: string): number {
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
    bar(org.name, { size: 20, bold: true, fill: MAROON, color: 'FFFFFFFF', height: 34 });
    for (const line of org.address.filter(Boolean)) bar(line, { size: 11, fill: MAROON, color: SOFT, height: 18 });
    bar(title, { size: 15, bold: true, fill: AMBER, color: INK, height: 26 });
    bar(period, { size: 11, bold: true, fill: CREAM, color: INK, height: 20 });
    bar(printed, { size: 10, fill: CREAM, color: 'FF6B4A3A', height: 18 });
    return r + 1;
  }

  function page(ws: any, headerRow: number) {
    ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 } };
    ws.headerFooter = { oddFooter: `&L${org.name}&CPage &P of &N` };
    ws.views = [{ state: 'frozen', ySplit: headerRow, showGridLines: false }];
  }

  function head(ws: any, row: number, cols: Col[], start = 1) {
    cols.forEach((c, i) => {
      const cell = ws.getCell(row, start + i);
      cell.value = c.h;
      cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MAROON } };
      cell.alignment = { vertical: 'middle', horizontal: c.right ? 'right' : c.center ? 'center' : 'left', wrapText: true };
      cell.border = box;
    });
    ws.getRow(row).height = 24;
  }

  // Writes a table; returns the first empty row after it
  function table(ws: any, row: number, cols: Col[], rows: Row[], start = 1): number {
    head(ws, row, cols, start);
    rows.forEach((r, ri) => {
      const rr = row + 1 + ri;
      cols.forEach((c, ci) => {
        const cell = ws.getCell(rr, start + ci);
        const v = c.get(r, ri);
        cell.value = v === undefined || v === null || v === '' ? null : v;
        if (c.fmt && v !== '' && v !== null && v !== undefined && typeof v !== 'string') cell.numFmt = c.fmt;
        cell.font = { name: 'Calibri', size: 10.5, color: { argb: INK } };
        cell.alignment = { vertical: 'top', horizontal: c.right ? 'right' : c.center ? 'center' : 'left', wrapText: !c.right };
        cell.border = box;
        if (ri % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } };
      });
    });
    return row + 1 + rows.length;
  }

  function totalRow(ws: any, row: number, count: number, label: string, labelCol: number, sums: { col: number; value: number; fmt: string }[]) {
    for (let i = 1; i <= count; i++) {
      const c = ws.getCell(row, i);
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SOFT } };
      c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: INK } };
      c.border = box;
    }
    ws.getCell(row, labelCol).value = label;
    for (const s of sums) { const c = ws.getCell(row, s.col); c.value = s.value; c.numFmt = s.fmt; c.alignment = { horizontal: 'right' }; }
  }

  function widths(ws: any, cols: Col[]) { cols.forEach((c, i) => { ws.getColumn(i + 1).width = c.w; }); }

  function sheet(name: string, title: string, cols: Col[], rows: Row[], money?: { col: number; sumOf?: (r: Row) => number; label: string }) {
    const ws = wb.addWorksheet(name);
    widths(ws, cols);
    const hr = banner(ws, cols.length, title);
    const end = table(ws, hr, cols, rows);
    page(ws, hr);
    ws.getRow(hr).height = 24;
    if (rows.length === 0) {
      ws.mergeCells(end, 1, end, cols.length);
      ws.getCell(end, 1).value = 'Nothing in this period.';
      ws.getCell(end, 1).font = { italic: true, color: { argb: 'FF6B4A3A' } };
      ws.getCell(end, 1).alignment = { horizontal: 'center' };
    } else if (money) {
      const total = rows.reduce((a, r) => a + (money.sumOf ? money.sumOf(r) : Number(r[money.col]) || 0), 0);
      totalRow(ws, end, cols.length, money.label, 1, [{ col: money.col, value: Math.round(total * 100) / 100, fmt: MONEY }]);
    }
    ws.autoFilter = { from: { row: hr, column: 1 }, to: { row: hr, column: cols.length } };
    return ws;
  }

  const entry = (r: Row) => (r.source === 'manual' ? 'Counter' : 'Online');
  const paidDate = (r: Row) => toDate(r.paid_at);

  // ---------- Summary ----------
  if (rep.parts.includes('summary')) {
    const ws = wb.addWorksheet('Summary');
    const W = [26, 14, 18, 16, 18, 14, 12, 12];
    W.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    let r = banner(ws, W.length, 'Overall report');
    const section = (text: string) => {
      ws.mergeCells(r, 1, r, W.length);
      const c = ws.getCell(r, 1); c.value = text;
      c.font = { name: 'Calibri', size: 12, bold: true, color: { argb: MAROON } };
      c.border = { bottom: { style: 'medium', color: { argb: AMBER } } };
      ws.getRow(r).height = 22; r++;
    };

    section('Registers: sevas, donations, magazine and camps');
    const kinds = rep.kinds || [];
    const cols: Col[] = [
      { h: 'Register', w: 0, get: (k) => KIND[k.kind] || k.kind },
      { h: 'Entries', w: 0, get: (k) => k.entries, right: true, fmt: '#,##0' },
      { h: 'Amount', w: 0, get: (k) => k.amount, right: true, fmt: MONEY },
      { h: 'Counter entries', w: 0, get: (k) => k.offline_entries, right: true, fmt: '#,##0' },
      { h: 'Counter amount', w: 0, get: (k) => k.offline_amount, right: true, fmt: MONEY },
      { h: 'Waiting', w: 0, get: (k) => k.pending, right: true, fmt: '#,##0' },
      { h: 'Failed', w: 0, get: (k) => k.failed, right: true, fmt: '#,##0' },
      { h: 'Cancelled', w: 0, get: (k) => k.cancelled, right: true, fmt: '#,##0' },
    ];
    let end = table(ws, r, cols, kinds);
    totalRow(ws, end, cols.length, 'Total', 1, [
      { col: 2, value: kinds.reduce((a, k) => a + k.entries, 0), fmt: '#,##0' }, { col: 3, value: kinds.reduce((a, k) => a + k.amount, 0), fmt: MONEY },
      { col: 4, value: kinds.reduce((a, k) => a + k.offline_entries, 0), fmt: '#,##0' }, { col: 5, value: kinds.reduce((a, k) => a + k.offline_amount, 0), fmt: MONEY },
      { col: 6, value: kinds.reduce((a, k) => a + k.pending, 0), fmt: '#,##0' }, { col: 7, value: kinds.reduce((a, k) => a + k.failed, 0), fmt: '#,##0' },
      { col: 8, value: kinds.reduce((a, k) => a + k.cancelled, 0), fmt: '#,##0' },
    ]);
    r = end + 2;

    section('How the money came in (the four registers)');
    const modes = new Map<string, { n: number; amount: number }>();
    for (const k of kinds) for (const m of k.modes) { const c = modes.get(m.mode) || { n: 0, amount: 0 }; c.n += m.n; c.amount += m.amount; modes.set(m.mode, c); }
    const mrows = Array.from(modes.entries()).map(([mode, v]) => ({ mode, ...v })).sort((a, b) => b.amount - a.amount);
    end = table(ws, r, [
      { h: 'Payment mode', w: 0, get: (x) => modeText(x.mode) }, { h: 'Entries', w: 0, get: (x) => x.n, right: true, fmt: '#,##0' }, { h: 'Amount', w: 0, get: (x) => x.amount, right: true, fmt: MONEY },
    ], mrows);
    r = end + 2;

    section('Point of sale (shop)');
    const p = rep.pos?.summary;
    if (!rep.pos?.available || !p) {
      ws.getCell(r, 1).value = 'No point of sale data.'; ws.getCell(r, 1).font = { italic: true }; r += 2;
    } else {
      const kv: [string, number, string][] = [
        ['Bills', p.bills, '#,##0'], ['Sales before discount', p.subtotal, MONEY], ['Discount', p.discount, MONEY], ['GST', p.gst, MONEY],
        ['Total sales', p.total, MONEY], ['Cost of items sold', p.cost, MONEY], ['Profit (sales - GST - cost)', p.profit, MONEY], ['Purchases (stock in)', p.purchases, MONEY],
      ];
      kv.forEach(([k, v, f], i) => {
        const a = ws.getCell(r + i, 1), b = ws.getCell(r + i, 3);
        a.value = k; b.value = v; b.numFmt = f; b.alignment = { horizontal: 'right' };
        for (const c of [a, b]) { c.border = box; c.font = { name: 'Calibri', size: 10.5, bold: k.startsWith('Total') || k.startsWith('Profit'), color: { argb: k.startsWith('Profit') && v < 0 ? RED : INK } }; }
        ws.mergeCells(r + i, 1, r + i, 2);
      });
      r += kv.length + 1;
      const pm = (p.modes || []) as { mode: string; bills: number; total: number }[];
      if (pm.length) { r = table(ws, r, [{ h: 'POS payment mode', w: 0, get: (x) => modeText(x.mode) }, { h: 'Bills', w: 0, get: (x) => x.bills, right: true, fmt: '#,##0' }, { h: 'Amount', w: 0, get: (x) => x.total, right: true, fmt: MONEY }], pm) + 1; }
      r += 1;
    }

    section('Devotees');
    ws.getCell(r, 1).value = 'New devotees registered in this period'; ws.getCell(r, 1).border = box; ws.mergeCells(r, 1, r, 2);
    const dc = ws.getCell(r, 3); dc.value = rep.devotee_count ?? 0; dc.numFmt = '#,##0'; dc.border = box; dc.alignment = { horizontal: 'right' };
    r += 2;
    if (rep.truncated.length) {
      ws.mergeCells(r, 1, r, W.length);
      const c = ws.getCell(r, 1); c.value = `Note: some sheets were cut short: ${rep.truncated.join('; ')}. Choose a shorter period to get every row.`;
      c.font = { italic: true, color: { argb: RED } }; c.alignment = { wrapText: true }; ws.getRow(r).height = 30;
    }
    page(ws, 0);
    ws.views = [{ showGridLines: false }];
  }

  // ---------- Transactions: every payment line, newest first ----------
  if (rep.parts.includes('transactions')) {
    const cols: Col[] = [
      { h: 'Sl no', w: 7, get: (_r, i) => i + 1, center: true },
      { h: 'Date and time', w: 21, get: (r) => paidDate(r), fmt: DATETIME },
      { h: 'Register', w: 11, get: (r) => KIND[r.register] || r.register },
      { h: 'Receipt no', w: 18, get: (r) => r.receipt_no },
      { h: 'Name', w: 26, get: (r) => r.name },
      { h: 'Phone', w: 15, get: (r) => r.phone },
      { h: 'Item', w: 28, get: (r) => r.item },
      { h: 'Entry', w: 10, get: (r) => entry(r), center: true },
      { h: 'Payment mode', w: 14, get: (r) => modeText(String(r.mode || '')) },
      { h: 'Payment reference', w: 22, get: (r) => r.payment_ref },
      { h: 'Status', w: 19, get: (r) => STATUS[r.status] || r.status },
      { h: 'Amount', w: 15, get: (r) => Number(r.amount) || 0, right: true, fmt: MONEY },
    ];
    // The total counts only money that was received (paid or free entries)
    sheet('Transactions', 'Transaction report', cols, rep.transactions || [], { col: 12, sumOf: (r) => (r.status === 'PAID' || r.status === 'FREE' ? Number(r.amount) || 0 : 0), label: 'Total received (paid entries only)' });
  }

  // ---------- Registrations: who registered for what, and the dates ----------
  if (rep.parts.includes('registrations')) {
    const cols: Col[] = [
      { h: 'Sl no', w: 7, get: (_r, i) => i + 1, center: true },
      { h: 'Registered on', w: 21, get: (r) => paidDate(r), fmt: DATETIME },
      { h: 'Register', w: 11, get: (r) => KIND[r.register] || r.register },
      { h: 'Receipt no', w: 18, get: (r) => r.receipt_no },
      { h: 'Devotee id', w: 14, get: (r) => r.devotee_id },
      { h: 'Name', w: 26, get: (r) => r.name },
      { h: 'Phone', w: 15, get: (r) => r.phone },
      { h: 'Email', w: 26, get: (r) => r.email },
      { h: 'Seva / fund / plan / camp', w: 28, get: (r) => r.item },
      { h: 'Category', w: 14, get: (r) => r.category },
      { h: 'Date / starts', w: 14, get: (r) => { const d = toDate(r.event_date); return d; }, fmt: DATE },
      { h: 'Ends', w: 14, get: (r) => toDate(r.end_date), fmt: DATE },
      { h: 'Adults', w: 8, get: (r) => (r.adults == null ? '' : Number(r.adults)), right: true },
      { h: 'Children', w: 9, get: (r) => (r.children == null ? '' : Number(r.children)), right: true },
      { h: 'Months', w: 8, get: (r) => (r.months == null ? '' : Number(r.months)), right: true },
      { h: 'Status', w: 19, get: (r) => STATUS[r.status] || r.status },
      { h: 'Entry', w: 10, get: (r) => entry(r), center: true },
      { h: 'City', w: 16, get: (r) => r.city },
      { h: 'State', w: 16, get: (r) => r.state },
      { h: 'Address', w: 40, get: (r) => [r.address, r.pincode].filter(Boolean).join(' ') },
    ];
    sheet('Registrations', 'Registration report', cols, rep.registrations || []);
  }

  // ---------- Point of sale ----------
  if (rep.parts.includes('pos')) {
    const pos = rep.pos;
    const sales = pos?.sales || [];
    sheet('POS Sales', 'Point of sale: bills', [
      { h: 'Sl no', w: 7, get: (_r, i) => i + 1, center: true },
      { h: 'Bill no', w: 16, get: (r) => r.bill_no },
      { h: 'Date and time', w: 21, get: (r) => toDate(r.sale_date), fmt: DATETIME },
      { h: 'Customer', w: 24, get: (r) => r.customer_name },
      { h: 'Phone', w: 15, get: (r) => r.phone },
      { h: 'Before discount', w: 16, get: (r) => r.subtotal, right: true, fmt: MONEY },
      { h: 'Discount', w: 13, get: (r) => r.discount, right: true, fmt: MONEY },
      { h: 'GST', w: 13, get: (r) => r.gst_total, right: true, fmt: MONEY },
      { h: 'Total', w: 15, get: (r) => r.total, right: true, fmt: MONEY },
      { h: 'Payment', w: 11, get: (r) => modeText(String(r.pay_mode || '')) },
      { h: 'Reference', w: 18, get: (r) => r.pay_ref },
      { h: 'Status', w: 12, get: (r) => STATUS[r.status] || r.status },
      { h: 'Billed by', w: 24, get: (r) => r.created_by },
    ], sales, { col: 9, sumOf: (r) => (r.status === 'ACTIVE' ? Number(r.total) || 0 : 0), label: 'Total sales (cancelled bills left out)' });

    sheet('POS Items', 'Point of sale: items sold', [
      { h: 'Sl no', w: 7, get: (_r, i) => i + 1, center: true },
      { h: 'Item', w: 38, get: (r) => r.name },
      { h: 'Unit', w: 10, get: (r) => r.unit },
      { h: 'Quantity', w: 14, get: (r) => r.qty, right: true, fmt: QTY },
      { h: 'Sales amount', w: 16, get: (r) => r.amount, right: true, fmt: MONEY },
      { h: 'Profit', w: 16, get: (r) => r.profit, right: true, fmt: MONEY },
    ], pos?.items || [], { col: 5, sumOf: (r) => Number(r.amount) || 0, label: 'Total' });

    sheet('POS Purchases', 'Point of sale: purchases (stock in)', [
      { h: 'Sl no', w: 7, get: (_r, i) => i + 1, center: true },
      { h: 'Bill no', w: 16, get: (r) => r.bill_no },
      { h: 'Date', w: 14, get: (r) => toDate(r.purchase_date), fmt: DATE },
      { h: 'Supplier', w: 30, get: (r) => r.supplier },
      { h: 'Supplier bill', w: 18, get: (r) => r.supplier_bill },
      { h: 'Status', w: 12, get: (r) => STATUS[r.status] || r.status },
      { h: 'Total', w: 16, get: (r) => r.total, right: true, fmt: MONEY },
    ], pos?.purchases || [], { col: 7, sumOf: (r) => (r.status === 'ACTIVE' ? Number(r.total) || 0 : 0), label: 'Total purchases (cancelled bills left out)' });
  }

  // ---------- Devotees ----------
  if (rep.parts.includes('devotees')) {
    sheet('Devotees', 'Devotees registered in this period', [
      { h: 'Sl no', w: 7, get: (_r, i) => i + 1, center: true },
      { h: 'Devotee id', w: 16, get: (r) => r.devotee_code || r.id },
      { h: 'Name', w: 28, get: (r) => [r.first_name, r.last_name].filter(Boolean).join(' ') },
      { h: 'Phone', w: 15, get: (r) => r.phone },
      { h: 'Email', w: 30, get: (r) => r.email },
      { h: 'City', w: 18, get: (r) => r.city },
      { h: 'State', w: 18, get: (r) => r.state },
      { h: 'Residency', w: 14, get: (r) => r.residency },
      { h: 'Address', w: 44, get: (r) => r.comm_address },
      { h: 'Registered on', w: 21, get: (r) => toDate(r.created_at), fmt: hasTime(rep.devotees?.[0]?.created_at) ? DATETIME : DATE },
    ], rep.devotees || []);
  }

  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}