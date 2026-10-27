'use client';

import { useState } from 'react';
import ChoiceField from '@/components/sevas/ChoiceField';
import { MAX_FAMILY, NAKSHATRAMS, RASIS, RELATIONS, labelFor, type FamilyMember } from '@/data/sankalpam';
import { updateAccount, type Account } from '@/lib/authDemo';
import type { Locale } from '@/lib/i18n';
import { card, Empty, ghost, Heading, input, primary, type A, type T } from './ui';

const BLANK: FamilyMember = { name: '', relation: '', rasi: '', nakshatram: '' };

export default function Family({ t, a, locale, acc, onSaved }: { t: T; a: A; locale: Locale; acc: Account; onSaved: () => void }) {
  const list = acc.family ?? [];
  const [editing, setEditing] = useState<number | null>(null);   // index, or list.length for a new member
  const [draft, setDraft] = useState<FamilyMember>(BLANK);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<number | null>(null);

  const persist = (family: FamilyMember[]) => { updateAccount({ ...acc, family }); onSaved(); };
  const start = (i: number) => { setEditing(i); setDraft(i < list.length ? list[i] : BLANK); setError(''); setConfirm(null); };
  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) { setError(t.errMemberName); return; }
    if (!draft.relation) { setError(t.errRelation); return; }
    const m = { ...draft, name: draft.name.trim() };
    persist(editing !== null && editing < list.length ? list.map((x, i) => (i === editing ? m : x)) : [...list, m]);
    setEditing(null);
  }
  const choice = { locale, placeholder: a.select, otherLabel: a.other, typeLabel: a.typeHere } as const;

  return (
    <div>
      <Heading id="sec-title" title={t.familyTitle} text={t.familyText}>
        {editing === null && list.length < MAX_FAMILY && <button type="button" onClick={() => start(list.length)} className={primary}>+ {t.addMember}</button>}
      </Heading>

      {list.length === 0 && editing === null && (
        <Empty title={t.familyEmpty} text={t.familyEmptyText}><button type="button" onClick={() => start(0)} className={primary}>+ {t.addMember}</button></Empty>
      )}

      {list.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2">
          {list.map((m, i) => (
            <li key={`${m.name}-${i}`} className={card}>
              <p className="font-display text-2xl font-semibold text-maroon">{m.name}</p>
              <p className="text-sm font-bold text-saffron">{labelFor(RELATIONS, m.relation, locale)}</p>
              <dl className="mt-2 space-y-0.5 text-sm text-charcoal/85">
                <div><dt className="inline font-bold">{a.rasi}:</dt> <dd className="inline">{m.rasi ? labelFor(RASIS, m.rasi, locale) : '—'}</dd></div>
                <div><dt className="inline font-bold">{a.nakshatram}:</dt> <dd className="inline">{m.nakshatram ? labelFor(NAKSHATRAMS, m.nakshatram, locale) : '—'}</dd></div>
              </dl>
              <div className="mt-3 flex gap-4 text-sm font-semibold">
                <button type="button" onClick={() => start(i)} className="text-maroon underline underline-offset-4">{t.edit}</button>
                {confirm === i ? (
                  <button type="button" onClick={() => { persist(list.filter((_, j) => j !== i)); setConfirm(null); }} className="text-red-700 underline underline-offset-4">{t.confirmRemove}</button>
                ) : (
                  <button type="button" onClick={() => setConfirm(i)} className="text-charcoal/70 underline underline-offset-4">{t.remove}</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing !== null && (
        <form noValidate onSubmit={save} className={`${card} mt-5`} aria-label={t.memberForm}>
          <h3 className="font-display text-2xl font-semibold text-maroon">{editing < list.length ? t.editMember : t.addMember}</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="fm-name" className="mb-1 block text-sm font-bold text-charcoal">{t.memberName} *</label>
              <input id="fm-name" value={draft.name} onChange={(e) => { setDraft({ ...draft, name: e.target.value }); setError(''); }} className={input} />
            </div>
            <ChoiceField id="fm-rel" label={`${t.relation} *`} value={draft.relation} onChange={(v) => { setDraft({ ...draft, relation: v }); setError(''); }} options={RELATIONS} {...choice} />
            <ChoiceField id="fm-rasi" label={a.rasi} value={draft.rasi} onChange={(v) => setDraft({ ...draft, rasi: v })} options={RASIS} {...choice} />
            <ChoiceField id="fm-nak" label={a.nakshatram} value={draft.nakshatram} onChange={(v) => setDraft({ ...draft, nakshatram: v })} options={NAKSHATRAMS} {...choice} />
          </div>
          {error && <p role="alert" className="mt-3 text-sm font-semibold text-maroon">{error}</p>}
          <div className="mt-5 flex gap-3">
            <button type="submit" className={primary}>{t.save}</button>
            <button type="button" onClick={() => setEditing(null)} className={ghost}>{t.cancel}</button>
          </div>
        </form>
      )}
      {list.length >= MAX_FAMILY && editing === null && <p className="mt-4 text-sm text-charcoal/70">{t.familyMax.replace('{n}', String(MAX_FAMILY))}</p>}
    </div>
  );
}
