'use client';

import { useState } from 'react';
import type { Locale } from '@/lib/i18n';
import type { L } from '@/data/sevas';

const OTHER = '__other__';

export const fieldClass =
  'w-full rounded-md border border-rose bg-rose/30 px-3 py-2.5 text-charcoal placeholder:text-charcoal/50 focus:border-saffron focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40';

type Props = {
  id: string;
  label: string;
  value: string;                 // the saved value: a list item's English name, or the typed text
  onChange: (value: string) => void;
  options: L[];
  locale: Locale;
  placeholder: string;           // first option, e.g. "Select"
  otherLabel: string;            // last option, e.g. "Other (type manually)"
  typeLabel: string;             // label of the text box, e.g. "Type here"
  error?: string;
};

// A list to choose from, with a last option "Other" that opens a text box for typing a value by hand
export default function ChoiceField({ id, label, value, onChange, options, locale, placeholder, otherLabel, typeLabel, error }: Props) {
  const known = options.some((o) => o.en === value);
  const [manual, setManual] = useState(false);
  const showManual = manual || (value !== '' && !known); // a typed value that was saved earlier opens the text box too
  const selectValue = showManual ? OTHER : value;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold text-charcoal">{label}</label>
      <select
        id={id}
        value={selectValue}
        onChange={(e) => {
          if (e.target.value === OTHER) {
            setManual(true);
            onChange('');
          } else {
            setManual(false);
            onChange(e.target.value);
          }
        }}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${fieldClass} mt-1`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.en} value={o.en}>{o[locale]}</option>
        ))}
        <option value={OTHER}>{otherLabel}</option>
      </select>

      {showManual && (
        <input
          id={`${id}-other`}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={typeLabel}
          aria-label={`${label}: ${typeLabel}`}
          autoComplete="off"
          className={`${fieldClass} mt-2`}
        />
      )}
      {error && <p id={`${id}-error`} role="alert" className="mt-1 text-sm font-semibold text-maroon">{error}</p>}
    </div>
  );
}
