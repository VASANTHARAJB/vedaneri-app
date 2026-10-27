import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import Sidebar, { NavTab } from '../components/Sidebar';
import TopNav from '../components/TopNav';
import ContentStats from './ContentStats';
import DevoteeDirectory from './DevoteeDirectory';
import SankalpamRoster from './SankalpamRoster';
import SevasManagement from './SevasManagement';
import { useAuth } from '../lib/auth';
import { API_BASE_URL } from '../lib/api';


const CARD =
  'rounded-2xl border border-[#f0e2c8] bg-white shadow-[0_1px_3px_rgba(59,13,13,0.06)]';

const FOCUS =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f59e0b]/60 focus-visible:ring-offset-1';

/* ---------- SVG Icons ---------- */
const ICON_PATHS = {
  rupee: 'M15 8.25H9m6 3H9m3 6l-3-3h1.5a3 3 0 100-6M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  users:
    'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  heart:
    'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  printer:
    'M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z',
  grid: 'M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10-4a1 1 0 011-1h4a1 1 0 011 1v8a1 1 0 01-1 1h-4a1 1 0 01-1-1v-8z',
  plus: 'M12 4v16m8-8H4',
} as const;

type IconName = keyof typeof ICON_PATHS;

function Icon({ name, className = 'h-4 w-4' }: { name: IconName; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d={ICON_PATHS[name]} />
    </svg>
  );
}

