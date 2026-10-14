'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

// Fades content up when it scrolls into view. Content is visible without JavaScript
// and for visitors who prefer reduced motion.
export default function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'shown' | 'hidden'>('shown');

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return; // already on screen
    setState('hidden');
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setState('shown');
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ transitionDelay: `${delay}ms` }}
      className={`transition duration-700 ease-out ${state === 'hidden' ? 'translate-y-8 opacity-0' : 'translate-y-0 opacity-100'} ${className}`}>
      {children}
    </div>
  );
}
