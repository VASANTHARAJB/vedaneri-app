// Builds the Seva payments report as ONE Excel workbook: a Summary sheet and a Seva payments sheet that lists every booking.
// Used by SevaPayments.tsx ("Download report"). The look comes from reportKit.ts.
import { parseCsv } from './posReportXlsx';
import { AMBERTXT, DATE, DATETIME, GREEN, MONEY, RED, STATUS_TXT, STATUS_WORD, dayCell, localCell, newReport, num } from './reportKit';
import type { KitInput } from './reportKit';

export type SevaSummary = {
  paid: { count: number; amount: number }; pending: { count: number; amount: number }; failed: { count: number; amount: number };
  average: number; successRate: number; payers: number; repeatDevotees: number; previous: { count: number; amount: number } | null;
  categories: { category: string; paid: { count: number; amount: number }; pending: { count: number; amount: number }; failed: { count: number; amount: number } }[];
  daily: { day: string; source: string; count: number; amount: number }[];
  sevaTable: { seva: string; category: string; bookings: number; paid: number; amount: number; failed: number; pending: number }[];
  states: { state: string; count: number; amount: number }[];
  ranges: { label: string; count: number; amount: number }[];
  followUps: { name: string; phone: string | null; seva: string; amount: number; status: string; paid_at: string }[];
  devotees: { devotee_id: string; name: string; phone: string; count: number; amount: number; last: string }[];
};

export type SevaReportInput = KitInput & {
  filtersText: string;           // for example "Corpus and non-corpus, all statuses, all sevas"
  summary: SevaSummary;          // for the dates only
  paymentsCsv: string;           // the text of /payments/admin/seva/export (the dates and the table filters)
  exportLimit: number;
  catLabel: Record<string, string>;
};

