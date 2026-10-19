'use client';

// The cart lives in the browser (localStorage) while the site is UI-only.
// When the backend is ready, replace the read/write calls below with API calls.

import type { FamilyMember } from '@/data/sankalpam';
import { streamOf, type Stream } from '@/lib/cartItem';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Shipping = { phone: string; address: string; district: string; pin: string; renew: boolean };

export type CartLine = {
  id: string;
  stream?: Stream;    // 'seva' (default, also for lines saved earlier) or 'donation'
  slug: string;
  qty: number;
  unit: number;       // amount for one, in rupees
  date: string;       // YYYY-MM-DD (empty for donations)
  devotee: string;    // devotee name for a seva, donor name for a donation
  gotram: string;
  nakshatram: string;
  rasi?: string;                 // moon sign (optional, added with the sankalpam form)
  family?: FamilyMember[];       // family members named in the sankalpam
  ship?: Shipping;               // delivery address, for magazine subscriptions
};

export type Contact = { name: string; phone: string; email: string; address: string; city: string; state: string; pin: string; country: string };
export const EMPTY_CONTACT: Contact = { name: '', phone: '', email: '', address: '', city: '', state: '', pin: '', country: 'India' };

export type Order = { id: string; stream: Stream; placedAt: string; lines: CartLine[]; total: number; contact: Contact; method: string };

const KEY_CART = 'vedaneri.cart.v1';
const KEY_CONTACT = 'vedaneri.contact.v1';
const KEY_ORDER = 'vedaneri.order.v1';

// Browser storage can be blocked or empty (private windows), so every call is wrapped.
function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

type CartContextValue = {
  ready: boolean;                 // false until the saved cart has been read
  lines: CartLine[];
  count: number;                  // number of items in the whole cart (quantities added up)
  total: number;                  // all lines together
  linesOf: (stream: Stream) => CartLine[];
  totalOf: (stream: Stream) => number;
  add: (line: Omit<CartLine, 'id'>) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  contact: Contact;
  saveContact: (c: Contact) => void;
  order: Order | null;            // the last paid order
  placeOrder: (method: string, stream: Stream) => Order | null;  // pays one section only
};

const CartContext = createContext<CartContextValue | null>(null);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}

export default function CartProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [contact, setContact] = useState<Contact>(EMPTY_CONTACT);
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    setLines(read<CartLine[]>(KEY_CART, []));
    setContact({ ...EMPTY_CONTACT, ...read<Partial<Contact>>(KEY_CONTACT, {}) });
    setOrder(read<Order | null>(KEY_ORDER, null));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    write(KEY_CART, lines);
    write(KEY_CONTACT, contact);
    write(KEY_ORDER, order);
  }, [ready, lines, contact, order]);

  const add = useCallback((line: Omit<CartLine, 'id'>) => {
    const id = `${line.slug}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    setLines((l) => [...l, { ...line, id }]);
  }, []);

  const setQty = useCallback((id: string, qty: number) => {
    setLines((l) => l.map((x) => (x.id === id ? { ...x, qty } : x)));
  }, []);

  const remove = useCallback((id: string) => setLines((l) => l.filter((x) => x.id !== id)), []);

  const saveContact = useCallback((c: Contact) => setContact(c), []);

  const total = useMemo(() => lines.reduce((s, l) => s + l.unit * l.qty, 0), [lines]);
  const count = useMemo(() => lines.reduce((s, l) => s + l.qty, 0), [lines]);

  const linesOf = useCallback((stream: Stream) => lines.filter((l) => streamOf(l) === stream), [lines]);
  const totalOf = useCallback((stream: Stream) => linesOf(stream).reduce((s, l) => s + l.unit * l.qty, 0), [linesOf]);

  // Pays one section (sevas or donations); the other section stays in the cart
  const placeOrder = useCallback(
    (method: string, stream: Stream) => {
      const mine = lines.filter((l) => streamOf(l) === stream);
      if (mine.length === 0) return null;
      const d = new Date();
      const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
      const o: Order = {
        id: `VN-${stream === 'donation' ? 'D' : 'S'}-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`,
        stream,
        placedAt: d.toISOString(),
        lines: mine,
        total: mine.reduce((s, l) => s + l.unit * l.qty, 0),
        contact,
        method,
      };
      setOrder(o);
      setLines((all) => all.filter((l) => streamOf(l) !== stream));
      return o;
    },
    [lines, contact],
  );

  const value = useMemo<CartContextValue>(
    () => ({ ready, lines, count, total, linesOf, totalOf, add, setQty, remove, contact, saveContact, order, placeOrder }),
    [ready, lines, count, total, linesOf, totalOf, add, setQty, remove, contact, saveContact, order, placeOrder],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
