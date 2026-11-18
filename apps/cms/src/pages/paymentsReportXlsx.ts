// Builds the Payments report as ONE Excel workbook: a Summary sheet and a Payments sheet that lists every payment.
// Used by PaymentsDashboard.tsx ("Download report"). The look comes from reportKit.ts.
import { parseCsv } from './posReportXlsx';
import { AMBERTXT, DATE, DATETIME, GREEN, MONEY, RED, STATUS_TXT, STATUS_WORD, dayCell, localCell, newReport, num } from './reportKit';
import type { KitInput } from './reportKit';

export { loadLogo } from './reportKit';
export type { Logo } from './reportKit';

export type PaySummary = {
  paid: { count: number; amount: number }; pending: { count: number; amount: number }; failed: { count: number; amount: number };
  average: number; successRate: number; payers: number; previous: { count: number; amount: number } | null;
  sources: { source: string; count: number; amount: number }[];
  daily: { day: string; source: string; count: number; amount: number }[];
  top: { item: string; source: string; count: number; amount: number }[];
  donors: { name: string; key: string; count: number; amount: number; last: string }[];
};

export type PayReportInput = KitInput & {
  filtersText: string;          // for example "All types, all statuses" or "Type: Seva, Status: Paid"
  summary: PaySummary;          // for the dates only
  paymentsCsv: string;          // the text of /payments/admin/export (the dates and the table filters)
  exportLimit: number;          // the most rows the server sends
  typeLabel: Record<string, string>;
};

