// The printed Sankalpa form ("Pooja Kanikkai Samarpanam"), laid out like the paper form the ashram already uses:
// header, name, address and mobile, donation amount, receipt number and date, pooja day and details,
// a table of the people (place, gothram, nakshatram, rasi, name), and the date and signature at the bottom.
// Every value is escaped before it goes into the page.
// Gothram, nakshatram and rasi chosen from the lists are printed in Tamil. The Panchangam Manager's entry for the pooja day is printed under the pooja details.
import { tamilOf } from './sankalpaLists';
import { fetchPanchangam, tamilLine } from './panchangamLookup';

export type FormPerson = { name?: string; place?: string; gothram?: string; nakshathiram?: string; rasi?: string };
export type FormData = {
  name: string; address: string; phone: string; amount: number | null; receiptNo: string;
  date: string; poojaDate: string; poojaDetails: string; people: FormPerson[]; panchangam?: string;
};

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
// 2026-11-06 is written 06/11/2026, as on the paper form
const dmy = (d: string) => (/^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : d);
const money = (n: number | null) => (n == null ? '' : `${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}/-`);
const MIN_ROWS = 5;

function oneForm(f: FormData, sealUrl: string): string {
  const rows = Math.max(MIN_ROWS, f.people.length);
  const people = Array.from({ length: rows }, (_, i) => {
    const p = f.people[i];
    return `<tr class="r"><td class="c n">${i + 1}</td><td>${esc(p?.place)}</td><td>${esc(tamilOf(p?.gothram))}</td><td>${esc(tamilOf(p?.nakshathiram))}</td><td>${esc(tamilOf(p?.rasi))}</td><td>${esc(p?.name)}</td></tr>`;
  }).join('');
  return `<section class="sheet">
  <table class="f">
    <colgroup><col style="width:17%"><col style="width:14%"><col style="width:15%"><col style="width:14%"><col style="width:14%"><col style="width:26%"></colgroup>
    <tr class="head"><td colspan="6">
      <div class="hd">
        <div class="logo">${sealUrl ? `<img src="${esc(sealUrl)}" alt="">` : ''}</div>
        <div class="ti">
          <div class="om">ஓம்</div>
          <div class="gu">ஸ்ரீகுருப்யோ நம:</div>
          <div class="t1">ஆதிகுரு ஸ்ரீப்ரஜ்ஞா தக்ஷிணாமூர்த்தி வித்யாபீடம் சங்கல்ப படிவம்</div>
          <div class="t2">பூஜா காணிக்கை ஸமர்ப்பணம்</div>
        </div>
        <div class="logo"></div>
      </div>
    </td></tr>
    <tr class="row1"><td class="l">பெயர்:</td><td colspan="5" class="v big">${esc(f.name)}</td></tr>
    <tr class="row2"><td class="l">முகவரி:</td><td colspan="4" class="v">${esc(f.address)}</td><td class="v"><div class="l2">அலைபேசி எண்:</div><div class="big">${esc(f.phone)}</div></td></tr>
    <tr class="row3"><td class="l">நன்கொடை ரு:</td><td colspan="2" class="v big">${esc(money(f.amount))}</td><td colspan="2" class="v"><span class="l2 in">ரசீது எண்:</span> <span class="big">${esc(f.receiptNo)}</span></td><td class="v"><span class="l2 in">தேதி:</span> <span class="big">${esc(dmy(f.date))}</span></td></tr>
    <tr class="row4"><td class="l">பூஜை நாள்</td><td class="v big">${esc(dmy(f.poojaDate))}</td><td class="l">பூஜை விபரம்</td><td colspan="3" class="v big">${esc(f.poojaDetails)}</td></tr>
    ${f.panchangam ? `<tr class="row5"><td class="l">பஞ்சாங்கம்</td><td colspan="5" class="v">${esc(f.panchangam)}</td></tr>` : ''}
    <tr class="th"><td class="c">வ.எண்</td><td class="c">ஊர் பெயர்</td><td class="c">கோத்ரம்</td><td class="c">நக்ஷத்ரம்</td><td class="c">ராசி</td><td class="c">பெயர்</td></tr>
    ${people}
    <tr class="foot"><td class="l">தேதி:</td><td></td><td class="l">கையொப்பம்:</td><td colspan="3"></td></tr>
  </table>
</section>`;
}