export async function buildSevaReportXlsx(inp: SevaReportInput): Promise<ArrayBuffer> {
  const k = await newReport(inp);
  const cat = (s: string) => inp.catLabel[s] || s;

  // =============== Summary ===============
  {
    const s = inp.summary;
    const widths = [34, 18, 14, 14, 18, 14, 14];
    const cols = widths.length;
    const ws = k.wb.addWorksheet('Summary', { properties: { tabColor: { argb: 'FF7A1C1C' } } });
    ws.columns = widths.map((width) => ({ width }));
    let r = k.banner(ws, widths, 'SEVA PAYMENTS REPORT', 'Money is counted only when a payment is paid');
    k.setup(ws, 0, 'portrait');

    k.sectionBar(ws, r++, cols, 'Key figures');
    const items: [string, number | string, string, string?][] = [
      ['Collected (paid)', s.paid.amount, MONEY, GREEN],
      ['Paid bookings', s.paid.count, '#,##0'],
      ['Devotees who paid', s.payers, '#,##0'],
      ['Devotees who paid more than once', s.repeatDevotees, '#,##0'],
      ['Average booking', s.average, MONEY],
      [`Pending (${s.pending.count} not completed)`, s.pending.amount, MONEY, AMBERTXT],
      [`Failed (${s.failed.count} not received)`, s.failed.amount, MONEY, RED],
      ['Success rate', s.successRate / 100, '0.0%'],
    ];
    if (s.previous) {
      items.push(['Collected in the period before', s.previous.amount, MONEY]);
      if (s.previous.amount > 0) items.push(['Change from the period before', (s.paid.amount - s.previous.amount) / s.previous.amount, '+0.0%;-0.0%;0.0%']);
    }
    r = k.figures(ws, r, items) + 1;

    k.sectionBar(ws, r++, cols, 'Collected by category');
    k.headRow(ws, r++, ['Category', 'Paid bookings', 'Collected', 'Share'], [2, 3, 4]);
    s.categories.forEach((c, i) => {
      k.bodyCell(ws.getCell(r, 1), i, {}); ws.getCell(r, 1).value = cat(c.category);
      k.bodyCell(ws.getCell(r, 2), i, { fmt: '#,##0', right: true }); ws.getCell(r, 2).value = c.paid.count;
      k.bodyCell(ws.getCell(r, 3), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 3).value = c.paid.amount;
      k.bodyCell(ws.getCell(r, 4), i, { fmt: '0.0%', right: true }); ws.getCell(r, 4).value = s.paid.amount > 0 ? c.paid.amount / s.paid.amount : 0;
      r++;
    });
    r++;

    k.sectionBar(ws, r++, cols, 'Health');
    k.headRow(ws, r++, ['Status', 'Bookings', 'Amount'], [2, 3]);
    ([['Paid', s.paid, GREEN], ['Pending', s.pending, AMBERTXT], ['Failed', s.failed, RED]] as [string, { count: number; amount: number }, string][]).forEach(([label, v, color], i) => {
      k.bodyCell(ws.getCell(r, 1), i, { bold: true, color }); ws.getCell(r, 1).value = label;
      k.bodyCell(ws.getCell(r, 2), i, { fmt: '#,##0', right: true }); ws.getCell(r, 2).value = v.count;
      k.bodyCell(ws.getCell(r, 3), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 3).value = v.amount;
      r++;
    });
    r++;

    k.sectionBar(ws, r++, cols, 'Seva-wise report');
    k.headRow(ws, r++, ['Seva', 'Category', 'Bookings', 'Paid', 'Collected', 'Failed', 'Success'], [3, 4, 5, 6, 7]);
    s.sevaTable.forEach((t, i) => {
      k.bodyCell(ws.getCell(r, 1), i, { bold: true }); ws.getCell(r, 1).value = t.seva;
      k.bodyCell(ws.getCell(r, 2), i, {}); ws.getCell(r, 2).value = cat(t.category);
      k.bodyCell(ws.getCell(r, 3), i, { fmt: '#,##0', right: true }); ws.getCell(r, 3).value = t.bookings;
      k.bodyCell(ws.getCell(r, 4), i, { fmt: '#,##0', right: true }); ws.getCell(r, 4).value = t.paid;
      k.bodyCell(ws.getCell(r, 5), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 5).value = t.amount;
      k.bodyCell(ws.getCell(r, 6), i, { fmt: '#,##0', right: true, color: t.failed ? RED : undefined }); ws.getCell(r, 6).value = t.failed;
      k.bodyCell(ws.getCell(r, 7), i, { fmt: '0%', right: true }); ws.getCell(r, 7).value = t.bookings ? t.paid / t.bookings : 0;
      r++;
    });
    if (!s.sevaTable.length) { k.empty(ws, r, 'No bookings in this period.'); r++; }
    r++;

    k.sectionBar(ws, r++, cols, 'Collected by day');
    k.headRow(ws, r++, ['Date', 'Paid bookings', 'Collected'], [2, 3]);
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
    if (!days.length) { k.empty(ws, r, 'No paid bookings in this period.'); r++; }
    r++;

    k.sectionBar(ws, r++, cols, 'Top devotees');
    k.headRow(ws, r++, ['Devotee', 'Phone', 'Bookings', 'Collected', 'Last payment'], [3, 4]);
    s.devotees.forEach((d, i) => {
      k.bodyCell(ws.getCell(r, 1), i, {}); ws.getCell(r, 1).value = d.name || d.devotee_id;
      k.bodyCell(ws.getCell(r, 2), i, {}); ws.getCell(r, 2).value = d.phone || '';
      k.bodyCell(ws.getCell(r, 3), i, { fmt: '#,##0', right: true }); ws.getCell(r, 3).value = d.count;
      k.bodyCell(ws.getCell(r, 4), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 4).value = d.amount;
      k.bodyCell(ws.getCell(r, 5), i, { fmt: DATE }); ws.getCell(r, 5).value = d.last ? localCell(String(d.last).replace('Z', '').replace('T', ' ').slice(0, 19)) : '';
      r++;
    });
    if (!s.devotees.length) { k.empty(ws, r, 'Nothing yet.'); r++; }
    r++;

    k.sectionBar(ws, r++, cols, 'Devotees by state');
    k.headRow(ws, r++, ['State', 'Bookings', 'Collected'], [2, 3]);
    s.states.forEach((t, i) => {
      k.bodyCell(ws.getCell(r, 1), i, {}); ws.getCell(r, 1).value = t.state;
      k.bodyCell(ws.getCell(r, 2), i, { fmt: '#,##0', right: true }); ws.getCell(r, 2).value = t.count;
      k.bodyCell(ws.getCell(r, 3), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 3).value = t.amount;
      r++;
    });
    if (!s.states.length) { k.empty(ws, r, 'Nothing yet.'); r++; }
    r++;

    k.sectionBar(ws, r++, cols, 'Booking sizes (paid bookings by amount)');
    k.headRow(ws, r++, ['Amount range', 'Bookings', 'Collected'], [2, 3]);
    s.ranges.forEach((t, i) => {
      k.bodyCell(ws.getCell(r, 1), i, {}); ws.getCell(r, 1).value = t.label;
      k.bodyCell(ws.getCell(r, 2), i, { fmt: '#,##0', right: true }); ws.getCell(r, 2).value = t.count;
      k.bodyCell(ws.getCell(r, 3), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 3).value = t.amount;
      r++;
    });
    r++;

    k.sectionBar(ws, r++, cols, 'Follow up (latest pending and failed bookings)');
    k.headRow(ws, r++, ['Devotee', 'Phone', 'Status', 'Amount', 'Seva', 'Date'], [4]);
    s.followUps.forEach((f, i) => {
      k.bodyCell(ws.getCell(r, 1), i, {}); ws.getCell(r, 1).value = f.name || 'Unknown devotee';
      k.bodyCell(ws.getCell(r, 2), i, {}); ws.getCell(r, 2).value = f.phone || '';
      k.bodyCell(ws.getCell(r, 3), i, { bold: true, color: STATUS_TXT[f.status] }); ws.getCell(r, 3).value = STATUS_WORD[f.status] || f.status;
      k.bodyCell(ws.getCell(r, 4), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 4).value = f.amount;
      k.bodyCell(ws.getCell(r, 5), i, {}); ws.getCell(r, 5).value = f.seva;
      k.bodyCell(ws.getCell(r, 6), i, { fmt: DATE }); ws.getCell(r, 6).value = f.paid_at ? localCell(String(f.paid_at).replace('Z', '').replace('T', ' ').slice(0, 19)) : '';
      r++;
    });
    if (!s.followUps.length) { k.empty(ws, r, 'Nothing to follow up.'); r++; }
  }

  // =============== Seva payments (every booking, one row each) ===============
  {
    const rows = parseCsv(inp.paymentsCsv).slice(1);
    // CSV columns: 0 Payment date, 1 Devotee, 2 Phone, 3 Email, 4 City, 5 State, 6 Seva, 7 Category, 8 Seva date,
    //              9 Amount, 10 Status, 11 Receipt no, 12 Razorpay order id, 13 Razorpay payment id, 14 Sankalpam names
    const heads = ['Payment date and time', 'Devotee', 'Phone', 'Email', 'City', 'State', 'Seva', 'Category', 'Seva date', 'Amount', 'Status', 'Receipt no', 'Razorpay order id', 'Transaction id (Razorpay payment)', 'Sankalpam names'];
    const widths = [22, 24, 16, 28, 16, 16, 30, 16, 13, 14, 12, 16, 26, 28, 50];
    const cols = heads.length;
    const ws = k.wb.addWorksheet('Seva payments', { properties: { tabColor: { argb: 'FFEA580C' } } });
    ws.columns = widths.map((width) => ({ width }));
    const capped = rows.length >= inp.exportLimit;
    const head = k.banner(ws, widths, 'SEVA PAYMENTS - EVERY BOOKING', `${inp.filtersText}. Failed bookings are in red and are not counted in the total${capped ? `. Only the newest ${inp.exportLimit} are listed` : ''}`);
    k.headRow(ws, head, heads, [10]);
    k.setup(ws, head, 'landscape');
    let paidSum = 0;
    rows.forEach((x, i) => {
      const r = head + 1 + i;
      const failed = x[10] === 'FAILED';
      const fill = failed ? 'FFFEF2F2' : undefined;
      const set = (c: number, v: any, o: any = {}) => { k.bodyCell(ws.getCell(r, c), i, { fill, color: failed ? RED : undefined, ...o }); ws.getCell(r, c).value = v; };
      set(1, localCell(x[0]), { fmt: DATETIME }); set(2, x[1]); set(3, x[2]); set(4, x[3]); set(5, x[4]); set(6, x[5]); set(7, x[6]);
      set(8, cat(x[7] === 'Corpus' ? 'corpus' : x[7] === 'Seva' ? 'seva' : x[7]));
      set(9, dayCell(x[8]), { fmt: DATE });
      set(10, num(x[9]), { fmt: MONEY, right: true, bold: true });
      set(11, STATUS_WORD[x[10]] || x[10], { bold: true, color: STATUS_TXT[x[10]] });
      set(12, x[11]); set(13, x[12]); set(14, x[13]); set(15, x[14]);
      if (x[10] === 'PAID') paidSum += Number(x[9]) || 0;
    });
    const last = head + rows.length, tr = last + 1;
    k.totalRow(ws, tr, cols, rows.length ? `TOTAL PAID  (${rows.length} booking${rows.length === 1 ? '' : 's'} listed)` : 'No bookings for these filters.');
    if (rows.length) {
      const cell = ws.getCell(`J${tr}`);
      cell.value = { formula: `SUMIFS(J${head + 1}:J${last},K${head + 1}:K${last},"Paid")`, result: Math.round(paidSum * 100) / 100 };
      cell.numFmt = MONEY; cell.alignment = { horizontal: 'right' };
      ws.autoFilter = { from: { row: head, column: 1 }, to: { row: last, column: cols } };
    }
  }

  return k.finish();
}