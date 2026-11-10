import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { getDictionary } from '@/lib/dictionary';
import { isLocale, type Locale } from '@/lib/i18n';
import { SITE } from '@/lib/site';

type Params = { params: Promise<{ locale: string }> };

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const FILES = API_BASE.replace(/\/api\/v1\/?$/, '');
const PAGE_URL = `${API_BASE}/accommodation/page`;

type Bi = { en?: string; ta?: string };

// Photos in apps/web/public/images/ are the default. A photo uploaded in the CMS (Accommodation) replaces it.
const PHOTO = { stay: '/images/ashram-vilasa.jpg', food: '/images/ashram-dining.jpg', setting: '/images/ashram-river.jpg' };

// Words for this page are kept here, so the dictionary files need no change.
// Room types, charges and capacity are NOT shown, because they have not been supplied. Add them in the "details" list when you have them.
const TEXT: Record<Locale, {
  meta: string; metaText: string; crumb: string; title: string; lead: string;
  stayTag: string; stayTitle: string; stayText: string; stayName: string;
  foodTag: string; foodTitle: string; foodText: string;
  setTag: string; setTitle: string; setText: string;
  detailsTitle: string; detailsLead: string; details: { label: string; text: string }[];
  stepsTitle: string; steps: { title: string; text: string }[];
  campCta: string; callCta: string; writeCta: string; ctaTitle: string; ctaText: string;
}> = {
  en: {
    meta: 'Accommodation', metaText: 'Stay at Sri Swami Chidbhavananda Ashramam, Vedapuri, Theni: simple, clean accommodation and food for devotees.',
    crumb: 'Breadcrumb', title: 'Stay at the Ashram', lead: 'Clean, comfortable accommodation and food for devotees, in the quiet of the Western Ghats.',
    stayTag: 'Accommodation', stayTitle: 'A place to rest and reflect', stayName: 'Sri Bharati Tirtha Vidyarthi Vilasa',
    stayText: 'The ashram provides hygienic and comfortable accommodation for devotees. Stay for a camp, a festival, a seva or a quiet retreat.',
    foodTag: 'Food for devotees', foodTitle: 'Meals in the Annalakshmi Dining Hall', foodText: 'Food for devotees is served at the ashram dining hall, so you can spend your time on prayer and study.',
    setTag: 'The setting', setTitle: 'In the lap of the Western Ghats', setText: 'The ashram lies near the Surabhi Saraswati river. The setting suits contemplation, meditation and prayer.',
    detailsTitle: 'Rooms and charges', detailsLead: 'Rooms depend on the dates, so the ashram confirms them with you directly.',
    details: [
      { label: 'Rooms and capacity', text: 'Please ask the ashram for the rooms available on your dates.' },
      { label: 'Charges', text: 'Please ask the ashram for the current charges.' },
      { label: 'During a camp', text: 'Camp registration has an option to request accommodation.' },
    ],
    stepsTitle: 'How to request a stay',
    steps: [
      { title: 'Choose your dates', text: 'Decide when you plan to come, and how many people are travelling.' },
      { title: 'Ask the ashram', text: 'Call or write to us with your dates. For a camp, tick the accommodation option when you register.' },
      { title: 'Wait for confirmation', text: 'The ashram confirms the stay with you before you travel.' },
    ],
    ctaTitle: 'Plan your stay', ctaText: 'We will be glad to help you with dates and arrangements.',
    campCta: 'See camps', callCta: 'Call the ashram', writeCta: 'Write to us',
  },
  ta: {
    meta: 'தங்குமிடம்', metaText: 'ஸ்ரீ சுவாமி சித்பவானந்த ஆசிரமம், வேதபுரி, தேனியில் தங்க: பக்தர்களுக்குச் சுகாதாரமான தங்குமிடமும் உணவும்.',
    crumb: 'பாதை', title: 'ஆசிரமத்தில் தங்க', lead: 'மேற்குத் தொடர்ச்சி மலையின் அமைதியில், பக்தர்களுக்குச் சுகாதாரமான, வசதியான தங்குமிடமும் உணவும்.',
    stayTag: 'தங்குமிடம்', stayTitle: 'ஓய்வுக்கும் சிந்தனைக்கும் ஓர் இடம்', stayName: 'ஸ்ரீ பாரதி தீர்த்த வித்யார்த்தி விலாசம்',
    stayText: 'பக்தர்களுக்குச் சுகாதாரமான, வசதியான தங்குமிடத்தை ஆசிரமம் வழங்குகிறது. முகாம், விழா, சேவை அல்லது அமைதியான தியானத்திற்காகத் தங்கலாம்.',
    foodTag: 'பக்தர்களுக்கு உணவு', foodTitle: 'அன்னலட்சுமி உணவுக்கூடத்தில் உணவு', foodText: 'பக்தர்களுக்கான உணவு ஆசிரம உணவுக்கூடத்தில் வழங்கப்படுகிறது; நீங்கள் வழிபாட்டிலும் கற்றலிலும் நேரம் செலவிடலாம்.',
    setTag: 'சூழல்', setTitle: 'மேற்குத் தொடர்ச்சி மலையின் மடியில்', setText: 'ஆசிரமம் சுரபி சரஸ்வதி நதிக்கு அருகில் உள்ளது. சிந்தனை, தியானம், வழிபாட்டிற்கு ஏற்ற சூழல்.',
    detailsTitle: 'அறைகளும் கட்டணமும்', detailsLead: 'அறைகள் தேதியைப் பொறுத்தவை; எனவே ஆசிரமம் உங்களிடம் நேரடியாக உறுதிப்படுத்தும்.',
    details: [
      { label: 'அறைகள், இடவசதி', text: 'உங்கள் தேதிகளில் உள்ள அறைகள் குறித்து ஆசிரமத்தைக் கேளுங்கள்.' },
      { label: 'கட்டணம்', text: 'தற்போதைய கட்டணம் குறித்து ஆசிரமத்தைக் கேளுங்கள்.' },
      { label: 'முகாமின்போது', text: 'முகாம் பதிவில் தங்குமிடம் கோரும் வசதி உள்ளது.' },
    ],
    stepsTitle: 'தங்குமிடம் கோருவது எப்படி',
    steps: [
      { title: 'தேதிகளைத் தேர்ந்தெடுங்கள்', text: 'எப்போது வர உள்ளீர்கள், எத்தனை பேர் என்பதை முடிவு செய்யுங்கள்.' },
      { title: 'ஆசிரமத்தைக் கேளுங்கள்', text: 'தேதிகளுடன் அழையுங்கள் அல்லது எழுதுங்கள். முகாம் என்றால் பதிவின்போது தங்குமிடத் தேர்வைக் குறியிடுங்கள்.' },
      { title: 'உறுதிப்படுத்தலுக்குக் காத்திருங்கள்', text: 'பயணத்திற்கு முன் ஆசிரமம் தங்குமிடத்தை உறுதிப்படுத்தும்.' },
    ],
    ctaTitle: 'உங்கள் தங்குமிடத்தைத் திட்டமிடுங்கள்', ctaText: 'தேதிகள், ஏற்பாடுகளில் உதவ நாங்கள் மகிழ்ச்சியடைவோம்.',
    campCta: 'முகாம்களைப் பார்க்க', callCta: 'ஆசிரமத்தை அழைக்க', writeCta: 'எங்களுக்கு எழுத',
  },
};

