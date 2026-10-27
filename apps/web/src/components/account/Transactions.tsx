'use client';

import { useRef, useState } from 'react';
import type { Order } from '@/components/cart/CartProvider';
import { orderKind } from '@/lib/accountData';
import { itemInfo, streamOf } from '@/lib/cartItem';
import { rupees } from '@/lib/format';
import type { Locale } from '@/lib/i18n';
import { Badge, card, Empty, ghost, Heading, primary, when, type T } from './ui';
import type { Dictionary } from '@/lib/dictionary';

type Filter = 'all' | 'seva' | 'donation' | 'subscription';

const PRINT_CSS = `@media print { body * { visibility: hidden !important; } .receipt, .receipt * { visibility: visible !important; } .receipt { position: absolute; inset: 0; margin: 0; padding: 24px; box-shadow: none !important; } .no-print { display: none !important; } }`;

export default function Transactions({ t, shop, locale, orders, siteName }: { t: T; shop: Dictionary['shop']; locale: Locale; orders: Order[]; siteName: string }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Order | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);

  const list = orders.filter((o) => filter === 'all' || orderKind(o) === filter);
  const total = list.reduce((s, o) => s + o.total, 0);
  const methodLabel = (k: string) => shop.methods.find((m) => m.key === k)?.label ?? k;
  const chips: Filter[] = ['all', 'seva', 'donation', 'subscription'];

  function show(o: Order) { setReceipt(o); requestAnimationFrame(() => dlg.current?.showModal()); }

  return (
    <div>
      <Heading id="sec-title" title={t.historyTitle} text={t.historyText} />
      {orders.length === 0 ? (
        <Empty title={t.historyEmpty} text={t.historyEmptyText} />
      ) : (
        <>
          <div role="group" aria-label={t.filterLabel} className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <button key={c} type="button" aria-pressed={filter === c} onClick={() => setFilter(c)} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-saffron ${filter === c ? 'bg-maroon text-white' : 'bg-white text-maroon ring-1 ring-rose hover:bg-rose'}`}>{c === 'all' ? t.all : t.kinds[c]}</button>
            ))}
          </div>
          <p className="mt-3 text-sm text-charcoal/80" aria-live="polite">{list.length} {t.transactions} · {t.total}: <strong className="text-maroon">{rupees(total)}</strong></p>

          <ul className="mt-4 space-y-3">
            {list.map((o) => {
              const isOpen = open === o.id;
              return (
                <li key={o.id} className={card}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="flex flex-wrap items-center gap-2"><span className="font-display text-xl font-semibold text-maroon">{t.kinds[orderKind(o)]}</span><Badge tone="saffron">{t.demoPaid}</Badge></p>
                      <p className="text-sm text-charcoal/75"><span className="tabular-nums">{o.id}</span> · {when(o.placedAt, locale)} · {methodLabel(o.method)}</p>
                    </div>
                    <p className="font-display text-3xl font-semibold text-maroon">{rupees(o.total)}</p>
                  </div>
                  <div className="mt-2 flex gap-4 text-sm font-semibold">
                    <button type="button" aria-expanded={isOpen} aria-controls={`o-${o.id}`} onClick={() => setOpen(isOpen ? null : o.id)} className="text-maroon underline underline-offset-4">{isOpen ? t.hideItems : t.showItems}</button>
                    <button type="button" onClick={() => show(o)} className="text-maroon underline underline-offset-4">{t.receipt}</button>
                  </div>
                  {isOpen && (
                    <ul id={`o-${o.id}`} className="mt-3 divide-y divide-rose rounded-md bg-rose/40 px-3">
                      {o.lines.map((l) => (
                        <li key={l.id} className="flex justify-between gap-3 py-2 text-sm"><span>{itemInfo(streamOf(l), l.slug, locale).name}{l.qty > 1 ? ` × ${l.qty}` : ''}{l.devotee ? ` · ${l.devotee}` : ''}</span><span className="shrink-0 font-bold">{rupees(l.unit * l.qty)}</span></li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <style>{PRINT_CSS}</style>
      <dialog ref={dlg} onClose={() => setReceipt(null)} aria-labelledby="rc-title" className="w-[min(92vw,34rem)] rounded-2xl p-0 backdrop:bg-charcoal/60">
        {receipt && (
          <div className="receipt bg-white p-6">
            <h3 id="rc-title" className="font-display text-2xl font-semibold text-maroon">{t.receiptTitle}</h3>
            <p className="text-sm font-bold text-charcoal">{siteName}</p>
            <p className="mt-3 text-sm"><strong>{t.orderId}:</strong> <span className="tabular-nums">{receipt.id}</span></p>
            <p className="text-sm"><strong>{t.date}:</strong> {when(receipt.placedAt, locale)}</p>
            <p className="text-sm"><strong>{t.method}:</strong> {methodLabel(receipt.method)}</p>
            <table className="mt-4 w-full text-sm">
              <tbody>
                {receipt.lines.map((l) => (
                  <tr key={l.id} className="border-b border-rose align-top"><td className="py-1.5 pr-2">{itemInfo(streamOf(l), l.slug, locale).name}{l.qty > 1 ? ` × ${l.qty}` : ''}</td><td className="py-1.5 text-right font-bold">{rupees(l.unit * l.qty)}</td></tr>
                ))}
                <tr><td className="pt-2 font-bold">{t.total}</td><td className="pt-2 text-right font-display text-2xl font-semibold text-maroon">{rupees(receipt.total)}</td></tr>
              </tbody>
            </table>
            <p className="mt-4 rounded-md bg-saffron/15 p-3 text-xs text-charcoal">{t.receiptNote}</p>
            <div className="no-print mt-4 flex gap-3">
              <button type="button" onClick={() => window.print()} className={primary}>{t.print}</button>
              <button type="button" onClick={() => dlg.current?.close()} className={ghost}>{t.close}</button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
