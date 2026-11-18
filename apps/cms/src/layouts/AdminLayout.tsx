import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar, { NavTab } from '../components/Sidebar';
import TopNav from '../components/TopNav';
import { useAuth } from '../lib/auth';
import { canOpen, homeSlug } from '../lib/access';

const SLUG_TO_TAB: Record<string, NavTab> = {
  dashboard: 'overview',
  'dashboard-gm': 'dashboard-gm',
  'dashboard-admin': 'dashboard-admin',
  'dashboard-developer': 'dashboard-developer',
  'content-stats': 'site-dashboard',
  sevas: 'sevas',
  donations: 'donations',
  camps: 'camps',
  magazine: 'magazine',
  panchangam: 'panchangam',
  'panchangam-calendar': 'panchangam-calendar',
  'page-home': 'page-home',
  'about-swami': 'about-swami',
  'about-ashramam': 'about-ashramam',
  'about-adhishtanam': 'about-adhishtanam',
  'about-vidyapitham': 'about-vidyapitham',
  'page-contact': 'page-contact',
  'page-accommodation': 'page-accommodation',
  'discover-audio': 'discover-audio',
  'discover-video': 'discover-video',
  'discover-album': 'discover-album',
  'payments-dashboard': 'payments-dashboard',
  'seva-payments': 'payment-sevas',
  'payment-donations': 'payment-donations',
  'payment-magazine': 'payment-magazine',
  'payment-camps': 'payment-camps',
  'printing-labels': 'address-labels',
  devotees: 'devotee-details',
  'devotee-records': 'devotee-data',
  'seva-register': 'seva-register',
  'donation-register': 'donation-register',
  'magazine-register': 'magazine-register',
  'camp-register': 'camp-register',
  'seva-offline': 'seva-offline',
  'donation-offline': 'donation-offline',
  'magazine-offline': 'magazine-offline',
  'camp-offline': 'camp-offline',
  'pos': 'pos-dashboard',
  'pos-new-sale': 'pos-new-sale',
  'pos-sales': 'pos-sales',
  'pos-items': 'pos-items',
  'pos-stock': 'pos-stock',
  'pos-purchases': 'pos-purchases',
  'pos-suppliers': 'pos-suppliers',
  'pos-adjustments': 'pos-adjustments',
  'pos-reports': 'pos-reports',
  settings: 'settings',
  users: 'users',
};

const TAB_TO_SLUG: Record<NavTab, string> = {
  overview: 'dashboard',
  'dashboard-gm': 'dashboard-gm',
  'dashboard-admin': 'dashboard-admin',
  'dashboard-developer': 'dashboard-developer',
  'site-dashboard': 'content-stats',
  sevas: 'sevas',
  donations: 'donations',
  camps: 'camps',
  magazine: 'magazine',
  panchangam: 'panchangam',
  'panchangam-calendar': 'panchangam-calendar',
  'page-home': 'page-home',
  'about-swami': 'about-swami',
  'about-ashramam': 'about-ashramam',
  'about-adhishtanam': 'about-adhishtanam',
  'about-vidyapitham': 'about-vidyapitham',
  'page-contact': 'page-contact',
  'page-accommodation': 'page-accommodation',
  'discover-audio': 'discover-audio',
  'discover-video': 'discover-video',
  'discover-album': 'discover-album',
  'payments-dashboard': 'payments-dashboard',
  'payment-sevas': 'seva-payments',
  'payment-donations': 'payment-donations',
  'payment-magazine': 'payment-magazine',
  'payment-camps': 'payment-camps',
  'address-labels': 'printing-labels',
  'devotee-details': 'devotees',
  'devotee-data': 'devotee-records',
  'seva-register': 'seva-register',
  'donation-register': 'donation-register',
  'magazine-register': 'magazine-register',
  'camp-register': 'camp-register',
  'seva-offline': 'seva-offline',
  'donation-offline': 'donation-offline',
  'magazine-offline': 'magazine-offline',
  'camp-offline': 'camp-offline',
  'pos-dashboard': 'pos',
  'pos-new-sale': 'pos-new-sale',
  'pos-sales': 'pos-sales',
  'pos-items': 'pos-items',
  'pos-stock': 'pos-stock',
  'pos-purchases': 'pos-purchases',
  'pos-suppliers': 'pos-suppliers',
  'pos-adjustments': 'pos-adjustments',
  'pos-reports': 'pos-reports',
  settings: 'settings',
  users: 'users',
};