// Content saved in the CMS. If the API is down the page still shows the text above, and the reason is printed in the web terminal.
async function loadContent(): Promise<any> {
  try {
    const res = await fetch(PAGE_URL, { cache: 'no-store' });
    if (!res.ok) { console.error(`[accommodation] fetch failed ${res.status} ${PAGE_URL}`); return {}; }
    return (await res.json()).content || {};
  } catch (e: any) {
    console.error(`[accommodation] fetch error ${PAGE_URL}:`, e?.cause?.code || e?.message || e);
    return {};
  }
}

// A link saved in the CMS: a page of this site (/camps), or a web address, mail or phone link.
// Anything else (for example javascript:) is ignored, so a typing mistake cannot break the page.
type Target = { kind: 'page' | 'external'; href: string } | null;
function target(raw: unknown, locale: string, fallback: string): Target {
  const v = typeof raw === 'string' && raw.trim() ? raw.trim() : fallback;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(v)) return { kind: 'external', href: v };
  if (v.startsWith('/') && !v.startsWith('//')) return { kind: 'page', href: v === '/' ? `/${locale}` : `/${locale}${v}` };
  return null;
}

const BI_KEYS = [
  'meta', 'metaText', 'title', 'lead', 'stayTag', 'stayTitle', 'stayName', 'stayText', 'foodTag', 'foodTitle', 'foodText',
  'setTag', 'setTitle', 'setText', 'detailsTitle', 'detailsLead', 'stepsTitle', 'ctaTitle', 'ctaText', 'campCta', 'callCta', 'writeCta',
] as const;

