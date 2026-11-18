// Builds the Camp payments report as ONE Excel workbook: a Summary sheet and a Camp payments sheet that lists every registration with a fee.
// Used by CampPayments.tsx ("Download report"). The look comes from reportKit.ts.
import { parseCsv } from './posReportXlsx';
import { AMBERTXT, DATE, DATETIME, GREEN, MONEY, RED, STATUS_TXT, STATUS_WORD, dayCell, localCell, newReport, num } from './reportKit';
import type { KitInput } from './reportKit';

type Money = { count: number; amount: number };
export type CampSummary = {
  paid: Money; pending: Money; failed: Money;
  average: number; successRate: number; payers: number; repeatDevotees: number; previous: Money | null;
  people: { total: number; adults: number; children: number };
  categories: { category: string; paid: Money; pending: Money; failed: Money }[];
  daily: { day: string; source: string; count: number; amount: number }[];
  campTable: { camp: string; category: string; start: string | null; registrations: number; paid: number; amount: number; people: number; failed: number; pending: number }[];
  states: { state: string; count: number; amount: number }[];
  ranges: { label: string; count: number; amount: number }[];
  ahead: { camp: string; start: string | null; end: string | null; count: number; people: number; amount: number }[];
  followUps: { name: string; phone: string | null; camp: string; amount: number; status: string; paid_at: string }[];
  devotees: { devotee_id: string; name: string; phone: string; count: number; amount: number; last: string }[];
};

export type CampReportInput = KitInput & {
  filtersText: string;           // for example "All camps, all statuses, all camp names"
  summary: CampSummary;          // for the dates only
  paymentsCsv: string;           // the text of /payments/admin/camp/export (the dates and the table filters)
  exportLimit: number;
  catLabel: Record<string, string>;
};

