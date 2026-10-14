'use client';

import { useEffect, useRef, useState } from 'react';

type Point = { x: number; y: number }; // position on the PHOTO itself: 0 = left/top edge, 1 = right/bottom edge

type Props = {
  src: string;
  fallback: string;   // CSS gradient shown until the photo exists
  position: string;   // same as CSS background-position, e.g. '75% 30%'
  points: Point[];    // where the light appears (the raised palms)
};

// Sparkle positions around each hand: [angle in degrees, distance as a fraction of the glow size, star size in px, delay in seconds]
const STARS: [number, number, number, number][] = [
  [20, 0.55, 22, 0], [75, 0.8, 14, 0.7], [130, 0.6, 19, 1.3], [190, 0.85, 12, 0.3],
  [245, 0.5, 20, 1.9], [300, 0.9, 16, 1.1], [340, 0.4, 12, 2.4],
];

function Star({ size, delay, className = '' }: { size: number; delay: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
      className={`hand-star absolute ${className}`} style={{ animationDelay: `${delay}s` }}>
      <path d="M12 0l2 10 10 2-10 2-2 10-2-10L0 12l10-2z" fill="#fff" />
    </svg>
  );
}

export default function HeroBackdrop({ src, fallback, position, points }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [pick, setPick] = useState(false);
  const [clicks, setClicks] = useState<Point[]>([]);

  const [px, py] = position.split(' ').map((v) => parseFloat(v) / 100);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.offsetWidth, h: el.offsetHeight }));
    ro.observe(el);
    setBox({ w: el.offsetWidth, h: el.offsetHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setNat({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = src;
        setPick(new URLSearchParams(window.location.search).get('pick') === '');
  }, [src]);

  // The same maths the browser uses for "background-size: cover"
  let map: ((p: Point) => { left: number; top: number }) | null = null;
  let drawnH = 0;
  let toPhoto: ((cx: number, cy: number) => Point) | null = null;
  if (box && nat) {
    const scale = Math.max(box.w / nat.w, box.h / nat.h);
    const dw = nat.w * scale;
    const dh = nat.h * scale;
    const ox = (box.w - dw) * px;
    const oy = (box.h - dh) * py;
    drawnH = dh;
    map = (p) => ({ left: ox + p.x * dw, top: oy + p.y * dh });
    toPhoto = (x, y) => ({ x: (x - ox) / dw, y: (y - oy) / dh });
  }

  const onPick = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || !box || !toPhoto) return;
    const r = el.getBoundingClientRect();           // includes the slow zoom
    const k = r.width / box.w;
    const p = toPhoto((e.clientX - r.left) / k, (e.clientY - r.top) / k);
    setClicks((c) => [...c, { x: +p.x.toFixed(3), y: +p.y.toFixed(3) }]);
  };

  const glow = Math.max(90, drawnH * 0.2);

  return (
    <>
      {/* Photo */}
      <div aria-hidden="true"
        className="absolute inset-0 -z-20 animate-kenburns bg-cover motion-reduce:animate-none"
        style={{ backgroundImage: `url('${src}'), ${fallback}`, backgroundPosition: position }} />

      {/* Light on the palms. Sits ABOVE the dark readability layers (so it stays bright) and zooms together with the photo. Desktop only. */}
      <div ref={ref} aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-[5] animate-kenburns motion-reduce:animate-none max-lg:hidden">
        {map && points.map((pt, i) => {
          const { left, top } = map!(pt);
          return (
            <div key={i} className="absolute" style={{ left, top, width: glow, height: glow, transform: 'translate(-50%, -50%)' }}>
              <span className="hand-glow absolute inset-0 rounded-full" style={{ animationDelay: `${i * 0.9}s` }} />
              {STARS.map(([a, d, size, delay], n) => {
                const r = (glow / 2) * d;
                return (
                  <span key={n} className="absolute" style={{
                    left: glow / 2 + Math.cos((a * Math.PI) / 180) * r,
                    top: glow / 2 + Math.sin((a * Math.PI) / 180) * r,
                    transform: 'translate(-50%, -50%)' }}>
                    <Star size={size} delay={delay + i * 0.5} />
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>

      {pick && (
        <>
          <div className="absolute inset-0 z-30 cursor-crosshair" onClick={onPick} />
          <div className="fixed bottom-4 left-4 z-50 max-w-sm rounded-md bg-white p-3 text-sm text-charcoal shadow-xl">
            <p className="font-bold">Click the centre of each palm</p>
            <pre className="mt-2 whitespace-pre-wrap break-all text-xs">{JSON.stringify(clicks)}</pre>
            <button type="button" className="mt-2 rounded border border-charcoal px-2 py-0.5" onClick={() => setClicks([])}>Clear</button>
          </div>
        </>
      )}
    </>
  );
}