// CMS text when filled in, otherwise the text above
function build(base: (typeof TEXT)[Locale], c: any, locale: Locale) {
  const pick = (x: Bi | undefined, fb: string) => (x && typeof x[locale] === 'string' && x[locale]!.trim() ? x[locale]! : fb);
  const out: any = { ...base };
  for (const k of BI_KEYS) out[k] = pick(c[k], base[k]);
  if (Array.isArray(c.details) && c.details.length > 0) {
    out.details = c.details
      .map((x: any, i: number) => ({ label: pick(x?.label, base.details[i]?.label ?? ''), text: pick(x?.text, base.details[i]?.text ?? '') }))
      .filter((x: { label: string }) => x.label);
  }
  if (Array.isArray(c.steps) && c.steps.length > 0) {
    out.steps = c.steps
      .map((x: any, i: number) => ({ title: pick(x?.title, base.steps[i]?.title ?? ''), text: pick(x?.text, base.steps[i]?.text ?? '') }))
      .filter((x: { title: string }) => x.title);
  }
  // A photo from the CMS lives on the API server; the default ones live in this website
  const photo = (u: unknown, fb: string) => (typeof u === 'string' && u.startsWith('/uploads/') ? { src: `${FILES}${u}`, remote: true } : { src: fb, remote: false });
  out.photos = { stay: photo(c.stayImage, PHOTO.stay), food: photo(c.foodImage, PHOTO.food), setting: photo(c.settingImage, PHOTO.setting) };
  out.campLink = target(c.campLink, locale, '/camps');
  out.writeLink = target(c.writeLink, locale, '/contact');
  return out as (typeof TEXT)[Locale] & { photos: Record<'stay' | 'food' | 'setting', { src: string; remote: boolean }>; campLink: Target; writeLink: Target };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  const t = build(TEXT[locale], await loadContent(), locale);
  return { title: `${t.meta} | ${dict.site.name}`, description: t.metaText };
}

const solid = 'inline-flex items-center justify-center rounded-md bg-saffron px-6 py-3 font-bold text-white shadow-md transition hover:bg-saffron/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-maroon';
const outline = 'inline-flex items-center justify-center rounded-md border-2 border-white px-6 py-3 font-bold text-white transition hover:bg-white hover:text-maroon focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-maroon';
const tag = 'text-xs font-bold uppercase tracking-wider text-saffron [html[lang=\'ta\']_&]:text-sm [html[lang=\'ta\']_&]:tracking-normal';
const h2 = 'font-display text-3xl font-semibold leading-tight text-maroon sm:text-4xl [html[lang=\'ta\']_&]:!leading-[1.3] [html[lang=\'ta\']_&]:text-2xl sm:[html[lang=\'ta\']_&]:text-3xl';