function LivePill({ isLive }: { isLive: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
        isLive
          ? 'border-[#a7f3d0] bg-[#ecfdf5] text-[#047857]'
          : 'border-[#fde68a] bg-[#fffbeb] text-[#b45309]'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-[#10b981] animate-pulse' : 'bg-[#f59e0b]'}`} />
      {isLive ? 'MariaDB Live' : 'Connecting Database...'}
    </span>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
  comparisonText: string;
  icon: React.ReactNode;
  iconClass: string;
  sparklineColor: string;
  sparklinePath: string;
}

function MetricCard({
  title,
  value,
  change,
  trend,
  comparisonText,
  icon,
  iconClass,
  sparklineColor,
  sparklinePath,
}: MetricCardProps) {
  return (
    <div className={`${CARD} p-5 transition-shadow hover:shadow-[0_6px_18px_rgba(59,13,13,0.09)]`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#8a5a44]">{title}</span>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconClass}`}>{icon}</span>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <span className="text-2xl font-extrabold tracking-tight text-[#3b0d0d]">{value}</span>
        <span
          className={`flex items-center gap-0.5 rounded-md px-2 py-0.5 text-[11px] font-bold ${
            trend === 'up' ? 'bg-[#ecfdf5] text-[#047857]' : 'bg-[#fff1f2] text-[#be123c]'
          }`}
        >
          {trend === 'up' ? '↗' : '↘'} {change}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-[#f6ecd9] pt-3">
        <span className="text-[11px] font-medium text-[#b59a86]">{comparisonText}</span>
        <svg className="h-6 w-24 overflow-visible" viewBox="0 0 100 24" fill="none" aria-hidden="true">
          <path d={sparklinePath} stroke={sparklineColor} strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

/* ---------- URL Slugs Two-Way Mapping (All 17 NavTabs Included) ---------- */
const SLUG_TO_TAB: Record<string, NavTab> = {
  dashboard: 'overview',
  'content-stats': 'site-dashboard',
  sevas: 'sevas',
  donations: 'donations',
  camps: 'camps',
  magazine: 'magazine',
  'page-home': 'page-home',
  'page-about': 'page-about',
  'page-contact': 'page-contact',
  discover: 'discover',
  'payments-dashboard': 'payments-dashboard',
  'seva-orders': 'payment-sevas',
  'payment-donations': 'payment-donations',
  'printing-labels': 'address-labels',
  devotees: 'devotee-details',
  'devotee-records': 'devotee-data',
  settings: 'settings',
};

const TAB_TO_SLUG: Record<NavTab, string> = {
  overview: 'dashboard',
  'site-dashboard': 'content-stats',
  sevas: 'sevas',
  donations: 'donations',
  camps: 'camps',
  magazine: 'magazine',
  'page-home': 'page-home',
  'page-about': 'page-about',
  'page-contact': 'page-contact',
  discover: 'discover',
  'payments-dashboard': 'payments-dashboard',
  'payment-sevas': 'seva-orders',
  'payment-donations': 'payment-donations',
  'address-labels': 'printing-labels',
  'devotee-details': 'devotees',
  'devotee-data': 'devotee-records',
  settings: 'settings',
};

const CHART_W = 600;
const CHART_H = 200;

function smoothPath(values: number[]): string {
  if (!values || values.length === 0) return 'M 0 180 L 600 180';
  const pad = 16;
  const pts = values.map((v, i) => [
    (i / Math.max(values.length - 1, 1)) * CHART_W,
    CHART_H - pad - (Math.min(Math.max(v, 0), 100) / 100) * (CHART_H - pad * 2),
  ]);
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

const DISPATCH_STYLES: Record<string, string> = {
  Printed: 'border-[#a7f3d0] bg-[#ecfdf5] text-[#047857]',
  'Pending Print': 'border-[#fde68a] bg-[#fffbeb] text-[#b45309]',
  'Email Receipt': 'border-[#e7d9c4] bg-[#f5efe6] text-[#6b4a3a]',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tab: urlTab } = useParams<{ tab?: string }>();

  const auth = useAuth() as any;
  const user = auth?.user;
  const authToken = auth?.token;

  // Derive active tab strictly from URL parameter
  const activeTab: NavTab = useMemo(() => {
    const rawPath = (urlTab || location.pathname.replace(/^\//, '')).toLowerCase();
    return SLUG_TO_TAB[rawPath] || 'overview';
  }, [urlTab, location.pathname]);

  const [collapsed, setCollapsed] = useState(false);
  const [chartTimeline, setChartTimeline] = useState<'7D' | '30D' | '90D' | '1Y'>('1Y');
  const [activeStaffFilter, setActiveStaffFilter] = useState<'all' | 'online'>('all');

  // If path is root '/', redirect to '/dashboard'
  useEffect(() => {
    if (location.pathname === '/' || location.pathname === '') {
      navigate('/dashboard', { replace: true });
    }
  }, [location.pathname, navigate]);

  // Tab switch handler: changes URL bar to /dashboard, /content-stats, etc.
  const handleSelectTab = (tab: NavTab) => {
    const slug = TAB_TO_SLUG[tab] || tab;
    navigate(`/${slug}`);
  };

  // Real Database States
  const [isLive, setIsLive] = useState(false);
  const [metrics, setMetrics] = useState({
    totalRevenue: '₹ 0',
    todaysSankalpam: '0',
    annadhanamTotal: '₹ 0',
    pendingDispatch: '0',
  });

  const [chartData, setChartData] = useState<{
    labels: string[];
    revenue: number[];
    bookings: number[];
  }>({
    labels: ['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Oct'],
    revenue: [22, 34, 45, 52, 68, 80],
    bookings: [15, 26, 35, 44, 55, 66],
  });

  const [sevaMix, setSevaMix] = useState<any[]>([
    { label: 'Ekadasa Rudrabhishekam', pct: 42, amount: '₹62.3k', color: '#7a1c1c' },
    { label: 'Annadhanam Trust (80G)', pct: 34, amount: '₹50.5k', color: '#ea580c' },
    { label: 'Daily Nitya Archana', pct: 16, amount: '₹23.7k', color: '#f59e0b' },
    { label: 'Monthly Magazine & Camp', pct: 8, amount: '₹11.9k', color: '#0f766e' },
  ]);

  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [staffMembers, setStaffMembers] = useState<any[]>([]);

  useEffect(() => {
    async function fetchDashboardStats() {
      const token =
        authToken ||
        localStorage.getItem('token') ||
        localStorage.getItem('auth_token') ||
        localStorage.getItem('accessToken') ||
        sessionStorage.getItem('token');

      if (!token || token === 'undefined' || token === 'null') return;

      try {
        const res = await fetch(`${API_BASE_URL}/dashboard/stats?timeline=${chartTimeline}`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.metrics) setMetrics(data.metrics);
          if (data.chartData) setChartData(data.chartData);
          if (data.sevaMix && data.sevaMix.length > 0) setSevaMix(data.sevaMix);
          setRecentTransactions(data.recentTransactions || []);
          setStaffMembers(data.staffMembers || []);
          setIsLive(true);
        } else {
          setIsLive(false);
        }
      } catch (err) {
        setIsLive(false);
      }
    }

    if (activeTab === 'overview') {
      fetchDashboardStats();
    }
  }, [chartTimeline, authToken, activeTab]);

  const revenuePath = useMemo(() => smoothPath(chartData.revenue), [chartData.revenue]);
  const bookingsPath = useMemo(() => smoothPath(chartData.bookings), [chartData.bookings]);

  const firstName = user?.full_name?.trim().split(' ')[0] || 'Admin';
  const todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const getPageTitle = (tab: NavTab) => {
    switch (tab) {
      case 'overview':
        return 'Overview';
      case 'site-dashboard':
        return 'Content Stats';
      case 'sevas':
        return 'Sevas (Create & Edit)';
      case 'donations':
        return 'Donations Configuration';
      case 'camps':
        return 'Spiritual Camps';
      case 'magazine':
        return 'Ashram Magazine';
      case 'discover':
        return 'Discover Media';
      case 'payment-sevas':
        return 'Seva Orders & Daily Roster';
      case 'address-labels':
        return 'Printing Address Labels';
      case 'devotee-details':
        return 'Devotee Directory';
      case 'settings':
        return 'Portal Settings';
      default:
        return tab
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
    }
  };

  const isBuiltInTab =
    activeTab === 'overview' ||
    activeTab === 'site-dashboard' ||
    activeTab === 'devotee-details' ||
    activeTab === 'payment-sevas';

  return (
    <div className="flex min-h-screen bg-white font-sans text-[#3b0d0d] antialiased selection:bg-[#fde7b0] selection:text-[#3b0d0d]">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav
          breadcrumbs={[getPageTitle(activeTab)]}
          onToggleSidebar={() => setCollapsed((c) => !c)}
          createLabel="New Pooja / Seva"
          onQuickAction={() => handleSelectTab('payment-sevas')}
          onOpenHelp={() => alert('Vedaneri Ashram Support: admin@vedaneri.org')}
          onOpenProfile={() => alert(`Active User: ${user?.email}`)}
        />

        <main className="flex-1">
          <div className="mx-auto w-full max-w-7xl space-y-7 px-4 py-7 sm:px-6 lg:px-9">
            {/* 1. OVERVIEW / DASHBOARD TAB */}
            {activeTab === 'overview' && (
              <>
                <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#3b0d0d] via-[#5a1414] to-[#7a1c1c] p-7 text-white shadow-[0_10px_30px_rgba(59,13,13,0.25)] sm:p-8">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-[#f59e0b]/25 blur-3xl"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-[#ea580c]/20 blur-3xl"
                  />

                  <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#fbbf24]">
                        Executive Overview
                      </p>
                      <h1 className="mt-2 truncate text-3xl font-extrabold tracking-tight">
                        Namaste, {firstName}
                      </h1>
                      <p className="mt-2 max-w-xl text-sm text-[#fde7b0]/80">
                        Live MariaDB metrics for sevas, priest rosters, postal dispatch, and staff accounts.
                      </p>
                      <p className="mt-3 text-xs font-semibold text-[#fde7b0]/60">{todayLabel}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleSelectTab('payment-sevas')}
                        className={`flex items-center gap-1.5 rounded-xl bg-[#fbbf24] px-4 py-2.5 text-xs font-bold text-[#3b0d0d] shadow-md transition-colors hover:bg-[#fcd34d] ${FOCUS}`}
                      >
                        <Icon name="plus" />
                        New Pooja / Seva
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectTab('address-labels')}
                        className={`flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-white/15 ${FOCUS}`}
                      >
                        <Icon name="printer" />
                        Print Labels
                      </button>
                    </div>
                  </div>
                </section>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-base font-extrabold tracking-tight text-[#3b0d0d]">Today at a glance</h2>
                    <LivePill isLive={isLive} />
                  </div>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className={`flex items-center gap-1.5 rounded-xl border border-[#f0e2c8] bg-white px-3.5 py-2 text-xs font-semibold text-[#5b2a1a] shadow-sm transition-colors hover:bg-[#fff8ec] ${FOCUS}`}
                  >
                    <Icon name="printer" />
                    Export Summary
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricCard
                    title="Total Seva Revenue"
                    value={metrics.totalRevenue}
                    change="+14.2%"
                    trend="up"
                    comparisonText="vs last month"
                    icon={<Icon name="rupee" className="h-[18px] w-[18px]" />}
                    iconClass="bg-[#fff3df] text-[#c2410c]"
                    sparklineColor="#ea580c"
                    sparklinePath="M0 20 Q 25 18, 50 11 T 100 4"
                  />
                  <MetricCard
                    title="Today's Sankalpam"
                    value={`${metrics.todaysSankalpam} Devotees`}
                    change="+8.2%"
                    trend="up"
                    comparisonText="Archana list ready"
                    icon={<Icon name="users" className="h-[18px] w-[18px]" />}
                    iconClass="bg-[#fdebec] text-[#7a1c1c]"
                    sparklineColor="#7a1c1c"
                    sparklinePath="M0 22 Q 30 18, 60 10 T 100 3"
                  />
                  <MetricCard
                    title="Annadhanam (80G)"
                    value={metrics.annadhanamTotal}
                    change="+4.5%"
                    trend="up"
                    comparisonText="Tax deductible ledger"
                    icon={<Icon name="heart" className="h-[18px] w-[18px]" />}
                    iconClass="bg-[#e6f6f3] text-[#0f766e]"
                    sparklineColor="#0f766e"
                    sparklinePath="M0 19 Q 40 18, 70 8 T 100 5"
                  />
                  <MetricCard
                    title="Prasadam Dispatch"
                    value={`${metrics.pendingDispatch} Pending`}
                    change="-1.8%"
                    trend="down"
                    comparisonText="Labels queued for print"
                    icon={<Icon name="printer" className="h-[18px] w-[18px]" />}
                    iconClass="bg-[#fef3c7] text-[#b45309]"
                    sparklineColor="#f59e0b"
                    sparklinePath="M0 15 Q 35 12, 65 19 T 100 14"
                  />
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <section className={`${CARD} space-y-4 p-6 lg:col-span-2`}>
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div>
                        <h2 className="text-sm font-extrabold tracking-tight text-[#3b0d0d]">
                          Revenue vs Devotee Seva Volume
                        </h2>
                        <p className="mt-0.5 text-xs text-[#8a5a44]">
                          Financial inflow combined with daily morning sankalpam bookings
                        </p>
                      </div>

                      <div
                        role="group"
                        aria-label="Chart range"
                        className="inline-flex rounded-xl border border-[#f0e2c8] bg-[#fff8ec] p-1 text-xs font-semibold text-[#8a5a44]"
                      >
                        {(['7D', '30D', '90D', '1Y'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setChartTimeline(t)}
                            aria-pressed={chartTimeline === t}
                            className={`rounded-lg px-3 py-1 transition-colors ${FOCUS} ${
                              chartTimeline === t
                                ? 'bg-white font-bold text-[#3b0d0d] shadow-sm'
                                : 'hover:text-[#3b0d0d]'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="relative h-64 w-full">
                        <svg
                          className="h-full w-full"
                          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                          preserveAspectRatio="none"
                          role="img"
                          aria-label="Revenue and bookings trend"
                        >
                          <defs>
                            <linearGradient id="revenueArea" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.28" />
                              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                            </linearGradient>
                          </defs>

                          {[40, 90, 140].map((y) => (
                            <line
                              key={y}
                              x1="0"
                              y1={y}
                              x2={CHART_W}
                              y2={y}
                              stroke="#f6ecd9"
                              strokeWidth="1"
                              vectorEffect="non-scaling-stroke"
                            />
                          ))}

                          <path d={`${revenuePath} L ${CHART_W} ${CHART_H} L 0 ${CHART_H} Z`} fill="url(#revenueArea)" />
                          <path
                            d={revenuePath}
                            fill="none"
                            stroke="#ea580c"
                            strokeWidth="3"
                            strokeLinecap="round"
                            vectorEffect="non-scaling-stroke"
                          />
                          <path
                            d={bookingsPath}
                            fill="none"
                            stroke="#7a1c1c"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                            strokeDasharray="5 4"
                            vectorEffect="non-scaling-stroke"
                          />
                        </svg>
                      </div>

                      <div className="flex justify-between border-t border-[#f6ecd9] px-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-[#b59a86]">
                        {chartData.labels.map((l) => (
                          <span key={l}>{l}</span>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
                        <p className="text-[11px] text-[#b59a86]">
                          Aggregated telemetry from remote MariaDB host.
                        </p>
                        <div className="flex items-center gap-5 text-xs font-semibold text-[#5b2a1a]">
                          <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-[#ea580c]" />
                            Seva & Donation Revenue
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-[#7a1c1c]" />
                            Bookings Volume
                          </span>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className={`${CARD} flex flex-col justify-between space-y-4 p-6`}>
                    <div>
                      <h3 className="text-sm font-extrabold tracking-tight text-[#3b0d0d]">
                        Pooja & Seva Distribution
                      </h3>
                      <p className="mt-0.5 text-xs text-[#8a5a44]">Top contribution channels this month</p>

                      <div className="space-y-4 pt-5">
                        {sevaMix.map((row) => (
                          <div key={row.label}>
                            <div className="mb-1.5 flex justify-between text-xs font-bold">
                              <span className="text-[#5b2a1a]">{row.label}</span>
                              <span className="font-extrabold text-[#3b0d0d]">
                                {row.pct}% ({row.amount})
                              </span>
                            </div>
                            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#f6ecd9]">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${row.pct}%`, backgroundColor: row.color }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectTab('payment-sevas')}
                      className={`w-full rounded-xl border border-[#f0e2c8] bg-[#fff8ec] py-2.5 text-center text-xs font-bold text-[#7a1c1c] transition-colors hover:bg-[#fdeccb] ${FOCUS}`}
                    >
                      View all sevas →
                    </button>
                  </section>
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                  <section className={`${CARD} overflow-hidden xl:col-span-2`}>
                    <div className="flex items-center justify-between gap-3 border-b border-[#f6ecd9] p-5">
                      <div>
                        <h3 className="text-sm font-extrabold tracking-tight text-[#3b0d0d]">
                          Recent Devotee Seva Transactions
                        </h3>
                        <p className="mt-0.5 text-xs text-[#8a5a44]">Real-time records from database</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectTab('devotee-details')}
                        className={`shrink-0 rounded text-xs font-bold text-[#c2410c] hover:underline ${FOCUS}`}
                      >
                        View All Devotees →
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead>
                          <tr className="border-b border-[#f6ecd9] bg-[#fff8ec] text-[10.5px] font-bold uppercase tracking-wider text-[#8a5a44]">
                            <th className="px-4 py-3">Receipt ID</th>
                            <th className="px-4 py-3">Devotee & Gotram</th>
                            <th className="px-4 py-3">Seva / Pooja</th>
                            <th className="px-4 py-3">Amount</th>
                            <th className="px-4 py-3">Dispatch</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f6ecd9] font-medium text-[#5b2a1a]">
                          {recentTransactions.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                                No recent transactions recorded in database yet.
                              </td>
                            </tr>
                          ) : (
                            recentTransactions.map((tx) => (
                              <tr key={tx.id} className="transition-colors hover:bg-[#fffaf4]">
                                <td className="px-4 py-3.5 font-mono text-[11px] font-bold text-[#3b0d0d]">{tx.id}</td>
                                <td className="px-4 py-3.5">
                                  <span className="block font-bold text-[#3b0d0d]">{tx.devotee}</span>
                                  <span className="text-[10.5px] text-[#b59a86]">{tx.spiritualInfo}</span>
                                </td>
                                <td className="px-4 py-3.5">
                                  <span className="block font-semibold text-[#3b0d0d]">{tx.seva}</span>
                                  <span className="text-[10px] font-bold text-[#c2410c]">{tx.type}</span>
                                </td>
                                <td className="px-4 py-3.5 font-extrabold text-[#3b0d0d]">{tx.amount}</td>
                                <td className="px-4 py-3.5">
                                  <span
                                    className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                                      DISPATCH_STYLES[tx.dispatch] ?? DISPATCH_STYLES['Pending Print']
                                    }`}
                                  >
                                    {tx.dispatch}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleSelectTab('address-labels')}
                                    className={`rounded text-xs font-bold text-[#c2410c] hover:text-[#7a1c1c] ${FOCUS}`}
                                  >
                                    Label
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className={`${CARD} space-y-4 p-5`}>
                    <div className="flex items-center justify-between gap-2 border-b border-[#f6ecd9] pb-3">
                      <div>
                        <h3 className="text-sm font-extrabold tracking-tight text-[#3b0d0d]">Staff & Priest Logins</h3>
                        <p className="mt-0.5 text-xs text-[#8a5a44]">Registered MariaDB users</p>
                      </div>

                      <div
                        role="group"
                        className="inline-flex rounded-lg border border-[#f0e2c8] bg-[#fff8ec] p-0.5 text-[11px] font-bold"
                      >
                        <button
                          type="button"
                          onClick={() => setActiveStaffFilter('all')}
                          className={`rounded-md px-2 py-0.5 ${
                            activeStaffFilter === 'all' ? 'bg-white text-[#3b0d0d] shadow-sm' : 'text-[#b59a86]'
                          }`}
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveStaffFilter('online')}
                          className={`rounded-md px-2 py-0.5 ${
                            activeStaffFilter === 'online' ? 'bg-white text-[#047857] shadow-sm' : 'text-[#b59a86]'
                          }`}
                        >
                          Live
                        </button>
                      </div>
                    </div>

                    {staffMembers.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400">
                        No active users registered.
                      </div>
                    ) : (
                      <ul className="space-y-3">
                        {staffMembers
                          .filter((s) => (activeStaffFilter === 'online' ? s.status === 'online' : true))
                          .map((staff) => (
                            <li
                              key={staff.id}
                              className="flex items-start justify-between gap-2 rounded-xl border border-[#f0e2c8] bg-[#fffaf4] p-3 transition-colors hover:border-[#e9c885]"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="relative shrink-0">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#f59e0b] to-[#7a1c1c] text-xs font-extrabold text-white">
                                    {staff.name?.charAt(0) || 'U'}
                                  </div>
                                  <span
                                    className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
                                      staff.status === 'online' ? 'bg-[#10b981]' : 'bg-[#f59e0b]'
                                    }`}
                                  />
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-bold leading-snug text-[#3b0d0d]">{staff.name}</p>
                                  <p className="truncate text-[10.5px] font-semibold text-[#c2410c] uppercase">{staff.role}</p>
                                  <p className="truncate text-[10px] text-[#b59a86]">{staff.device}</p>
                                </div>
                              </div>

                              <span className="shrink-0 rounded-md border border-[#f0e2c8] bg-white px-2 py-0.5 text-[10px] font-medium text-[#8a5a44]">
                                {staff.lastSeen || 'Active'}
                              </span>
                            </li>
                          ))}
                      </ul>
                    )}
                  </section>
                </div>
              </>
            )}

            {/* 2. CONTENT STATS TAB */}
            {activeTab === 'site-dashboard' && (
              <ContentStats onNavigateTab={(tab) => handleSelectTab(tab as NavTab)} />
            )}

            {/* 3. DEVOTEES DIRECTORY TAB */}
            {activeTab === 'devotee-details' && <DevoteeDirectory />}

            {/* 4. SANKALPAM ROSTER TAB */}
            {activeTab === 'payment-sevas' && <SankalpamRoster />}

            {/* 5. PLACEHOLDER FOR OTHER MODULES */}
            {!isBuiltInTab && (
              <div className={`${CARD} px-6 py-16 text-center`}>
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff3df] text-[#c2410c]">
                  <Icon name="grid" className="h-6 w-6" />
                </div>
                <h2 className="text-base font-extrabold tracking-tight text-[#3b0d0d]">
                  {getPageTitle(activeTab)}
                </h2>
                <p className="mx-auto mt-1.5 max-w-sm text-xs text-[#8a5a44]">
                  This section is connected to navigation and ready for its data and table logic.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}