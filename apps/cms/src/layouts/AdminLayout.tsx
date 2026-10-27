import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar, { NavTab } from '../components/Sidebar';
import TopNav from '../components/TopNav';
import { useAuth } from '../lib/auth';

const SLUG_TO_TAB: Record<string, NavTab> = {
  dashboard: 'overview',
  'content-stats': 'site-dashboard',
  sevas: 'sevas',
  donations: 'donations',
  camps: 'camps',
  magazine: 'magazine',
  panchangam: 'panchangam',
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
  panchangam: 'panchangam',
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

const TAB_TITLES: Record<NavTab, string> = {
  overview: 'Dashboard',
  'site-dashboard': 'Content Stats',
  sevas: 'Sevas & Corpus',
  donations: 'Donations',
  camps: 'Camps',
  magazine: 'Magazine',
  panchangam: 'Panchangam',
  'page-home': 'Home Page',
  'page-about': 'About Page',
  'page-contact': 'Contact Page',
  discover: 'Discover',
  'payments-dashboard': 'Payments Dashboard',
  'payment-sevas': 'Seva Orders',
  'payment-donations': 'Donation Payments',
  'address-labels': 'Printing Labels',
  'devotee-details': 'Devotees',
  'devotee-data': 'Devotee Records',
  settings: 'Settings',
};

// Top-right quick action changes with the page
function quickActionFor(tab: NavTab): { label: string; path: string } {
  if (tab === 'donations' || tab === 'payment-donations') {
    return { label: 'New Donation Fund', path: '/donations' };
  }
  if (tab === 'camps') {
    // ?new=1 makes the Camps page open its "New camp" form
    return { label: 'New Camp', path: '/camps?new=1' };
  }
  return { label: 'New Pooja / Seva', path: '/sevas' };
}

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [infoPanel, setInfoPanel] = useState<'help' | 'profile' | null>(null);

  const currentSlug = location.pathname.replace(/^\//, '').split('/')[0] || 'dashboard';
  const activeTab: NavTab = SLUG_TO_TAB[currentSlug] || 'overview';

  // Close the info panel when the page changes
  useEffect(() => {
    setInfoPanel(null);
  }, [location.pathname]);

  const handleSelectTab = (tab: NavTab) => {
    const slug = TAB_TO_SLUG[tab] || tab;
    navigate(`/${slug}`);
  };

  const quick = quickActionFor(activeTab);

  return (
    <div className="flex min-h-screen bg-white font-sans text-[#3b0d0d] antialiased selection:bg-[#fde7b0] selection:text-[#3b0d0d]">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav
          breadcrumbs={[TAB_TITLES[activeTab] || 'Dashboard']}
          onToggleSidebar={() => setCollapsed((c) => !c)}
          createLabel={quick.label}
          onQuickAction={() => navigate(quick.path)}
          onOpenHelp={() => setInfoPanel((p) => (p === 'help' ? null : 'help'))}
          onOpenProfile={() => setInfoPanel((p) => (p === 'profile' ? null : 'profile'))}
        />

        {infoPanel && (
          <div
            role="status"
            className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-xl border border-[#fde68a] bg-[#fff8ec] px-4 py-2.5 text-xs font-semibold text-[#7a1c1c] sm:mx-6 lg:mx-9"
          >
            <span>
              {infoPanel === 'help'
                ? 'Vedaneri Support: admin@vedaneri.org'
                : `Signed in as: ${user?.email || 'Unknown user'}`}
            </span>
            <button
              type="button"
              onClick={() => setInfoPanel(null)}
              className="cursor-pointer font-bold text-[#ea580c] hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <main className="mx-auto w-full max-w-7xl flex-1 overflow-y-auto px-4 py-7 sm:px-6 lg:px-9">
          <Outlet />
        </main>
      </div>
    </div>
  );
}