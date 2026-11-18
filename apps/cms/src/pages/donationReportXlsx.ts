// Builds the Donation payments report as ONE Excel workbook: a Summary sheet and a Donation payments sheet that lists every donation.
// Used by DonationPayments.tsx ("Download report"). The look comes from reportKit.ts.
import { parseCsv } from './posReportXlsx';
import { AMBERTXT, DATE, DATETIME, GREEN, MONEY, RED, STATUS_TXT, STATUS_WORD, dayCell, localCell, newReport, num } from './reportKit';
import type { KitInput } from './reportKit';

export type DonationSummary = {
  paid: { count: number; amount: number }; pending: { count: number; amount: number }; failed: { count: number; amount: number };
  average: number; successRate: number; payers: number; repeatDonors: number; previous: { count: number; amount: number } | null;
  categories: { category: string; paid: { count: number; amount: number }; pending: { count: number; amount: number }; failed: { count: number; amount: number } }[];
  daily: { day: string; source: string; count: number; amount: number }[];
  fundTable: { fund: string; category: string; bookings: number; paid: number; amount: number; failed: number; pending: number }[];
  states: { state: string; count: number; amount: number }[];
  cities: { city: string; count: number; amount: number }[];
  ranges: { label: string; count: number; amount: number }[];
  followUps: { name: string; phone: string | null; fund: string; amount: number; status: string; paid_at: string }[];
  donors: { devotee_id: string; name: string; phone: string; count: number; amount: number; last: string }[];
};

export type DonationReportInput = KitInput & {
  filtersText: string;           // for example "All categories, all statuses, all funds"
  summary: DonationSummary;          // for the dates only
  paymentsCsv: string;           // the text of /payments/admin/donation/export (the dates and the table filters)
  exportLimit: number;
  catLabel: (c: string) => string;
};

