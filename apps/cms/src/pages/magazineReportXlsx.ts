// Builds the Magazine payments report as ONE Excel workbook: a Summary sheet and a Magazine payments sheet that lists every subscription.
// Used by MagazinePayments.tsx ("Download report"). The look comes from reportKit.ts.
import { parseCsv } from './posReportXlsx';
import { AMBERTXT, DATE, DATETIME, GREEN, MONEY, RED, STATUS_TXT, STATUS_WORD, dayCell, localCell, newReport, num } from './reportKit';
import type { KitInput } from './reportKit';

export type MagazineSummary = {
  paid: { count: number; amount: number }; pending: { count: number; amount: number }; failed: { count: number; amount: number };
  average: number; successRate: number; payers: number; repeatSubscribers: number; previous: { count: number; amount: number } | null;
  subscriptions: { active: number; expired: number; endingSoon: number; toPost: number };
  categories: { category: string; paid: { count: number; amount: number }; pending: { count: number; amount: number }; failed: { count: number; amount: number } }[];
  daily: { day: string; source: string; count: number; amount: number }[];
  planTable: { plan: string; category: string; bookings: number; paid: number; amount: number; failed: number; pending: number }[];
  states: { state: string; count: number; amount: number }[];
  cities: { city: string; count: number; amount: number }[];
  durations: { months: number; count: number; amount: number }[];
  modes: { mode: string; count: number; amount: number }[];
  expiring: { name: string; phone: string | null; plan: string; end_date: string | null; amount: number }[];
  followUps: { name: string; phone: string | null; plan: string; amount: number; status: string; paid_at: string }[];
  subscribers: { devotee_id: string; name: string; phone: string; count: number; amount: number; last: string }[];
};

export type MagazineReportInput = KitInput & {
  filtersText: string;           // for example "Print and digital, all payments, all plans"
  summary: MagazineSummary;      // for the dates only
  paymentsCsv: string;           // the text of /payments/admin/magazine/export (the dates and the table filters)
  exportLimit: number;
  catLabel: (c: string) => string;
};