// A button that goes to a page of this site or to another website
function Go({ to, className, children }: { to: Target; className: string; children: ReactNode }) {
  if (!to) return null;
  return to.kind === 'page'
    ? <Link href={to.href} className={className}>{children}</Link>
    : <a href={to.href} className={className} {...(/^https?:/i.test(to.href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{children}</a>;
}

// One photo card: the picture on top, the words below
function Feature({ id, photo, tagText, title, text, name }: { id: string; photo: { src: string; remote: boolean }; tagText: string; title: string; text: string; name?: string }) {
  return (
    <article id={id} className="group flex scroll-mt-24 flex-col overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-rose">
      <div className="relative aspect-[4/3] overflow-hidden bg-rose">
        <Image src={photo.src} unoptimized={photo.remote} alt={name ?? title} fill sizes="(min-width: 1024px) 24rem, (min-width: 640px) 50vw, 100vw" className="object-cover transition duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
        <span className="absolute left-3 top-3 rounded-full bg-maroon/90 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white backdrop-blur [html[lang='ta']_&]:text-sm [html[lang='ta']_&]:tracking-normal">{tagText}</span>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h2 className="font-display text-2xl font-semibold leading-snug text-maroon [html[lang='ta']_&]:!leading-[1.35] [html[lang='ta']_&]:text-xl">{title}</h2>
        {name && <p className="mt-1 font-serif text-base italic text-saffron">{name}</p>}
        <p className="mt-3 text-charcoal/85">{text}</p>
      </div>
    </article>
  );
}

export default async function AccommodationPage({ params }: Params) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const t = build(TEXT[locale], await loadContent(), locale);
  const base = `/${locale}`;
  const phone = SITE.phones[0];
  const chips: [string, string][] = [['stay', t.stayTag], ['food', t.foodTag], ['setting', t.setTag]];

  return (
    <main className="bg-white">
      {/* Top: words only, on a deep maroon background. The photos follow in the cards below. */}
      <section aria-label={t.title} className="relative isolate overflow-hidden bg-gradient-to-br from-maroon via-maroon to-charcoal text-white">
        <div aria-hidden="true" className="absolute -right-24 -top-24 -z-10 h-80 w-80 rounded-full bg-saffron/25 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-32 left-1/3 -z-10 h-72 w-72 rounded-full bg-saffron/10 blur-3xl" />
        <div className="mx-auto max-w-6xl px-4 pb-28 pt-6 lg:px-8 lg:pb-32">
          <nav aria-label={t.crumb} className="text-sm text-white/80">
            <ol className="flex flex-wrap items-center gap-2">
              <li><Link href={base} className="underline-offset-4 hover:text-white hover:underline">{dict.nav.home}</Link></li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-semibold text-white">{t.meta}</li>
            </ol>
          </nav>
          <h1 className="mt-6 max-w-2xl font-display text-4xl font-semibold leading-tight !text-white sm:text-6xl [html[lang='ta']_&]:!leading-[1.3] [html[lang='ta']_&]:text-4xl">{t.title}</h1>
          <p className="mt-3 max-w-xl font-serif text-lg text-white/90 sm:text-xl">{t.lead}</p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {chips.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="inline-flex rounded-full border border-white/40 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-white hover:text-maroon focus:outline-none focus-visible:ring-2 focus-visible:ring-white">{label}</a>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Go to={t.campLink} className={solid}>{t.campCta}</Go>
            <Go to={t.writeLink} className={outline}>{t.writeCta}</Go>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 pb-16 lg:px-8 lg:pb-24">
        {/* Three photo cards that overlap the top section */}
        <div className="relative z-10 -mt-16 grid gap-6 sm:grid-cols-2 lg:-mt-20 lg:grid-cols-3">
          <Feature id="stay" photo={t.photos.stay} tagText={t.stayTag} title={t.stayTitle} name={t.stayName} text={t.stayText} />
          <Feature id="food" photo={t.photos.food} tagText={t.foodTag} title={t.foodTitle} text={t.foodText} />
          <div className="sm:col-span-2 lg:col-span-1">
            <Feature id="setting" photo={t.photos.setting} tagText={t.setTag} title={t.setTitle} text={t.setText} />
          </div>
        </div>

        {/* Rooms and charges */}
        <section aria-labelledby="det-title" className="mt-16 grid gap-8 lg:mt-20 lg:grid-cols-[1fr_1.6fr] lg:gap-14">
          <div>
            <p className={tag}>{t.meta}</p>
            <h2 id="det-title" className={`mt-1 ${h2}`}>{t.detailsTitle}</h2>
            <p className="mt-3 text-charcoal/80">{t.detailsLead}</p>
            {phone && (
              <a href={`tel:${phone.replace(/\s/g, '')}`} className="mt-5 inline-flex items-center justify-center rounded-md bg-maroon px-6 py-3 font-bold text-white shadow-md transition hover:bg-maroon/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron focus-visible:ring-offset-2">{t.callCta}: {phone}</a>
            )}
          </div>
          <dl className="divide-y divide-rose overflow-hidden rounded-2xl bg-rose/40 ring-1 ring-rose">
            {t.details.map((d) => (
              <div key={d.label} className="border-l-4 border-saffron px-5 py-4 sm:px-6">
                <dt className="font-display text-xl font-semibold text-maroon [html[lang='ta']_&]:!leading-[1.35] [html[lang='ta']_&]:text-lg">{d.label}</dt>
                <dd className="mt-1 text-charcoal/85">{d.text}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Steps, joined by a line on wide screens */}
        <section aria-labelledby="steps-title" className="mt-16 lg:mt-20">
          <h2 id="steps-title" className={h2}>{t.stepsTitle}</h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-3 md:gap-5">
            {t.steps.map((s, i) => (
              <li key={s.title} className="relative">
                <span className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full bg-maroon font-display text-xl font-bold text-white ring-4 ring-white">{i + 1}</span>
                {i < t.steps.length - 1 && <span aria-hidden="true" className="absolute left-14 right-[-1rem] top-5 hidden h-0.5 bg-saffron/50 md:block" />}
                <h3 className="mt-4 font-display text-2xl font-semibold text-maroon [html[lang='ta']_&]:!leading-[1.35] [html[lang='ta']_&]:text-xl">{s.title}</h3>
                <p className="mt-1 text-charcoal/80">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Closing call */}
        <section aria-labelledby="cta-title" className="relative isolate mt-16 overflow-hidden rounded-2xl bg-gradient-to-br from-maroon to-charcoal px-6 py-10 text-center text-white sm:px-12 lg:mt-20">
          <div aria-hidden="true" className="absolute -right-16 -top-16 -z-10 h-56 w-56 rounded-full bg-saffron/25 blur-3xl" />
          <h2 id="cta-title" className="font-display text-3xl font-semibold !text-white sm:text-4xl [html[lang='ta']_&]:!leading-[1.3] [html[lang='ta']_&]:text-2xl">{t.ctaTitle}</h2>
          <p className="mx-auto mt-2 max-w-xl font-serif text-lg text-white/90">{t.ctaText}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {phone && <a href={`tel:${phone.replace(/\s/g, '')}`} className={solid}>{t.callCta}: {phone}</a>}
            <Go to={t.writeLink} className={outline}>{t.writeCta}</Go>
          </div>
        </section>
      </div>
    </main>
  );
}