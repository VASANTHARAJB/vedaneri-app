// DEMO: reads what this browser has saved (orders, camp registrations) and groups it for the profile page.
// With the backend, these become API calls that return the signed-in devotee's own records.

import type { CartLine, Order } from '@/components/cart/CartProvider';
import { streamOf } from '@/lib/cartItem';
import { getPlan, type Plan } from '@/data/magazine';
import { normPhone, type Account } from '@/lib/authDemo';

const KEY_ORDERS = 'vedaneri.orders.v1';
const KEY_LAST = 'vedaneri.order.v1';
const KEY_CAMPS = 'vedaneri.campreg.v1';

function read<T>(key: string, fallback: T): T {
  try { const r = window.localStorage.getItem(key); return r ? (JSON.parse(r) as T) : fallback; } catch { return fallback; }
}
function write(key: string, v: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ }
}

export type CampReg = { ref: string; camp: string; at: string; name?: string; phone?: string; email?: string; accom?: string };

const allOrders = (): Order[] => {
  const list = read<Order[]>(KEY_ORDERS, []);
  const last = read<Order | null>(KEY_LAST, null);
  if (last && !list.some((o) => o.id === last.id)) list.push(last);   // an order made before the history existed
  return list;
};

const mine = (a: Account, o: Order) =>
  o.accountId === a.id ||
  (!!o.contact?.email && o.contact.email.toLowerCase() === a.email.toLowerCase()) ||
  (!!o.contact?.phone && normPhone(o.contact.phone) === a.phone);

export const ordersFor = (a: Account) => allOrders().filter((o) => mine(a, o)).sort((x, y) => y.placedAt.localeCompare(x.placedAt));

export const campRegsFor = (a: Account) =>
  read<CampReg[]>(KEY_CAMPS, [])
    .filter((r) => (r.email && r.email.toLowerCase() === a.email.toLowerCase()) || (r.phone && normPhone(r.phone) === a.phone))
    .sort((x, y) => y.at.localeCompare(x.at));

// Account deletion: names, phone, email and addresses are wiped from the account's orders; the amounts and ids stay for the books.
export function eraseAccountData(a: Account) {
  const orders = read<Order[]>(KEY_ORDERS, []).map((o) =>
    mine(a, o)
      ? { ...o, accountId: undefined, contact: { name: '', phone: '', email: '', address: '', city: '', state: '', pin: '', country: '' }, lines: o.lines.map((l) => ({ ...l, devotee: '', gotram: '', nakshatram: '', rasi: '', family: [], ship: undefined })) }
      : o,
  );
  write(KEY_ORDERS, orders);
  const last = read<Order | null>(KEY_LAST, null);
  if (last && mine(a, last)) { try { window.localStorage.removeItem(KEY_LAST); } catch { /* ignore */ } }
  write(KEY_CAMPS, read<CampReg[]>(KEY_CAMPS, []).filter((r) => !((r.email && r.email.toLowerCase() === a.email.toLowerCase()) || (r.phone && normPhone(r.phone) === a.phone))));
}

export type Entry = { order: Order; line: CartLine };
const entries = (orders: Order[]): Entry[] => orders.flatMap((order) => order.lines.map((line) => ({ order, line })));

export const sevaEntries = (orders: Order[]) => entries(orders).filter((e) => streamOf(e.line) === 'seva');
export const donationEntries = (orders: Order[]) => entries(orders).filter((e) => streamOf(e.line) === 'donation' && !getPlan(e.line.slug));
export const subscriptionEntries = (orders: Order[]) => entries(orders).filter((e) => streamOf(e.line) === 'donation' && !!getPlan(e.line.slug));

// Subscription period: from the day it was bought for `years` years
export function subscriptionPeriod(e: Entry) {
  const plan = getPlan(e.line.slug) as Plan;
  const start = new Date(e.order.placedAt);
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + plan.years);
  return { plan, start, end, active: end.getTime() > Date.now() };
}

export const orderKind = (o: Order): 'seva' | 'donation' | 'subscription' =>
  streamOf(o) === 'seva' ? 'seva' : o.lines.length > 0 && o.lines.every((l) => !!getPlan(l.slug)) ? 'subscription' : 'donation';

// "2026-10-25" is in the future (or today)?
export const isUpcoming = (iso: string) => !!iso && iso >= new Date().toISOString().slice(0, 10);