export async function buildMagazineReportXlsx(inp: MagazineReportInput): Promise<ArrayBuffer> {
  const k = await newReport(inp);
  const cat = (s: string) => inp.catLabel(s);
  const modeName = (m: string) => (m === 'online' ? 'Online' : m === 'offline' ? 'Offline' : m);
  const memberName = (m: string) => (m === 'ACTIVE' ? 'Active' : m === 'EXPIRED' ? 'Expired' : 'Not started');

  // =============== Summary ===============
  {
    const s = inp.summary;
    const widths = [34, 18, 14, 14, 18, 14, 14];
    const cols = widths.length;
    const ws = k.wb.addWorksheet('Summary', { properties: { tabColor: { argb: 'FF7A1C1C' } } });
    ws.columns = widths.map((width) => ({ width }));
    let r = k.banner(ws, widths, 'MAGAZINE PAYMENTS REPORT', 'Money is counted only when a payment is paid');
    k.setup(ws, 0, 'portrait');

    k.sectionBar(ws, r++, cols, 'Key figures');
    const items: [string, number | string, string, string?][] = [
      ['Collected (paid)', s.paid.amount, MONEY, GREEN],
      ['Paid subscriptions', s.paid.count, '#,##0'],
      ['Subscribers', s.payers, '#,##0'],
      ['Subscribers who paid more than once', s.repeatSubscribers, '#,##0'],
      ['Average subscription', s.average, MONEY],
      [`Pending (${s.pending.count} not completed)`, s.pending.amount, MONEY, AMBERTXT],
      [`Failed (${s.failed.count} not received)`, s.failed.amount, MONEY, RED],
      ['Success rate', s.successRate / 100, '0.0%'],
      ['Active subscriptions (now)', s.subscriptions.active, '#,##0'],
      ['Expired subscriptions (now)', s.subscriptions.expired, '#,##0'],
      ['Ending in the next 30 days', s.subscriptions.endingSoon, '#,##0'],
      ['Print copies to post', s.subscriptions.toPost, '#,##0'],
    ];
    if (s.previous) {
      items.push(['Collected in the period before', s.previous.amount, MONEY]);
      if (s.previous.amount > 0) items.push(['Change from the period before', (s.paid.amount - s.previous.amount) / s.previous.amount, '+0.0%;-0.0%;0.0%']);
    }
    r = k.figures(ws, r, items) + 1;

    k.sectionBar(ws, r++, cols, 'Collected by delivery');
    k.headRow(ws, r++, ['Delivery', 'Paid subscriptions', 'Collected', 'Share'], [2, 3, 4]);
    s.categories.forEach((c, i) => {
      k.bodyCell(ws.getCell(r, 1), i, {}); ws.getCell(r, 1).value = cat(c.category);
      k.bodyCell(ws.getCell(r, 2), i, { fmt: '#,##0', right: true }); ws.getCell(r, 2).value = c.paid.count;
      k.bodyCell(ws.getCell(r, 3), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 3).value = c.paid.amount;
      k.bodyCell(ws.getCell(r, 4), i, { fmt: '0.0%', right: true }); ws.getCell(r, 4).value = s.paid.amount > 0 ? c.paid.amount / s.paid.amount : 0;
      r++;
    });
    r++;

    k.sectionBar(ws, r++, cols, 'Health');
    k.headRow(ws, r++, ['Status', 'Subscriptions', 'Amount'], [2, 3]);
    ([['Paid', s.paid, GREEN], ['Pending', s.pending, AMBERTXT], ['Failed', s.failed, RED]] as [string, { count: number; amount: number }, string][]).forEach(([label, v, color], i) => {
      k.bodyCell(ws.getCell(r, 1), i, { bold: true, color }); ws.getCell(r, 1).value = label;
      k.bodyCell(ws.getCell(r, 2), i, { fmt: '#,##0', right: true }); ws.getCell(r, 2).value = v.count;
      k.bodyCell(ws.getCell(r, 3), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 3).value = v.amount;
      r++;
    });
    r++;

    k.sectionBar(ws, r++, cols, 'Plan-wise report');
    k.headRow(ws, r++, ['Plan', 'Delivery', 'Attempts', 'Paid', 'Collected', 'Failed', 'Success'], [3, 4, 5, 6, 7]);
    s.planTable.forEach((t, i) => {
      k.bodyCell(ws.getCell(r, 1), i, { bold: true }); ws.getCell(r, 1).value = t.plan;
      k.bodyCell(ws.getCell(r, 2), i, {}); ws.getCell(r, 2).value = cat(t.category);
      k.bodyCell(ws.getCell(r, 3), i, { fmt: '#,##0', right: true }); ws.getCell(r, 3).value = t.bookings;
      k.bodyCell(ws.getCell(r, 4), i, { fmt: '#,##0', right: true }); ws.getCell(r, 4).value = t.paid;
      k.bodyCell(ws.getCell(r, 5), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 5).value = t.amount;
      k.bodyCell(ws.getCell(r, 6), i, { fmt: '#,##0', right: true, color: t.failed ? RED : undefined }); ws.getCell(r, 6).value = t.failed;
      k.bodyCell(ws.getCell(r, 7), i, { fmt: '0%', right: true }); ws.getCell(r, 7).value = t.bookings ? t.paid / t.bookings : 0;
      r++;
    });
    if (!s.planTable.length) { k.empty(ws, r, 'No subscriptions in this period.'); r++; }
    r++;

    k.sectionBar(ws, r++, cols, 'Plan length (paid subscriptions)');
    k.headRow(ws, r++, ['Months', 'Subscriptions', 'Collected'], [2, 3]);
    s.durations.forEach((t, i) => {
      k.bodyCell(ws.getCell(r, 1), i, {}); ws.getCell(r, 1).value = `${t.months} month${t.months === 1 ? '' : 's'}`;
      k.bodyCell(ws.getCell(r, 2), i, { fmt: '#,##0', right: true }); ws.getCell(r, 2).value = t.count;
      k.bodyCell(ws.getCell(r, 3), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 3).value = t.amount;
      r++;
    });
    if (!s.durations.length) { k.empty(ws, r, 'Nothing yet.'); r++; }
    r++;

    k.sectionBar(ws, r++, cols, 'Online and offline');
    k.headRow(ws, r++, ['Paid how', 'Subscriptions', 'Collected'], [2, 3]);
    s.modes.forEach((t, i) => {
      k.bodyCell(ws.getCell(r, 1), i, {}); ws.getCell(r, 1).value = modeName(t.mode);
      k.bodyCell(ws.getCell(r, 2), i, { fmt: '#,##0', right: true }); ws.getCell(r, 2).value = t.count;
      k.bodyCell(ws.getCell(r, 3), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 3).value = t.amount;
      r++;
    });
    if (!s.modes.length) { k.empty(ws, r, 'Nothing yet.'); r++; }
    r++;

    k.sectionBar(ws, r++, cols, 'Collected by day');
    k.headRow(ws, r++, ['Date', 'Paid subscriptions', 'Collected'], [2, 3]);
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
    if (!days.length) { k.empty(ws, r, 'No paid subscriptions in this period.'); r++; }
    r++;

    k.sectionBar(ws, r++, cols, 'Top subscribers');
    k.headRow(ws, r++, ['Subscriber', 'Phone', 'Subscriptions', 'Collected', 'Last payment'], [3, 4]);
    s.subscribers.forEach((d, i) => {
      k.bodyCell(ws.getCell(r, 1), i, {}); ws.getCell(r, 1).value = d.name || d.devotee_id;
      k.bodyCell(ws.getCell(r, 2), i, {}); ws.getCell(r, 2).value = d.phone || '';
      k.bodyCell(ws.getCell(r, 3), i, { fmt: '#,##0', right: true }); ws.getCell(r, 3).value = d.count;
      k.bodyCell(ws.getCell(r, 4), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 4).value = d.amount;
      k.bodyCell(ws.getCell(r, 5), i, { fmt: DATE }); ws.getCell(r, 5).value = d.last ? localCell(String(d.last).replace('Z', '').replace('T', ' ').slice(0, 19)) : '';
      r++;
    });
    if (!s.subscribers.length) { k.empty(ws, r, 'Nothing yet.'); r++; }
    r++;

    k.sectionBar(ws, r++, cols, 'Subscribers by state');
    k.headRow(ws, r++, ['State', 'Subscriptions', 'Collected'], [2, 3]);
    s.states.forEach((t, i) => {
      k.bodyCell(ws.getCell(r, 1), i, {}); ws.getCell(r, 1).value = t.state;
      k.bodyCell(ws.getCell(r, 2), i, { fmt: '#,##0', right: true }); ws.getCell(r, 2).value = t.count;
      k.bodyCell(ws.getCell(r, 3), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 3).value = t.amount;
      r++;
    });
    if (!s.states.length) { k.empty(ws, r, 'Nothing yet.'); r++; }
    r++;

    k.sectionBar(ws, r++, cols, 'Subscribers by city');
    k.headRow(ws, r++, ['City', 'Subscriptions', 'Collected'], [2, 3]);
    s.cities.forEach((t, i) => {
      k.bodyCell(ws.getCell(r, 1), i, {}); ws.getCell(r, 1).value = t.city;
      k.bodyCell(ws.getCell(r, 2), i, { fmt: '#,##0', right: true }); ws.getCell(r, 2).value = t.count;
      k.bodyCell(ws.getCell(r, 3), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 3).value = t.amount;
      r++;
    });
    if (!s.cities.length) { k.empty(ws, r, 'Nothing yet.'); r++; }
    r++;

    k.sectionBar(ws, r++, cols, 'Renewals due (ending in the next 30 days)');
    k.headRow(ws, r++, ['Subscriber', 'Phone', 'Ends on', 'Amount', 'Plan'], [4]);
    s.expiring.forEach((x, i) => {
      k.bodyCell(ws.getCell(r, 1), i, {}); ws.getCell(r, 1).value = x.name || 'Unknown subscriber';
      k.bodyCell(ws.getCell(r, 2), i, {}); ws.getCell(r, 2).value = x.phone || '';
      k.bodyCell(ws.getCell(r, 3), i, { fmt: DATE }); ws.getCell(r, 3).value = dayCell(x.end_date || '');
      k.bodyCell(ws.getCell(r, 4), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 4).value = x.amount;
      k.bodyCell(ws.getCell(r, 5), i, {}); ws.getCell(r, 5).value = x.plan;
      r++;
    });
    if (!s.expiring.length) { k.empty(ws, r, 'No subscription ends in the next 30 days.'); r++; }
    r++;

    k.sectionBar(ws, r++, cols, 'Follow up (latest pending and failed subscriptions)');
    k.headRow(ws, r++, ['Subscriber', 'Phone', 'Status', 'Amount', 'Plan', 'Date'], [4]);
    s.followUps.forEach((f, i) => {
      k.bodyCell(ws.getCell(r, 1), i, {}); ws.getCell(r, 1).value = f.name || 'Unknown subscriber';
      k.bodyCell(ws.getCell(r, 2), i, {}); ws.getCell(r, 2).value = f.phone || '';
      k.bodyCell(ws.getCell(r, 3), i, { bold: true, color: STATUS_TXT[f.status] }); ws.getCell(r, 3).value = STATUS_WORD[f.status] || f.status;
      k.bodyCell(ws.getCell(r, 4), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 4).value = f.amount;
      k.bodyCell(ws.getCell(r, 5), i, {}); ws.getCell(r, 5).value = f.plan;
      k.bodyCell(ws.getCell(r, 6), i, { fmt: DATE }); ws.getCell(r, 6).value = f.paid_at ? localCell(String(f.paid_at).replace('Z', '').replace('T', ' ').slice(0, 19)) : '';
      r++;
    });
    if (!s.followUps.length) { k.empty(ws, r, 'Nothing to follow up.'); r++; }
  }

  // =============== Magazine payments (every subscription, one row each) ===============
  {
    const rows = parseCsv(inp.paymentsCsv).slice(1);
    // CSV columns: 0 Payment date, 1 Subscriber, 2 Phone, 3 Email, 4 Address, 5 City, 6 State, 7 Pincode, 8 Plan, 9 Delivery, 10 Months,
    //              11 Start date, 12 End date, 13 Amount, 14 Payment status, 15 Subscription, 16 Mode, 17 Receipt no, 18 Order id, 19 Payment id
    const heads = ['Payment date and time', 'Subscriber', 'Phone', 'Email', 'Address', 'City', 'State', 'Pincode', 'Plan', 'Delivery', 'Months', 'Start date', 'End date', 'Amount', 'Payment', 'Subscription', 'Paid how', 'Receipt no', 'Razorpay order id', 'Transaction id (Razorpay payment)'];
    const widths = [22, 24, 16, 28, 34, 16, 16, 11, 26, 14, 9, 13, 13, 14, 12, 14, 10, 16, 26, 28];
    const cols = heads.length;
    const ws = k.wb.addWorksheet('Magazine payments', { properties: { tabColor: { argb: 'FFEA580C' } } });
    ws.columns = widths.map((width) => ({ width }));
    const capped = rows.length >= inp.exportLimit;
    const head = k.banner(ws, widths, 'MAGAZINE PAYMENTS - EVERY SUBSCRIPTION', `${inp.filtersText}. Failed payments are in red and are not counted in the total${capped ? `. Only the newest ${inp.exportLimit} are listed` : ''}`);
    k.headRow(ws, head, heads, [14]);
    k.setup(ws, head, 'landscape');
    let paidSum = 0;
    rows.forEach((x, i) => {
      const r = head + 1 + i;
      const failed = x[14] === 'FAILED';
      const fill = failed ? 'FFFEF2F2' : undefined;
      const set = (c: number, v: any, o: any = {}) => { k.bodyCell(ws.getCell(r, c), i, { fill, color: failed ? RED : undefined, ...o }); ws.getCell(r, c).value = v; };
      set(1, localCell(x[0]), { fmt: DATETIME }); set(2, x[1]); set(3, x[2]); set(4, x[3]); set(5, x[4]); set(6, x[5]); set(7, x[6]); set(8, x[7]);
      set(9, x[8]); set(10, cat(x[9])); set(11, num(x[10]), { right: true });
      set(12, dayCell(x[11]), { fmt: DATE }); set(13, dayCell(x[12]), { fmt: DATE });
      set(14, num(x[13]), { fmt: MONEY, right: true, bold: true });
      set(15, STATUS_WORD[x[14]] || x[14], { bold: true, color: STATUS_TXT[x[14]] });
      set(16, memberName(x[15])); set(17, modeName(x[16])); set(18, x[17]); set(19, x[18]); set(20, x[19]);
      if (x[14] === 'PAID') paidSum += Number(x[13]) || 0;
    });
    const last = head + rows.length, tr = last + 1;
    k.totalRow(ws, tr, cols, rows.length ? `TOTAL PAID  (${rows.length} subscription${rows.length === 1 ? '' : 's'} listed)` : 'No subscriptions for these filters.');
    if (rows.length) {
      const cell = ws.getCell(`N${tr}`);
      cell.value = { formula: `SUMIFS(N${head + 1}:N${last},O${head + 1}:O${last},"Paid")`, result: Math.round(paidSum * 100) / 100 };
      cell.numFmt = MONEY; cell.alignment = { horizontal: 'right' };
      ws.autoFilter = { from: { row: head, column: 1 }, to: { row: last, column: cols } };
    }
  }

  return k.finish();
}