export async function buildPaymentsReportXlsx(inp: PayReportInput): Promise<ArrayBuffer> {
  const k = await newReport(inp);
  const typeName = (s: string) => inp.typeLabel[s] || s;

  // =============== Summary ===============
  {
    const s = inp.summary;
    const widths = [34, 16, 18, 18, 18];
    const cols = widths.length;
    const ws = k.wb.addWorksheet('Summary', { properties: { tabColor: { argb: 'FF7A1C1C' } } });
    ws.columns = widths.map((width) => ({ width }));
    let r = k.banner(ws, widths, 'PAYMENTS REPORT', 'Money is counted only when a payment is paid');
    k.setup(ws, 0, 'portrait');

    k.sectionBar(ws, r++, cols, 'Key figures');
    const items: [string, number | string, string, string?][] = [
      ['Collected (paid)', s.paid.amount, MONEY, GREEN],
      ['Paid payments', s.paid.count, '#,##0'],
      ['People who paid', s.payers, '#,##0'],
      ['Average payment', s.average, MONEY],
      [`Pending (${s.pending.count} not completed)`, s.pending.amount, MONEY, AMBERTXT],
      [`Failed (${s.failed.count} not received)`, s.failed.amount, MONEY, RED],
      ['Success rate', s.successRate / 100, '0.0%'],
    ];
    if (s.previous) {
      items.push(['Collected in the period before', s.previous.amount, MONEY]);
      if (s.previous.amount > 0) items.push(['Change from the period before', (s.paid.amount - s.previous.amount) / s.previous.amount, '+0.0%;-0.0%;0.0%']);
    }
    r = k.figures(ws, r, items) + 1;

    k.sectionBar(ws, r++, cols, 'Collected by type');
    k.headRow(ws, r++, ['Type', 'Payments', 'Amount', 'Share'], [2, 3, 4]);
    s.sources.forEach((x, i) => {
      k.bodyCell(ws.getCell(r, 1), i, {}); ws.getCell(r, 1).value = typeName(x.source);
      k.bodyCell(ws.getCell(r, 2), i, { fmt: '#,##0', right: true }); ws.getCell(r, 2).value = x.count;
      k.bodyCell(ws.getCell(r, 3), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 3).value = x.amount;
      k.bodyCell(ws.getCell(r, 4), i, { fmt: '0.0%', right: true }); ws.getCell(r, 4).value = s.paid.amount > 0 ? x.amount / s.paid.amount : 0;
      r++;
    });
    r++;

    k.sectionBar(ws, r++, cols, 'Payment health');
    k.headRow(ws, r++, ['Status', 'Payments', 'Amount'], [2, 3]);
    ([['Paid', s.paid, GREEN], ['Pending', s.pending, AMBERTXT], ['Failed', s.failed, RED]] as [string, { count: number; amount: number }, string][]).forEach(([label, v, color], i) => {
      k.bodyCell(ws.getCell(r, 1), i, { bold: true, color }); ws.getCell(r, 1).value = label;
      k.bodyCell(ws.getCell(r, 2), i, { fmt: '#,##0', right: true }); ws.getCell(r, 2).value = v.count;
      k.bodyCell(ws.getCell(r, 3), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 3).value = v.amount;
      r++;
    });
    r++;

    k.sectionBar(ws, r++, cols, 'Collected by day');
    k.headRow(ws, r++, ['Date', 'Payments', 'Amount'], [2, 3]);
    const days: { day: string; count: number; amount: number }[] = [];
    for (const d of s.daily) {
      const last = days[days.length - 1];
      if (last && last.day === d.day) { last.count += d.count; last.amount += d.amount; } else days.push({ day: d.day, count: d.count, amount: d.amount });
    }
    days.forEach((d, i) => {
      k.bodyCell(ws.getCell(r, 1), i, { fmt: DATE }); ws.getCell(r, 1).value = dayCell(d.day);
      k.bodyCell(ws.getCell(r, 2), i, { fmt: '#,##0', right: true }); ws.getCell(r, 2).value = d.count;
      k.bodyCell(ws.getCell(r, 3), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 3).value = Math.round(d.amount * 100) / 100;
      r++;
    });
    if (!days.length) { k.empty(ws, r, 'No paid payments in this period.'); r++; }
    r++;

    k.sectionBar(ws, r++, cols, 'Top items');
    k.headRow(ws, r++, ['Item', 'Type', 'Payments', 'Amount'], [3, 4]);
    s.top.forEach((t, i) => {
      k.bodyCell(ws.getCell(r, 1), i, {}); ws.getCell(r, 1).value = t.item;
      k.bodyCell(ws.getCell(r, 2), i, {}); ws.getCell(r, 2).value = typeName(t.source);
      k.bodyCell(ws.getCell(r, 3), i, { fmt: '#,##0', right: true }); ws.getCell(r, 3).value = t.count;
      k.bodyCell(ws.getCell(r, 4), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 4).value = t.amount;
      r++;
    });
    if (!s.top.length) { k.empty(ws, r, 'Nothing yet.'); r++; }
    r++;

    k.sectionBar(ws, r++, cols, 'Top supporters');
    k.headRow(ws, r++, ['Name', 'Payments', 'Amount', 'Last payment'], [2, 3]);
    s.donors.forEach((d, i) => {
      k.bodyCell(ws.getCell(r, 1), i, {}); ws.getCell(r, 1).value = d.name || d.key;
      k.bodyCell(ws.getCell(r, 2), i, { fmt: '#,##0', right: true }); ws.getCell(r, 2).value = d.count;
      k.bodyCell(ws.getCell(r, 3), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 3).value = d.amount;
      k.bodyCell(ws.getCell(r, 4), i, { fmt: DATE }); ws.getCell(r, 4).value = typeof d.last === 'string' && d.last ? localCell(d.last.replace('Z', '').replace('T', ' ').slice(0, 19)) : '';
      r++;
    });
    if (!s.donors.length) { k.empty(ws, r, 'Nothing yet.'); r++; }
  }

  // =============== Payments (every payment, one row each) ===============
  {
    const rows = parseCsv(inp.paymentsCsv).slice(1);
    // CSV columns: 0 Date, 1 Type, 2 Item, 3 Amount, 4 Status, 5 Name, 6 Email, 7 Phone, 8 Receipt no, 9 Mode, 10 Order id, 11 Payment id
    const heads = ['Date and time', 'Type', 'Item', 'Name', 'Email', 'Phone', 'Amount', 'Status', 'Receipt no', 'Mode', 'Order id', 'Payment id'];
    const widths = [22, 12, 30, 24, 28, 16, 14, 12, 16, 10, 26, 26];
    const cols = heads.length;
    const ws = k.wb.addWorksheet('Payments', { properties: { tabColor: { argb: 'FFEA580C' } } });
    ws.columns = widths.map((width) => ({ width }));
    const capped = rows.length >= inp.exportLimit;
    const head = k.banner(ws, widths, 'PAYMENTS - EVERY PAYMENT', `${inp.filtersText}. Failed payments are in red and are not counted in the total${capped ? `. Only the newest ${inp.exportLimit} are listed` : ''}`);
    k.headRow(ws, head, heads, [7]);
    k.setup(ws, head, 'landscape');
    let paidSum = 0;
    rows.forEach((x, i) => {
      const r = head + 1 + i;
      const failed = x[4] === 'FAILED';
      const fill = failed ? 'FFFEF2F2' : undefined;
      const set = (c: number, v: any, o: any = {}) => { k.bodyCell(ws.getCell(r, c), i, { fill, color: failed ? RED : undefined, ...o }); ws.getCell(r, c).value = v; };
      set(1, localCell(x[0]), { fmt: DATETIME }); set(2, typeName(x[1])); set(3, x[2]); set(4, x[5]); set(5, x[6]); set(6, x[7]);
      set(7, num(x[3]), { fmt: MONEY, right: true, bold: true });
      set(8, STATUS_WORD[x[4]] || x[4], { bold: true, color: STATUS_TXT[x[4]] });
      set(9, x[8]); set(10, x[9]); set(11, x[10]); set(12, x[11]);
      if (x[4] === 'PAID') paidSum += Number(x[3]) || 0;
    });
    const last = head + rows.length, tr = last + 1;
    k.totalRow(ws, tr, cols, rows.length ? `TOTAL PAID  (${rows.length} payment${rows.length === 1 ? '' : 's'} listed)` : 'No payments for these filters.');
    if (rows.length) {
      const cell = ws.getCell(`G${tr}`);
      cell.value = { formula: `SUMIFS(G${head + 1}:G${last},H${head + 1}:H${last},"Paid")`, result: Math.round(paidSum * 100) / 100 };
      cell.numFmt = MONEY; cell.alignment = { horizontal: 'right' };
      ws.autoFilter = { from: { row: head, column: 1 }, to: { row: last, column: cols } };
    }
  }

  return k.finish();
}