// One page for each form. With autoPrint the page prints itself as soon as it has loaded.
export function sankalpaHtml(forms: FormData[], sealUrl = '', autoPrint = true): string {
  return `<!doctype html><html lang="ta"><head><meta charset="utf-8"><title>சங்கல்ப படிவம்</title><style>
  @page{size:A4 landscape;margin:8mm}
  *{box-sizing:border-box}
  body{margin:0;font-family:"Noto Sans Tamil","Latha","Nirmala UI","Tamil Sangam MN",Arial,sans-serif;color:#1b1b1b;background:#fff}
  .sheet{width:100%;page-break-after:always;break-after:page}
  .sheet:last-child{page-break-after:auto;break-after:auto}
  table.f{width:100%;border-collapse:collapse;border:2.5px solid #e2552b;table-layout:fixed}
  table.f td{border:1.6px solid #e2552b;padding:5px 9px;vertical-align:middle;font-size:14px;word-wrap:break-word;overflow-wrap:anywhere}
  .head td{padding:6px 10px;border-bottom:1.6px solid #e2552b}
  .hd{display:flex;align-items:center;gap:10px}
  .logo{flex:0 0 78px;height:78px;display:flex;align-items:center;justify-content:center}
  .logo img{max-width:78px;max-height:78px}
  .ti{flex:1;text-align:center}
  .om{font-size:19px;font-weight:700;color:#4a2a86}
  .gu{font-size:16px;font-weight:700;color:#4a2a86;margin-bottom:3px}
  .t1{font-size:19px;font-weight:700;color:#222;border-top:1.6px solid #e2552b;border-bottom:1.6px solid #e2552b;padding:3px 6px;margin:2px 0}
  .t2{font-size:17px;font-weight:700;color:#a0206e}
  table.f td.l{font-weight:700;font-size:16px;color:#222}
  table.f .l2{font-weight:700;font-size:15px;color:#222}
  table.f td.v{font-size:16px}
  table.f .big{font-size:18px}
  .row5 td{height:36px}.row1 td{height:42px}.row2 td{height:78px;vertical-align:top}.row3 td,.row4 td{height:40px}
  .row2 td.l{vertical-align:middle}.row2 td.v:last-child{text-align:center}
  table.f .th td{font-weight:700;font-size:15px;text-align:center;height:36px}
  table.f tr.r td{height:46px;font-size:16px}
  table.f td.c{text-align:center}table.f td.n{font-weight:700}
  .foot td{height:50px}
  @media print{.sheet{break-inside:avoid}}
  </style></head><body>${forms.map((f) => oneForm(f, sealUrl)).join('')}
  ${autoPrint ? "<script>window.addEventListener('load',function(){setTimeout(function(){window.focus();window.print()},250)})</script>" : ''}
  </body></html>`;
}

// Prints a page of HTML from this same page: it is loaded into a hidden frame and the browser's print dialog opens over the current page.
// Returns false when the frame could not be made.
export function printHtml(html: string): boolean {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  const win = frame.contentWindow;
  const doc = win?.document;
  if (!win || !doc) { frame.remove(); return false; }
  let done = false;
  const cleanup = () => { if (frame.parentNode) frame.remove(); };
  const go = () => {
    if (done) return;
    done = true;
    try { win.focus(); win.onafterprint = () => setTimeout(cleanup, 500); win.print(); } catch { cleanup(); }
    setTimeout(cleanup, 5 * 60_000);
  };
  frame.addEventListener('load', () => setTimeout(go, 250));
  doc.open();
  doc.write(html);
  doc.close();
  // Some browsers do not send the load event for a written page
  setTimeout(go, 1500);
  return true;
}

// Prints the forms from this page, one sheet for each. Returns false when the page could not be prepared for printing.
export async function printForms(forms: FormData[], sealUrl = ''): Promise<boolean> {
  const url = sealUrl ? new URL(sealUrl, window.location.href).href : '';
  // The Panchangam Manager's entry is read for each pooja date; if there is none, or the lookup fails, the form is still printed without it
  const full = await Promise.all(forms.map(async (f) => {
    if (f.panchangam || !f.poojaDate) return f;
    try { const p = await fetchPanchangam(f.poojaDate); return p ? { ...f, panchangam: tamilLine(p) } : f; } catch { return f; }
  }));
  return printHtml(sankalpaHtml(full, url, false));
}