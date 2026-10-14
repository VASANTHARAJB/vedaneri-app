'use client';

import { useEffect, useRef, useState } from 'react';

type Point = { x: number; y: number }; // position on the PHOTO: 0 = left/top edge, 1 = right/bottom edge

type Props = {
  src: string;          // the same photo that is used as the background of the parent box
  points: Point[];      // where the light appears (the raised palms)
  position?: string;    // same as the parent's CSS background-position (default centre)
  size?: number;        // glow size as a fraction of the photo height (default 0.2)
  pickKey?: string;     // open the page with ?pick=<pickKey> to click the palms and read the numbers
};

// Sparkles around each hand: [angle in degrees, distance as a fraction of the glow size, star size in px, delay in seconds]
const STARS: [number, number, number, number][] = [
  [20, 0.55, 20, 0], [75, 0.8, 13, 0.7], [130, 0.6, 17, 1.3], [190, 0.85, 11, 0.3],
  [245, 0.5, 18, 1.9], [300, 0.9, 14, 1.1], [340, 0.4, 11, 2.4],
];

// The parent element must be `relative`, use the photo as a `bg-cover` background, and clip with `overflow-hidden`.
export default function GlowLayer({ src, points, position = '50% 50%', size = 0.2, pickKey }: Props) {
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
    setPick(!!pickKey && new URLSearchParams(window.location.search).get('pick') === pickKey);
  }, [src, pickKey]);

  // The same maths the browser uses for "background-size: cover"
  let geo: { ox: number; oy: number; dw: number; dh: number } | null = null;
  if (box && nat && box.w > 0) {
    const scale = Math.max(box.w / nat.w, box.h / nat.h);
    const dw = nat.w * scale;
    const dh = nat.h * scale;
    geo = { ox: (box.w - dw) * px, oy: (box.h - dh) * py, dw, dh };
  }
  const glow = geo ? Math.max(70, geo.dh * size) : 0;

  const onPick = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || !geo) return;
    const r = el.getBoundingClientRect();
    setClicks((c) => [...c, { x: +((e.clientX - r.left - geo!.ox) / geo!.dw).toFixed(3), y: +((e.clientY - r.top - geo!.oy) / geo!.dh).toFixed(3) }]);
  };

  return (
    <div ref={ref} aria-hidden="true" className="absolute inset-0 overflow-hidden"
      style={{ pointerEvents: pick ? 'auto' : 'none', cursor: pick ? 'crosshair' : undefined }} onClick={pick ? onPick : undefined}>
      {geo && points.map((pt, i) => (
        <div key={i} className="absolute" style={{
          left: geo!.ox + pt.x * geo!.dw, top: geo!.oy + pt.y * geo!.dh,
          width: glow, height: glow, transform: 'translate(-50%, -50%)' }}>
          <span className="hand-glow hand-glow-bright absolute inset-0 rounded-full" style={{ animationDelay: `${i * 0.9}s` }} />
          {STARS.map(([a, d, s, delay], n) => {
            const r = (glow / 2) * d;
            return (
              <span key={n} className="absolute" style={{
                left: glow / 2 + Math.cos((a * Math.PI) / 180) * r,
                top: glow / 2 + Math.sin((a * Math.PI) / 180) * r,
                transform: 'translate(-50%, -50%)' }}>
                <svg width={s} height={s} viewBox="0 0 24 24" className="hand-star" style={{ animationDelay: `${delay + i * 0.5}s` }}>
                  <path d="M12 0l2 10 10 2-10 2-2 10-2-10L0 12l10-2z" fill="#fff" />
                </svg>
              </span>
            );
          })}
        </div>
      ))}
      {pick && (
        <div className="fixed bottom-4 left-4 z-50 max-w-sm rounded-md bg-white p-3 text-sm text-charcoal shadow-xl" onClick={(e) => e.stopPropagation()}>
          <p className="font-bold">Click the centre of each palm</p>
          <pre className="mt-2 whitespace-pre-wrap break-all text-xs">{JSON.stringify(clicks)}</pre>
          <button type="button" className="mt-2 rounded border border-charcoal px-2 py-0.5" onClick={() => setClicks([])}>Clear</button>
        </div>
      )}
    </div>
  );
}