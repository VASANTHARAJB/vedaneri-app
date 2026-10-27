'use client';

import React, { useState, useEffect } from 'react';

export interface ChoiceOption {
  label: string;
  value: string;
}

export interface ChoiceFieldProps {
  label?: string;
  id?: string;
  name?: string;
  value?: string;
  onChange?: ((value: string) => void) | React.ChangeEventHandler<HTMLSelectElement | HTMLInputElement>;
  options?: readonly (string | ChoiceOption)[] | (string | ChoiceOption)[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  error?: string;
  hint?: string;
  allowOther?: boolean;
}

const SELECT_CLASS =
  'h-12 w-full rounded-xl border border-[#e8dcc6] bg-white px-3.5 text-sm font-medium text-charcoal focus:border-saffron focus:outline-none focus:ring-2 focus:ring-saffron/30 disabled:bg-sand/20 disabled:cursor-not-allowed';

const INPUT_CLASS =
  'mt-2 h-11 w-full rounded-xl border border-saffron bg-[#fffdfa] px-3.5 text-sm font-semibold text-maroon placeholder:text-charcoal/40 focus:border-maroon focus:outline-none focus:ring-2 focus:ring-maroon/20';

export default function ChoiceField({
  label,
  id,
  name,
  value = '',
  onChange,
  options = [],
  placeholder = '-- Select --',
  required = false,
  disabled = false,
  className = '',
  error,
  hint,
  allowOther = true,
}: ChoiceFieldProps) {
  // Normalize options to { label, value }
  const normalizedOptions: ChoiceOption[] = options.map((opt) => {
    if (typeof opt === 'string') {
      return { label: opt, value: opt };
    }
    return opt;
  });

  // Check if option list already has an "Other" option
  const hasOtherInOptions = normalizedOptions.some(
    (o) => o.value.toLowerCase() === 'other' || o.label.toLowerCase().includes('other')
  );

  if (allowOther && !hasOtherInOptions) {
    normalizedOptions.push({ label: 'Other (மற்றவை)', value: 'Other' });
  }

  // Determine if current value is in predefined list
  const isPreset = normalizedOptions.some((o) => o.value === value);
  const isOtherSelected = value === 'Other' || (!isPreset && Boolean(value));

  const [selectedPreset, setSelectedPreset] = useState<string>(() => {
    if (isPreset) return value;
    if (value) return 'Other';
    return '';
  });

  const [customText, setCustomText] = useState<string>(() => {
    if (!isPreset && value) return value;
    return '';
  });

  useEffect(() => {
    if (isPreset) {
      setSelectedPreset(value);
      setCustomText('');
    } else if (value) {
      setSelectedPreset('Other');
      setCustomText(value);
    } else {
      setSelectedPreset('');
      setCustomText('');
    }
  }, [value, isPreset]);

  // Dual-compatible change emitter: works with (val: string) => void OR (e: ChangeEvent) => void
  const emitChange = (newVal: string) => {
    if (!onChange) return;

    // Create a String object with target properties to satisfy event consumers (e.target.value)
    const hybridValue: any = new String(newVal);
    hybridValue.target = { value: newVal, name: name || id };
    hybridValue.currentTarget = { value: newVal, name: name || id };

    (onChange as any)(hybridValue);
  };

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedPreset(val);

    if (val === 'Other') {
      emitChange(customText || 'Other');
    } else {
      setCustomText('');
      emitChange(val);
    }
  };

  const handleCustomInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomText(val);
    emitChange(val);
  };

  const inputId = id || name || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label htmlFor={inputId} className="block text-xs font-bold uppercase tracking-wider text-charcoal">
          {label} {required && <span className="text-rose-600">*</span>}
        </label>
      )}

      <select
        id={inputId}
        name={name}
        value={selectedPreset}
        onChange={handleSelect}
        required={required && !isOtherSelected}
        disabled={disabled}
        className={SELECT_CLASS}
      >
        <option value="">{placeholder}</option>
        {normalizedOptions.map((opt, i) => (
          <option key={`${opt.value}-${i}`} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Manual Entry field when 'Other' is active */}
      {allowOther && selectedPreset === 'Other' && (
        <input
          type="text"
          value={customText}
          onChange={handleCustomInput}
          required={required}
          placeholder="Type custom entry (கையேடு உள்ளீடு)..."
          className={INPUT_CLASS}
        />
      )}

      {hint && !error && <p className="text-[11px] text-charcoal/60">{hint}</p>}
      {error && <p className="text-[11px] font-semibold text-rose-600">{error}</p>}
    </div>
  );
}