export async function buildCampReportXlsx(inp: CampReportInput): Promise<ArrayBuffer> {
  const k = await newReport(inp);
  const cat = (s: string) => inp.catLabel[s] || s;

  // =============== Summary ===============
  {
    const s = inp.summary;
    const widths = [34, 18, 14, 14, 18, 14, 14];
    const cols = widths.length;
    const ws = k.wb.addWorksheet('Summary', { properties: { tabColor: { argb: 'FF7A1C1C' } } });
    ws.columns = widths.map((width) => ({ width }));
    let r = k.banner(ws, widths, 'CAMP PAYMENTS REPORT', 'Money is counted only when a payment is paid');
    k.setup(ws, 0, 'portrait');

    k.sectionBar(ws, r++, cols, 'Key figures');
    const items: [string, number | string, string, string?][] = [
      ['Collected (paid)', s.paid.amount, MONEY, GREEN],
      ['Paid registrations', s.paid.count, '#,##0'],
      ['People registered (paid)', s.people.total, '#,##0'],
      ['  of them adults', s.people.adults, '#,##0'],
      ['  of them children', s.people.children, '#,##0'],
      ['Devotees who paid', s.payers, '#,##0'],
      ['Devotees who paid more than once', s.repeatDevotees, '#,##0'],
      ['Average registration', s.average, MONEY],
      [`Pending (${s.pending.count} not completed)`, s.pending.amount, MONEY, AMBERTXT],
      [`Failed (${s.failed.count} not received)`, s.failed.amount, MONEY, RED],
      ['Success rate', s.successRate / 100, '0.0%'],
    ];
    if (s.previous) {
      items.push(['Collected in the period before', s.previous.amount, MONEY]);
      if (s.previous.amount > 0) items.push(['Change from the period before', (s.paid.amount - s.previous.amount) / s.previous.amount, '+0.0%;-0.0%;0.0%']);
    }
    r = k.figures(ws, r, items) + 1;

    k.sectionBar(ws, r++, cols, 'Collected by camp timing');
    k.headRow(ws, r++, ['Camps', 'Paid registrations', 'Collected', 'Share'], [2, 3, 4]);
    s.categories.forEach((c, i) => {
      k.bodyCell(ws.getCell(r, 1), i, {}); ws.getCell(r, 1).value = cat(c.category);
      k.bodyCell(ws.getCell(r, 2), i, { fmt: '#,##0', right: true }); ws.getCell(r, 2).value = c.paid.count;
      k.bodyCell(ws.getCell(r, 3), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 3).value = c.paid.amount;
      k.bodyCell(ws.getCell(r, 4), i, { fmt: '0.0%', right: true }); ws.getCell(r, 4).value = s.paid.amount > 0 ? c.paid.amount / s.paid.amount : 0;
      r++;
    });
    r++;

    k.sectionBar(ws, r++, cols, 'Health');
    k.headRow(ws, r++, ['Status', 'Registrations', 'Amount'], [2, 3]);
    ([['Paid', s.paid, GREEN], ['Pending', s.pending, AMBERTXT], ['Failed', s.failed, RED]] as [string, Money, string][]).forEach(([label, v, color], i) => {
      k.bodyCell(ws.getCell(r, 1), i, { bold: true, color }); ws.getCell(r, 1).value = label;
      k.bodyCell(ws.getCell(r, 2), i, { fmt: '#,##0', right: true }); ws.getCell(r, 2).value = v.count;
      k.bodyCell(ws.getCell(r, 3), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 3).value = v.amount;
      r++;
    });
    r++;

    k.sectionBar(ws, r++, cols, 'Camp-wise report');
    k.headRow(ws, r++, ['Camp', 'When', 'Registrations', 'Paid', 'People', 'Collected', 'Failed'], [3, 4, 5, 6, 7]);
    s.campTable.forEach((t, i) => {
      k.bodyCell(ws.getCell(r, 1), i, { bold: true }); ws.getCell(r, 1).value = t.camp;
      k.bodyCell(ws.getCell(r, 2), i, {}); ws.getCell(r, 2).value = cat(t.category);
      k.bodyCell(ws.getCell(r, 3), i, { fmt: '#,##0', right: true }); ws.getCell(r, 3).value = t.registrations;
      k.bodyCell(ws.getCell(r, 4), i, { fmt: '#,##0', right: true }); ws.getCell(r, 4).value = t.paid;
      k.bodyCell(ws.getCell(r, 5), i, { fmt: '#,##0', right: true }); ws.getCell(r, 5).value = t.people;
      k.bodyCell(ws.getCell(r, 6), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 6).value = t.amount;
      k.bodyCell(ws.getCell(r, 7), i, { fmt: '#,##0', right: true, color: t.failed ? RED : undefined }); ws.getCell(r, 7).value = t.failed;
      r++;
    });
    if (!s.campTable.length) { k.empty(ws, r, 'No registrations in this period.'); r++; }
    r++;

    k.sectionBar(ws, r++, cols, 'Camps ahead (paid, not yet ended)');
    k.headRow(ws, r++, ['Camp', 'Starts', 'Ends', 'Registrations', 'People', 'Collected'], [4, 5, 6]);
    s.ahead.forEach((a, i) => {
      k.bodyCell(ws.getCell(r, 1), i, { bold: true }); ws.getCell(r, 1).value = a.camp;
      k.bodyCell(ws.getCell(r, 2), i, { fmt: DATE }); ws.getCell(r, 2).value = a.start ? dayCell(a.start) : '';
      k.bodyCell(ws.getCell(r, 3), i, { fmt: DATE }); ws.getCell(r, 3).value = a.end ? dayCell(a.end) : '';
      k.bodyCell(ws.getCell(r, 4), i, { fmt: '#,##0', right: true }); ws.getCell(r, 4).value = a.count;
      k.bodyCell(ws.getCell(r, 5), i, { fmt: '#,##0', right: true }); ws.getCell(r, 5).value = a.people;
      k.bodyCell(ws.getCell(r, 6), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 6).value = a.amount;
      r++;
    });
    if (!s.ahead.length) { k.empty(ws, r, 'No paid registrations for camps that are still to come.'); r++; }
    r++;

    k.sectionBar(ws, r++, cols, 'Collected by day');
    k.headRow(ws, r++, ['Date', 'Paid registrations', 'Collected'], [2, 3]);
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
    if (!days.length) { k.empty(ws, r, 'No paid registrations in this period.'); r++; }
    r++;

    k.sectionBar(ws, r++, cols, 'Top registrants');
    k.headRow(ws, r++, ['Registrant', 'Phone', 'Registrations', 'Collected', 'Last payment'], [3, 4]);
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

    k.sectionBar(ws, r++, cols, 'Registrants by state');
    k.headRow(ws, r++, ['State', 'Registrations', 'Collected'], [2, 3]);
    s.states.forEach((t, i) => {
      k.bodyCell(ws.getCell(r, 1), i, {}); ws.getCell(r, 1).value = t.state;
      k.bodyCell(ws.getCell(r, 2), i, { fmt: '#,##0', right: true }); ws.getCell(r, 2).value = t.count;
      k.bodyCell(ws.getCell(r, 3), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 3).value = t.amount;
      r++;
    });
    if (!s.states.length) { k.empty(ws, r, 'Nothing yet.'); r++; }
    r++;

    k.sectionBar(ws, r++, cols, 'Registration sizes (paid registrations by amount)');
    k.headRow(ws, r++, ['Amount range', 'Registrations', 'Collected'], [2, 3]);
    s.ranges.forEach((t, i) => {
      k.bodyCell(ws.getCell(r, 1), i, {}); ws.getCell(r, 1).value = t.label;
      k.bodyCell(ws.getCell(r, 2), i, { fmt: '#,##0', right: true }); ws.getCell(r, 2).value = t.count;
      k.bodyCell(ws.getCell(r, 3), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 3).value = t.amount;
      r++;
    });
    r++;

    k.sectionBar(ws, r++, cols, 'Follow up (latest pending and failed registrations)');
    k.headRow(ws, r++, ['Registrant', 'Phone', 'Status', 'Amount', 'Camp', 'Date'], [4]);
    s.followUps.forEach((f, i) => {
      k.bodyCell(ws.getCell(r, 1), i, {}); ws.getCell(r, 1).value = f.name || 'Unknown';
      k.bodyCell(ws.getCell(r, 2), i, {}); ws.getCell(r, 2).value = f.phone || '';
      k.bodyCell(ws.getCell(r, 3), i, { bold: true, color: STATUS_TXT[f.status] }); ws.getCell(r, 3).value = STATUS_WORD[f.status] || f.status;
      k.bodyCell(ws.getCell(r, 4), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 4).value = f.amount;
      k.bodyCell(ws.getCell(r, 5), i, {}); ws.getCell(r, 5).value = f.camp;
      k.bodyCell(ws.getCell(r, 6), i, { fmt: DATE }); ws.getCell(r, 6).value = f.paid_at ? localCell(String(f.paid_at).replace('Z', '').replace('T', ' ').slice(0, 19)) : '';
      r++;
    });
    if (!s.followUps.length) { k.empty(ws, r, 'Nothing to follow up.'); r++; }
  }

  // =============== Camp payments (every registration with a fee, one row each) ===============
  {
    const rows = parseCsv(inp.paymentsCsv).slice(1);
    // CSV columns: 0 Payment date, 1 Registrant, 2 Phone, 3 Email, 4 City, 5 State, 6 Camp, 7 When, 8 Camp start, 9 Camp end,
    //              10 People, 11 Adults, 12 Children, 13 Amount, 14 Payment status, 15 Registration, 16 Razorpay order id, 17 Razorpay payment id
    const heads = ['Payment date and time', 'Registrant', 'Phone', 'Email', 'City', 'State', 'Camp', 'When', 'Camp starts', 'Camp ends', 'People', 'Adults', 'Children', 'Amount', 'Status', 'Registration', 'Razorpay order id', 'Transaction id (Razorpay payment)'];
    const widths = [22, 24, 16, 28, 16, 16, 30, 16, 13, 13, 9, 9, 9, 14, 12, 15, 26, 28];
    const cols = heads.length;
    const ws = k.wb.addWorksheet('Camp payments', { properties: { tabColor: { argb: 'FFEA580C' } } });
    ws.columns = widths.map((width) => ({ width }));
    const capped = rows.length >= inp.exportLimit;
    const head = k.banner(ws, widths, 'CAMP PAYMENTS - EVERY REGISTRATION WITH A FEE', `${inp.filtersText}. Failed payments are in red and are not counted in the total${capped ? `. Only the newest ${inp.exportLimit} are listed` : ''}`);
    k.headRow(ws, head, heads, [11, 12, 13, 14]);
    k.setup(ws, head, 'landscape');
    let paidSum = 0;
    rows.forEach((x, i) => {
      const r = head + 1 + i;
      const failed = x[14] === 'FAILED';
      const fill = failed ? 'FFFEF2F2' : undefined;
      const set = (c: number, v: any, o: any = {}) => { k.bodyCell(ws.getCell(r, c), i, { fill, color: failed ? RED : undefined, ...o }); ws.getCell(r, c).value = v; };
      set(1, localCell(x[0]), { fmt: DATETIME }); set(2, x[1]); set(3, x[2]); set(4, x[3]); set(5, x[4]); set(6, x[5]); set(7, x[6]);
      set(8, cat(x[7]));
      set(9, dayCell(x[8]), { fmt: DATE }); set(10, dayCell(x[9]), { fmt: DATE });
      set(11, num(x[10]), { fmt: '#,##0', right: true }); set(12, num(x[11]), { fmt: '#,##0', right: true }); set(13, num(x[12]), { fmt: '#,##0', right: true });
      set(14, num(x[13]), { fmt: MONEY, right: true, bold: true });
      set(15, STATUS_WORD[x[14]] || x[14], { bold: true, color: STATUS_TXT[x[14]] });
      set(16, x[15]); set(17, x[16]); set(18, x[17]);
      if (x[14] === 'PAID') paidSum += Number(x[13]) || 0;
    });
    const last = head + rows.length, tr = last + 1;
    k.totalRow(ws, tr, cols, rows.length ? `TOTAL PAID  (${rows.length} registration${rows.length === 1 ? '' : 's'} listed)` : 'No registrations for these filters.');
    if (rows.length) {
      const cell = ws.getCell(`N${tr}`);
      cell.value = { formula: `SUMIFS(N${head + 1}:N${last},O${head + 1}:O${last},"Paid")`, result: Math.round(paidSum * 100) / 100 };
      cell.numFmt = MONEY; cell.alignment = { horizontal: 'right' };
      ws.autoFilter = { from: { row: head, column: 1 }, to: { row: last, column: cols } };
    }
  }

  return k.finish();
}