const TAB_TITLES: Record<NavTab, string> = {
  overview: 'Dashboard',
  'dashboard-gm': 'GM Report Dashboard',
  'dashboard-admin': 'Admin Dashboard',
  'dashboard-developer': 'Developer Dashboard',
  'site-dashboard': 'Content Stats',
  sevas: 'Sevas & Corpus',
  donations: 'Donations',
  camps: 'Camps',
  magazine: 'Magazine',
  panchangam: 'Panchangam Manager',
  'panchangam-calendar': 'Tamil Calendar',
  'page-home': 'Home Page',
  'about-swami': 'Sri Swami Omkarananda',
  'about-ashramam': 'Ashramam',
  'about-adhishtanam': 'Adhishtanam',
  'about-vidyapitham': 'Vidyapitham',
  'page-contact': 'Contact Page',
  'page-accommodation': 'Accommodation',
  'discover-audio': 'Audio',
  'discover-video': 'Video',
  'discover-album': 'Album',
  'payments-dashboard': 'Payments Dashboard',
  'payment-sevas': 'Seva Payments',
  'payment-donations': 'Donation Payments',
  'payment-magazine': 'Magazine Payments',
  'payment-camps': 'Camp Payments',
  'address-labels': 'Printing Labels',
  'devotee-details': 'Devotee Details',
  'devotee-data': 'Devotee Records',
  'seva-register': 'Seva Register',
  'donation-register': 'Donation Register',
  'magazine-register': 'Magazine Register',
  'camp-register': 'Camp Register',
  'seva-offline': 'Seva Offline Registration',
  'donation-offline': 'Donation Offline Registration',
  'magazine-offline': 'Magazine Offline Registration',
  'camp-offline': 'Camp Offline Registration',
  'pos-dashboard': 'POS Dashboard',
  'pos-new-sale': 'New Sale',
  'pos-sales': 'Sales',
  'pos-items': 'Items',
  'pos-stock': 'Stock',
  'pos-purchases': 'Purchases (Stock In)',
  'pos-suppliers': 'Suppliers',
  'pos-adjustments': 'Stock Adjustments',
  'pos-reports': 'POS Reports',
  settings: 'Settings',
  users: 'Users',
};

// Top-right quick action changes with the page
function quickActionFor(tab: NavTab): { label: string; path: string } {
  switch (tab) {
    case 'donations':
    case 'payment-donations':
      return { label: 'New Donation Fund', path: '/donations' };
    case 'camps':
    case 'payment-camps':
      return { label: 'New Camp', path: '/camps?new=1' };
    case 'magazine':
    case 'payment-magazine':
      return { label: 'New Plan', path: '/magazine?new=1' };
    case 'payment-sevas':
      return { label: 'Manage Sevas', path: '/sevas' };
    case 'discover-audio':
      return { label: 'New Audio', path: '/discover-audio?new=1' };
    case 'discover-video':
      return { label: 'New Video', path: '/discover-video?new=1' };
    case 'discover-album':
      return { label: 'New Album', path: '/discover-album?new=1' };
    default:
      return { label: 'New Pooja / Seva', path: '/sevas' };
  }
}

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [infoPanel, setInfoPanel] = useState<'help' | 'profile' | null>(null);

  const currentSlug = location.pathname.replace(/^\//, '').split('/')[0] || 'dashboard';
  const activeTab: NavTab = SLUG_TO_TAB[currentSlug] || 'overview';

  // Close the info panel when the page changes
  useEffect(() => {
    setInfoPanel(null);
  }, [location.pathname]);

  const role = user?.role;
  const pages = user?.page_access;
  const allowedHere = canOpen(role, currentSlug, pages);
  const canSee = (tab: NavTab) => canOpen(role, TAB_TO_SLUG[tab] || tab, pages);

  const handleSelectTab = (tab: NavTab) => {
    const slug = TAB_TO_SLUG[tab] || tab;
    navigate(`/${slug}`);
  };

  const quickRaw = quickActionFor(activeTab);
  // The top-right shortcut must lead to a page this login can open
  const quickSlug = quickRaw.path.replace(/^\//, '').split('?')[0];
  const quick = canOpen(role, quickSlug, pages) ? quickRaw : { label: 'My home page', path: `/${homeSlug(role, pages)}` };
  const crumbs = activeTab.startsWith('discover-')
    ? ['Discover', TAB_TITLES[activeTab]]
    : activeTab.startsWith('about-')
      ? ['About', TAB_TITLES[activeTab]]
      : activeTab.startsWith('dashboard-')
        ? ['Dashboards', TAB_TITLES[activeTab]]
        : activeTab.endsWith('-offline')
        ? ['Registers', TAB_TITLES[activeTab]]
        : [TAB_TITLES[activeTab] || 'Dashboard'];

  if (loading) return <div className="p-8 text-sm text-slate-500">Loading...</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  // A login that may not open this page is sent to its own home page
  if (!allowedHere) return <Navigate to={`/${homeSlug(role, pages)}`} replace />;

  return (
    <div className="flex min-h-screen bg-white font-sans text-[#3b0d0d] antialiased selection:bg-[#fde7b0] selection:text-[#3b0d0d]">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        canSee={canSee}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav
          breadcrumbs={crumbs}
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
            <button type="button" onClick={() => setInfoPanel(null)} className="cursor-pointer font-bold text-[#ea580c] hover:underline">
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