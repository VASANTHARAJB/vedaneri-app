type Props = { title: string; subtitle?: string; id?: string; align?: 'center' | 'left' };

function Lamp() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="shrink-0 text-saffron">
      <path d="M12 2c.6 3.2 4.5 5.4 4.5 10a4.5 4.5 0 0 1-9 0c0-2 .9-3.2 1.8-4.4.4 1.2 1 1.8 1.7 2C11.3 7.7 11.6 5 12 2z" />
    </svg>
  );
}

// Section heading with a small golden lamp ornament.
export default function SectionTitle({ title, subtitle, id, align = 'center' }: Props) {
  const center = align === 'center';
  return (
    <div className={center ? 'mx-auto max-w-2xl text-center' : ''}>
      <h2 id={id} className="font-display text-4xl font-semibold sm:text-5xl">{title}</h2>
      <div aria-hidden="true" className={`mt-4 flex items-center gap-3 ${center ? 'justify-center' : ''}`}>
        <span className="h-px w-10 bg-saffron" />
        <Lamp />
        <span className="h-px w-10 bg-saffron" />
      </div>
      {subtitle && <p className="mt-4 text-charcoal/85">{subtitle}</p>}
    </div>
  );
}
