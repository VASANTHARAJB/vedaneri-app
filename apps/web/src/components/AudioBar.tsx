'use client';

import { useRef, useState } from 'react';
import type { Dictionary } from '@/lib/dictionary';
import { FEATURED_AUDIO } from '@/lib/site';

const SPEEDS = [1, 1.25, 1.5, 2];
const mmss = (s: number) => {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

export default function AudioBar({ t }: { t: Dictionary['audioBar'] }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(false);
  const ready = FEATURED_AUDIO.src !== '';

  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) {
      void a.play();
    } else {
      a.pause();
    }
  };

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (ref.current) ref.current.playbackRate = next;
  };

  const toggleMute = () => {
    setMuted((prev) => {
      const next = !prev;
      if (ref.current) ref.current.muted = next;
      return next;
    });
  };

  return (
    <section aria-label={t.label} className="border-t border-white/10 bg-charcoal text-white">
      {ready && (
        <audio
          ref={ref}
          src={FEATURED_AUDIO.src}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
          onEnded={() => setPlaying(false)}
        />
      )}

      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:gap-8 lg:px-8">
        {/* Play/Pause & Audio Details */}
        <div className="flex min-w-0 items-center gap-4 lg:w-[26rem]">
          <button
            type="button"
            suppressHydrationWarning
            onClick={toggle}
            disabled={!ready}
            aria-label={playing ? t.pause : t.play}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-saffron text-charcoal transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {playing ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <div className="min-w-0">
            <p className="truncate font-display text-lg font-semibold">{t.title}</p>
            <p className="flex flex-wrap items-center gap-2 text-sm text-white/80">
              <span className="rounded bg-maroon px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-white">
                {t.tag}
              </span>
              <span className="truncate">{ready ? t.by : t.soon}</span>
            </p>
          </div>
        </div>

        {/* Timeline & Scrubber */}
        <div className="flex flex-1 items-center gap-3 text-xs text-white/80">
          <span className="w-10 text-right tabular-nums">{mmss(time)}</span>
          <input
            type="range"
            suppressHydrationWarning
            min={0}
            max={dur || 1}
            step={1}
            value={time}
            disabled={!ready}
            aria-label={t.seek}
            onChange={(e) => {
              const v = Number(e.target.value);
              setTime(v);
              if (ref.current) ref.current.currentTime = v;
            }}
            className="h-1.5 w-full cursor-pointer accent-[#D97706] disabled:cursor-not-allowed"
          />
          <span className="w-10 tabular-nums">{mmss(dur)}</span>
        </div>

        {/* Controls: Speed, Volume, Download */}
        <div className="flex items-center gap-4 text-sm">
          <button
            type="button"
            suppressHydrationWarning
            onClick={cycleSpeed}
            disabled={!ready}
            aria-label={`${t.speed}: ${speed}x`}
            className="min-w-[3.5rem] rounded border border-white/40 px-2 py-1 font-semibold hover:bg-white hover:text-charcoal disabled:opacity-60"
          >
            {speed}x
          </button>

          <button
            type="button"
            suppressHydrationWarning
            disabled={!ready}
            aria-label={muted ? t.unmute : t.mute}
            aria-pressed={muted}
            onClick={toggleMute}
            className="rounded p-1.5 hover:bg-white/15 disabled:opacity-60"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M11 5L6 9H3v6h3l5 4V5z" />
              {muted ? (
                <path d="M17 9l5 6M22 9l-5 6" />
              ) : (
                <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
              )}
            </svg>
          </button>

          {ready && (
            <a
              href={FEATURED_AUDIO.src}
              download
              aria-label={t.download}
              className="rounded p-1.5 hover:bg-white/15"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
              </svg>
            </a>
          )}
        </div>
      </div>
    </section>
  );
}