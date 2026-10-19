import Link from 'next/link';

type Crumb = { label: string; href?: string };

// Title band for the cart, checkout, payment and confirmation pages, with the 4-step progress bar
export default function ShopHero({
  title,
  crumbs,
  crumbLabel,
  steps,
  current,
}: {
  title: string;
  crumbs: Crumb[];
  crumbLabel: string;
  steps?: string[];
  current?: number; // 0-based index of the step the visitor is on
}) {
  return (
    <section className="bg-gradient-to-b from-rose/80 to-white">
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-6 lg:px-8">
        <nav aria-label={crumbLabel} className="text-sm text-charcoal/80">
          <ol className="flex flex-wrap items-center gap-2">
            {crumbs.map((c, i) => (
              <li key={c.label} className="flex items-center gap-2">
                {i > 0 && <span aria-hidden="true">/</span>}
                {c.href ? (
                  <Link href={c.href} className="underline-offset-4 hover:text-maroon hover:underline">{c.label}</Link>
                ) : (
                  <span aria-current="page" className="font-semibold text-maroon">{c.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <h1 className="mt-4 font-display text-4xl font-semibold leading-tight text-maroon sm:text-5xl [html[lang='ta']_&]:!leading-[1.3] [html[lang='ta']_&]:text-3xl [html[lang='ta']_&]:sm:text-4xl">{title}</h1>

        {steps && current !== undefined && (
          <ol className="mt-6 flex items-center gap-2 sm:gap-3">
            {steps.map((s, i) => {
              const done = i < current;
              const on = i === current;
              return (
                <li key={s} aria-current={on ? 'step' : undefined} className="flex flex-1 items-center gap-2 sm:flex-none sm:gap-3">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${on ? 'bg-maroon text-white ring-4 ring-saffron/50' : done ? 'bg-saffron text-charcoal' : 'bg-white text-charcoal/60 ring-1 ring-rose'}`}>
                    {done ? '✓' : i + 1}
                  </span>
                  <span className={`hidden text-sm font-semibold sm:inline ${on ? 'text-maroon' : 'text-charcoal/70'}`}>{s}</span>
                  {i < steps.length - 1 && <span aria-hidden="true" className={`h-0.5 flex-1 sm:w-12 sm:flex-none ${done ? 'bg-saffron' : 'bg-rose'}`} />}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