export async function buildDonationReportXlsx(inp: DonationReportInput): Promise<ArrayBuffer> {
  const k = await newReport(inp);
  const cat = (s: string) => inp.catLabel(s);

  // =============== Summary ===============
  {
    const s = inp.summary;
    const widths = [34, 18, 14, 14, 18, 14, 14];
    const cols = widths.length;
    const ws = k.wb.addWorksheet('Summary', { properties: { tabColor: { argb: 'FF7A1C1C' } } });
    ws.columns = widths.map((width) => ({ width }));
    let r = k.banner(ws, widths, 'DONATION PAYMENTS REPORT', 'Money is counted only when a payment is paid');
    k.setup(ws, 0, 'portrait');

    k.sectionBar(ws, r++, cols, 'Key figures');
    const items: [string, number | string, string, string?][] = [
      ['Collected (paid)', s.paid.amount, MONEY, GREEN],
      ['Paid donations', s.paid.count, '#,##0'],
      ['Donors', s.payers, '#,##0'],
      ['Donors who gave more than once', s.repeatDonors, '#,##0'],
      ['Average donation', s.average, MONEY],
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
    k.headRow(ws, r++, ['Category', 'Paid donations', 'Collected', 'Share'], [2, 3, 4]);
    s.categories.forEach((c, i) => {
      k.bodyCell(ws.getCell(r, 1), i, {}); ws.getCell(r, 1).value = cat(c.category);
      k.bodyCell(ws.getCell(r, 2), i, { fmt: '#,##0', right: true }); ws.getCell(r, 2).value = c.paid.count;
      k.bodyCell(ws.getCell(r, 3), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 3).value = c.paid.amount;
      k.bodyCell(ws.getCell(r, 4), i, { fmt: '0.0%', right: true }); ws.getCell(r, 4).value = s.paid.amount > 0 ? c.paid.amount / s.paid.amount : 0;
      r++;
    });
    r++;

    k.sectionBar(ws, r++, cols, 'Health');
    k.headRow(ws, r++, ['Status', 'Donations', 'Amount'], [2, 3]);
    ([['Paid', s.paid, GREEN], ['Pending', s.pending, AMBERTXT], ['Failed', s.failed, RED]] as [string, { count: number; amount: number }, string][]).forEach(([label, v, color], i) => {
      k.bodyCell(ws.getCell(r, 1), i, { bold: true, color }); ws.getCell(r, 1).value = label;
      k.bodyCell(ws.getCell(r, 2), i, { fmt: '#,##0', right: true }); ws.getCell(r, 2).value = v.count;
      k.bodyCell(ws.getCell(r, 3), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 3).value = v.amount;
      r++;
    });
    r++;

    k.sectionBar(ws, r++, cols, 'Fund-wise report');
    k.headRow(ws, r++, ['Fund', 'Category', 'Attempts', 'Paid', 'Collected', 'Failed', 'Success'], [3, 4, 5, 6, 7]);
    s.fundTable.forEach((t, i) => {
      k.bodyCell(ws.getCell(r, 1), i, { bold: true }); ws.getCell(r, 1).value = t.fund;
      k.bodyCell(ws.getCell(r, 2), i, {}); ws.getCell(r, 2).value = cat(t.category);
      k.bodyCell(ws.getCell(r, 3), i, { fmt: '#,##0', right: true }); ws.getCell(r, 3).value = t.bookings;
      k.bodyCell(ws.getCell(r, 4), i, { fmt: '#,##0', right: true }); ws.getCell(r, 4).value = t.paid;
      k.bodyCell(ws.getCell(r, 5), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 5).value = t.amount;
      k.bodyCell(ws.getCell(r, 6), i, { fmt: '#,##0', right: true, color: t.failed ? RED : undefined }); ws.getCell(r, 6).value = t.failed;
      k.bodyCell(ws.getCell(r, 7), i, { fmt: '0%', right: true }); ws.getCell(r, 7).value = t.bookings ? t.paid / t.bookings : 0;
      r++;
    });
    if (!s.fundTable.length) { k.empty(ws, r, 'No donations in this period.'); r++; }
    r++;

    k.sectionBar(ws, r++, cols, 'Collected by day');
    k.headRow(ws, r++, ['Date', 'Paid donations', 'Collected'], [2, 3]);
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
    if (!days.length) { k.empty(ws, r, 'No paid donations in this period.'); r++; }
    r++;

    k.sectionBar(ws, r++, cols, 'Top donors');
    k.headRow(ws, r++, ['Donor', 'Phone', 'Donations', 'Collected', 'Last payment'], [3, 4]);
    s.donors.forEach((d, i) => {
      k.bodyCell(ws.getCell(r, 1), i, {}); ws.getCell(r, 1).value = d.name || d.devotee_id;
      k.bodyCell(ws.getCell(r, 2), i, {}); ws.getCell(r, 2).value = d.phone || '';
      k.bodyCell(ws.getCell(r, 3), i, { fmt: '#,##0', right: true }); ws.getCell(r, 3).value = d.count;
      k.bodyCell(ws.getCell(r, 4), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 4).value = d.amount;
      k.bodyCell(ws.getCell(r, 5), i, { fmt: DATE }); ws.getCell(r, 5).value = d.last ? localCell(String(d.last).replace('Z', '').replace('T', ' ').slice(0, 19)) : '';
      r++;
    });
    if (!s.donors.length) { k.empty(ws, r, 'Nothing yet.'); r++; }
    r++;

    k.sectionBar(ws, r++, cols, 'Donors by state');
    k.headRow(ws, r++, ['State', 'Donations', 'Collected'], [2, 3]);
    s.states.forEach((t, i) => {
      k.bodyCell(ws.getCell(r, 1), i, {}); ws.getCell(r, 1).value = t.state;
      k.bodyCell(ws.getCell(r, 2), i, { fmt: '#,##0', right: true }); ws.getCell(r, 2).value = t.count;
      k.bodyCell(ws.getCell(r, 3), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 3).value = t.amount;
      r++;
    });
    if (!s.states.length) { k.empty(ws, r, 'Nothing yet.'); r++; }
    r++;

    k.sectionBar(ws, r++, cols, 'Donors by city');
    k.headRow(ws, r++, ['City', 'Donations', 'Collected'], [2, 3]);
    s.cities.forEach((t, i) => {
      k.bodyCell(ws.getCell(r, 1), i, {}); ws.getCell(r, 1).value = t.city;
      k.bodyCell(ws.getCell(r, 2), i, { fmt: '#,##0', right: true }); ws.getCell(r, 2).value = t.count;
      k.bodyCell(ws.getCell(r, 3), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 3).value = t.amount;
      r++;
    });
    if (!s.cities.length) { k.empty(ws, r, 'Nothing yet.'); r++; }
    r++;

    k.sectionBar(ws, r++, cols, 'Donation sizes (paid donations by amount)');
    k.headRow(ws, r++, ['Amount range', 'Donations', 'Collected'], [2, 3]);
    s.ranges.forEach((t, i) => {
      k.bodyCell(ws.getCell(r, 1), i, {}); ws.getCell(r, 1).value = t.label;
      k.bodyCell(ws.getCell(r, 2), i, { fmt: '#,##0', right: true }); ws.getCell(r, 2).value = t.count;
      k.bodyCell(ws.getCell(r, 3), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 3).value = t.amount;
      r++;
    });
    r++;

    k.sectionBar(ws, r++, cols, 'Follow up (latest pending and failed donations)');
    k.headRow(ws, r++, ['Donor', 'Phone', 'Status', 'Amount', 'Fund', 'Date'], [4]);
    s.followUps.forEach((f, i) => {
      k.bodyCell(ws.getCell(r, 1), i, {}); ws.getCell(r, 1).value = f.name || 'Unknown donor';
      k.bodyCell(ws.getCell(r, 2), i, {}); ws.getCell(r, 2).value = f.phone || '';
      k.bodyCell(ws.getCell(r, 3), i, { bold: true, color: STATUS_TXT[f.status] }); ws.getCell(r, 3).value = STATUS_WORD[f.status] || f.status;
      k.bodyCell(ws.getCell(r, 4), i, { fmt: MONEY, right: true, bold: true }); ws.getCell(r, 4).value = f.amount;
      k.bodyCell(ws.getCell(r, 5), i, {}); ws.getCell(r, 5).value = f.fund;
      k.bodyCell(ws.getCell(r, 6), i, { fmt: DATE }); ws.getCell(r, 6).value = f.paid_at ? localCell(String(f.paid_at).replace('Z', '').replace('T', ' ').slice(0, 19)) : '';
      r++;
    });
    if (!s.followUps.length) { k.empty(ws, r, 'Nothing to follow up.'); r++; }
  }

  // =============== Donation payments (every donation, one row each) ===============
  {
    const rows = parseCsv(inp.paymentsCsv).slice(1);
    // CSV columns: 0 Payment date, 1 Donor, 2 Phone, 3 Email, 4 City, 5 State, 6 Fund, 7 Category, 8 Donation date,
    //              9 Amount, 10 Status, 11 Receipt no, 12 Razorpay order id, 13 Razorpay payment id, 14 PAN given, 15 Names
    const heads = ['Payment date and time', 'Donor', 'Phone', 'Email', 'City', 'State', 'Fund', 'Category', 'Donation date', 'Amount', 'Status', 'Receipt no', 'Razorpay order id', 'Transaction id (Razorpay payment)', 'PAN given', 'Names written'];
    const widths = [22, 24, 16, 28, 16, 16, 30, 16, 13, 14, 12, 16, 26, 28, 10, 50];
    const cols = heads.length;
    const ws = k.wb.addWorksheet('Donation payments', { properties: { tabColor: { argb: 'FFEA580C' } } });
    ws.columns = widths.map((width) => ({ width }));
    const capped = rows.length >= inp.exportLimit;
    const head = k.banner(ws, widths, 'DONATION PAYMENTS - EVERY DONATION', `${inp.filtersText}. Failed donations are in red and are not counted in the total${capped ? `. Only the newest ${inp.exportLimit} are listed` : ''}`);
    k.headRow(ws, head, heads, [10]);
    k.setup(ws, head, 'landscape');
    let paidSum = 0;
    rows.forEach((x, i) => {
      const r = head + 1 + i;
      const failed = x[10] === 'FAILED';
      const fill = failed ? 'FFFEF2F2' : undefined;
      const set = (c: number, v: any, o: any = {}) => { k.bodyCell(ws.getCell(r, c), i, { fill, color: failed ? RED : undefined, ...o }); ws.getCell(r, c).value = v; };
      set(1, localCell(x[0]), { fmt: DATETIME }); set(2, x[1]); set(3, x[2]); set(4, x[3]); set(5, x[4]); set(6, x[5]); set(7, x[6]);
      set(8, cat(x[7]));
      set(9, dayCell(x[8]), { fmt: DATE });
      set(10, num(x[9]), { fmt: MONEY, right: true, bold: true });
      set(11, STATUS_WORD[x[10]] || x[10], { bold: true, color: STATUS_TXT[x[10]] });
      set(12, x[11]); set(13, x[12]); set(14, x[13]); set(15, x[14]); set(16, x[15]);
      if (x[10] === 'PAID') paidSum += Number(x[9]) || 0;
    });
    const last = head + rows.length, tr = last + 1;
    k.totalRow(ws, tr, cols, rows.length ? `TOTAL PAID  (${rows.length} donation${rows.length === 1 ? '' : 's'} listed)` : 'No donations for these filters.');
    if (rows.length) {
      const cell = ws.getCell(`J${tr}`);
      cell.value = { formula: `SUMIFS(J${head + 1}:J${last},K${head + 1}:K${last},"Paid")`, result: Math.round(paidSum * 100) / 100 };
      cell.numFmt = MONEY; cell.alignment = { horizontal: 'right' };
      ws.autoFilter = { from: { row: head, column: 1 }, to: { row: last, column: cols } };
    }
  }

  return k.finish();
}