import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../lib/api';
import { useAuth } from '../lib/auth';

const CARD =
  'rounded-2xl border border-[#f0e2c8] bg-white shadow-[0_1px_3px_rgba(59,13,13,0.06)]';

const FOCUS =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f59e0b]/60 focus-visible:ring-offset-1';

interface ContentStatsProps {
  onNavigateTab?: (tab: string) => void;
}

export default function ContentStats({ onNavigateTab }: ContentStatsProps) {
  const navigate = useNavigate();
  const auth = useAuth() as any;
  const authToken = auth?.token;

  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [overview, setOverview] = useState({
    totalSevas: 0,
    activeSevas: 0,
    totalCamps: 0,
    upcomingCamps: 0,
    totalMagazines: 0,
    media: { audio: 0, video: 0, gallery: 0, total: 0 },
  });
  const [corePages, setCorePages] = useState<any[]>([]);

  const handleNav = (target: string) => {
    if (onNavigateTab) {
      onNavigateTab(target);
    } else {
      navigate(`/${target}`);
    }
  };

  useEffect(() => {
    async function loadStats() {
      const token =
        authToken ||
        localStorage.getItem('token') ||
        localStorage.getItem('auth_token') ||
        localStorage.getItem('accessToken');

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE_URL}/content-stats`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const json = await res.json();
          if (json.overview) setOverview(json.overview);
          if (json.corePages) setCorePages(json.corePages);
          setIsLive(true);
        } else {
          setIsLive(false);
        }
      } catch (err) {
        setIsLive(false);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [authToken]);

  const totalMedia = overview.media.total || 0;
  const audioPct = totalMedia > 0 ? Math.round((overview.media.audio / totalMedia) * 100) : 0;
  const videoPct = totalMedia > 0 ? Math.round((overview.media.video / totalMedia) * 100) : 0;
  const galleryPct = totalMedia > 0 ? Math.round((overview.media.gallery / totalMedia) * 100) : 0;

  return (
    <div className="space-y-7">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-[#3b0d0d] tracking-tight">
              Website Content Stats & Health
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border ${
                isLive
                  ? 'bg-[#ecfdf5] text-[#047857] border-[#a7f3d0]'
                  : 'bg-[#fffbeb] text-[#b45309] border-[#fde68a]'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isLive ? 'bg-[#10b981] animate-pulse' : 'bg-[#f59e0b]'
                }`}
              />
              {isLive ? 'MariaDB Live' : loading ? 'Syncing...' : 'Database Offline'}
            </span>
          </div>
          <p className="text-xs text-[#8a5a44] mt-1 font-medium">
            Centralized telemetry for public website pages, pooja catalogs, discourse audio/video assets, and publications.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleNav('sevas')}
            className={`px-3.5 py-2 rounded-xl bg-[#fbbf24] hover:bg-[#fcd34d] text-[#3b0d0d] text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer ${FOCUS}`}
          >
            <span>+</span>
            <span>New Seva</span>
          </button>
          <button
            type="button"
            onClick={() => handleNav('discover')}
            className={`px-3.5 py-2 rounded-xl border border-[#f0e2c8] bg-white hover:bg-[#fff8ec] text-[#5b2a1a] text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer ${FOCUS}`}
          >
            <span>Media Library</span>
            <span>→</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`${CARD} p-5 flex flex-col justify-between hover:shadow-md transition-shadow`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#8a5a44]">
              Public Sevas Catalog
            </span>
            <div className="h-9 w-9 rounded-xl bg-[#fff3df] text-[#c2410c] flex items-center justify-center font-bold text-sm">
              🪔
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-[#3b0d0d] tracking-tight">
              {overview.totalSevas}
            </span>
            <span className="text-[11px] font-bold text-[#047857] bg-[#ecfdf5] px-2 py-0.5 rounded-md">
              {overview.activeSevas} Active
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-[#f6ecd9] flex items-center justify-between text-[11px]">
            <span className="text-[#b59a86]">Online pooja booking</span>
            <button
              type="button"
              onClick={() => handleNav('sevas')}
              className="font-bold text-[#c2410c] hover:underline cursor-pointer"
            >
              Configure →
            </button>
          </div>
        </div>

        <div className={`${CARD} p-5 flex flex-col justify-between hover:shadow-md transition-shadow`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#8a5a44]">
              Spiritual Camps
            </span>
            <div className="h-9 w-9 rounded-xl bg-[#fdebec] text-[#7a1c1c] flex items-center justify-center font-bold text-sm">
              ⛺
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-[#3b0d0d] tracking-tight">
              {overview.totalCamps}
            </span>
            <span className="text-[11px] font-bold text-[#7a1c1c] bg-[#fdebec] px-2 py-0.5 rounded-md">
              {overview.upcomingCamps} Upcoming
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-[#f6ecd9] flex items-center justify-between text-[11px]">
            <span className="text-[#b59a86]">Youth & Gita sessions</span>
            <button
              type="button"
              onClick={() => handleNav('camps')}
              className="font-bold text-[#7a1c1c] hover:underline cursor-pointer"
            >
              Manage →
            </button>
          </div>
        </div>

        <div className={`${CARD} p-5 flex flex-col justify-between hover:shadow-md transition-shadow`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#8a5a44]">
              Discover Media
            </span>
            <div className="h-9 w-9 rounded-xl bg-[#e6f6f3] text-[#0f766e] flex items-center justify-center font-bold text-sm">
              🎙️
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-[#3b0d0d] tracking-tight">
              {overview.media.total}
            </span>
            <span className="text-[11px] font-bold text-[#0f766e] bg-[#e6f6f3] px-2 py-0.5 rounded-md">
              {overview.media.audio} Audio
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-[#f6ecd9] flex items-center justify-between text-[11px]">
            <span className="text-[#b59a86]">Pravachans & Videos</span>
            <button
              type="button"
              onClick={() => handleNav('discover')}
              className="font-bold text-[#0f766e] hover:underline cursor-pointer"
            >
              Library →
            </button>
          </div>
        </div>

        <div className={`${CARD} p-5 flex flex-col justify-between hover:shadow-md transition-shadow`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#8a5a44]">
              Ashram Magazine
            </span>
            <div className="h-9 w-9 rounded-xl bg-[#fef3c7] text-[#b45309] flex items-center justify-center font-bold text-sm">
              📰
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-[#3b0d0d] tracking-tight">
              {overview.totalMagazines}
            </span>
            <span className="text-[11px] font-bold text-[#b45309] bg-[#fef3c7] px-2 py-0.5 rounded-md">
              Archives
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-[#f6ecd9] flex items-center justify-between text-[11px]">
            <span className="text-[#b59a86]">Dharma Chakra PDFs</span>
            <button
              type="button"
              onClick={() => handleNav('magazine')}
              className="font-bold text-[#b45309] hover:underline cursor-pointer"
            >
              Issues →
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`${CARD} overflow-hidden lg:col-span-2`}>
          <div className="p-5 border-b border-[#f6ecd9] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold text-[#3b0d0d] tracking-tight">
                Public Website Pages Status
              </h2>
              <p className="text-xs text-[#8a5a44] mt-0.5">
                Next.js routing endpoints, publication state, and SEO score
              </p>
            </div>
            <span className="text-xs font-semibold text-[#8a5a44]">
              {corePages.length} Pages Monitored
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#fff8ec] border-b border-[#f6ecd9] text-[10.5px] font-bold uppercase tracking-wider text-[#8a5a44]">
                  <th className="py-3 px-4">Page Name</th>
                  <th className="py-3 px-4">Route Path</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">SEO Health</th>
                  <th className="py-3 px-4">Database State</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f6ecd9] font-medium text-[#5b2a1a]">
                {corePages.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Loading page health matrix...
                    </td>
                  </tr>
                ) : (
                  corePages.map((page) => (
                    <tr key={page.key} className="hover:bg-[#fffaf4] transition-colors">
                      <td className="py-3.5 px-4 font-bold text-[#3b0d0d]">{page.name}</td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-[#8a5a44]">{page.route}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border ${
                            page.status === 'Published'
                              ? 'bg-[#ecfdf5] text-[#047857] border-[#a7f3d0]'
                              : 'bg-[#fffbeb] text-[#b45309] border-[#fde68a]'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              page.status === 'Published' ? 'bg-[#10b981]' : 'bg-[#f59e0b]'
                            }`}
                          />
                          {page.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[#3b0d0d]">{page.seoScore}</td>
                      <td className="py-3.5 px-4 text-[#8a5a44]">{page.lastUpdated}</td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleNav(page.key)}
                          className="text-xs font-bold text-[#c2410c] hover:underline cursor-pointer"
                        >
                          Edit Layout
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className={`${CARD} p-5 space-y-4 flex flex-col justify-between`}>
          <div>
            <h3 className="text-sm font-extrabold text-[#3b0d0d] tracking-tight">
              Media Asset Breakdown
            </h3>
            <p className="text-xs text-[#8a5a44] mt-0.5">Discourse audio, videos, and temple photos</p>

            <div className="space-y-4 pt-4">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-[#5b2a1a] flex items-center gap-1.5">
                    <span>🎙️</span>
                    <span>Pravachan Audio Tracks</span>
                  </span>
                  <span className="text-[#3b0d0d] font-extrabold">
                    {overview.media.audio} tracks
                  </span>
                </div>
                <div className="h-2.5 w-full bg-[#f6ecd9] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#ea580c] rounded-full transition-all duration-500"
                    style={{ width: `${audioPct}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-[#5b2a1a] flex items-center gap-1.5">
                    <span>🎥</span>
                    <span>YouTube Discourses</span>
                  </span>
                  <span className="text-[#3b0d0d] font-extrabold">
                    {overview.media.video} videos
                  </span>
                </div>
                <div className="h-2.5 w-full bg-[#f6ecd9] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#7a1c1c] rounded-full transition-all duration-500"
                    style={{ width: `${videoPct}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-[#5b2a1a] flex items-center gap-1.5">
                    <span>🖼️</span>
                    <span>Temple & Festival Gallery</span>
                  </span>
                  <span className="text-[#3b0d0d] font-extrabold">
                    {overview.media.gallery} photos
                  </span>
                </div>
                <div className="h-2.5 w-full bg-[#f6ecd9] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0f766e] rounded-full transition-all duration-500"
                    style={{ width: `${galleryPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#f6ecd9]">
            <button
              type="button"
              onClick={() => handleNav('discover')}
              className={`w-full py-2.5 rounded-xl border border-[#f0e2c8] bg-[#fff8ec] hover:bg-[#fdeccb] text-[#7a1c1c] text-xs font-bold transition-all text-center cursor-pointer ${FOCUS}`}
            >
              Upload New Audio / Video →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}