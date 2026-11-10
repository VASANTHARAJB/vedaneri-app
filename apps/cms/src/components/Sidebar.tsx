import React, { useState } from 'react';
import ashramSeal from '@images/ashram-seal.png';
import { useAuth } from '../lib/auth';
import { ROLE_LABEL } from '../lib/access';

export type NavTab =
  | 'overview'
  | 'site-dashboard'
  | 'sevas'
  | 'panchangam'
  | 'panchangam-calendar'
  | 'donations'
  | 'camps'
  | 'magazine'
  | 'page-home'
  | 'about-swami'
  | 'about-ashramam'
  | 'about-adhishtanam'
  | 'about-vidyapitham'
  | 'page-accommodation'
  | 'page-contact'
  | 'discover-audio'
  | 'discover-video'
  | 'discover-album'
  | 'payments-dashboard'
  | 'payment-sevas'
  | 'payment-donations'
  | 'payment-magazine'
  | 'seva-register'
  | 'donation-register'
  | 'magazine-register'
  | 'camp-register'
  | 'address-labels'
  | 'devotee-details'
  | 'devotee-data'
  | 'pos-dashboard'
  | 'pos-new-sale'
  | 'pos-sales'
  | 'pos-items'
  | 'pos-stock'
  | 'pos-purchases'
  | 'pos-suppliers'
  | 'pos-adjustments'
  | 'pos-reports'
  | 'settings'
  | 'users';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  // Whether this login may open the page; items it cannot open are not shown
  canSee: (tab: NavTab) => boolean;
}

type Item = { id: string; label: string; icon: string };

// Website pages shown before the About group
const WEBSITE_TOP: Item[] = [
  { id: 'site-dashboard', label: 'Content Stats', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id: 'sevas', label: 'Sevas', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { id: 'panchangam-calendar', label: 'Tamil Calendar', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { id: 'panchangam', label: 'Panchangam Manager', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { id: 'donations', label: 'Donations', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'camps', label: 'Camps', icon: 'M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z' },
  { id: 'magazine', label: 'Magazine', icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z' },
  { id: 'page-home', label: 'Home Page', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
];

const ABOUT_ICON = 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
const ABOUT: Item[] = [
  { id: 'about-swami', label: 'Sri Swami Omkarananda', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { id: 'about-ashramam', label: 'Ashramam', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id: 'about-adhishtanam', label: 'Adhishtanam', icon: 'M12 3l9 5H3l9-5zM5 10v8m4-8v8m6-8v8m4-8v8M3 21h18' },
  { id: 'about-vidyapitham', label: 'Vidyapitham', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
];

// Website pages shown after the About group
const WEBSITE_BOTTOM: Item[] = [
  { id: 'page-accommodation', label: 'Accommodation', icon: 'M3 18v-6a2 2 0 012-2h14a2 2 0 012 2v6M3 18h18M3 18v2m18-2v2M7 10V7a2 2 0 012-2h6a2 2 0 012 2v3' },
  { id: 'page-contact', label: 'Contact Page', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
];

const DISCOVER_ICON = 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z';
const DISCOVER: Item[] = [
  { id: 'discover-audio', label: 'Audio', icon: 'M9 19V6l12-3v13M9 19a3 3 0 11-6 0 3 3 0 016 0zm12-3a3 3 0 11-6 0 3 3 0 016 0z' },
  { id: 'discover-video', label: 'Video', icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'discover-album', label: 'Album', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
];

const PAYMENTS: Item[] = [
  { id: 'payments-dashboard', label: 'Payments Dashboard', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
  { id: 'payment-sevas', label: 'Seva Payments', icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z' },
  { id: 'payment-donations', label: 'Donation Payments', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'payment-magazine', label: 'Magazine Payments', icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z' },
  { id: 'devotee-details', label: 'Devotee Details', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
  { id: 'devotee-data', label: 'Devotee Records', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
];

// Registers: one list per area, as printed registers and for label printing
const REGISTERS: Item[] = [
  { id: 'seva-register', label: 'Seva Register', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { id: 'donation-register', label: 'Donation Register', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'magazine-register', label: 'Magazine Register', icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z' },
  { id: 'camp-register', label: 'Camp Register', icon: 'M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z' },
  { id: 'address-labels', label: 'Printing Labels', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z' },
];

// Point of sale: counter billing, stock and purchasing for the ashram shop
const POS: Item[] = [
  { id: 'pos-dashboard', label: 'POS Dashboard', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
  { id: 'pos-new-sale', label: 'New Sale', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z' },
  { id: 'pos-sales', label: 'Sales', icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z' },
  { id: 'pos-items', label: 'Items', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  { id: 'pos-stock', label: 'Stock', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
  { id: 'pos-purchases', label: 'Purchases (Stock In)', icon: 'M8 16V6a1 1 0 011-1h10a1 1 0 011 1v10M8 16H4a1 1 0 01-1-1v-4l2-3h3m3 8h6M8 16a2 2 0 11-4 0 2 2 0 014 0zm12 0a2 2 0 11-4 0 2 2 0 014 0z' },
  { id: 'pos-suppliers', label: 'Suppliers', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
  { id: 'pos-adjustments', label: 'Stock Adjustments', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4' },
  { id: 'pos-reports', label: 'POS Reports', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
];

const USERS_ICON = 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z';

const SETTINGS_ICON = ['M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', 'M15 12a3 3 0 11-6 0 3 3 0 016 0z'];

const rowCls = (active: boolean, collapsed: boolean, pad = 'py-2') =>
  `w-full flex items-center gap-3 px-3 ${pad} rounded-xl text-xs transition-all cursor-pointer ${
    active ? 'bg-[#f4f5f9] text-slate-900 font-bold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
  } ${collapsed ? 'justify-center px-0' : ''}`;

function Icon({ d, cls = 'text-slate-400' }: { d: string | string[]; cls?: string }) {
  const paths = Array.isArray(d) ? d : [d];
  return (
    <svg className={`w-4 h-4 shrink-0 ${cls}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {paths.map((p) => <path key={p} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d={p} />)}
    </svg>
  );
}

const Dot = () => <span className="h-1.5 w-1.5 rounded-full bg-[#7c3aed] ml-auto"></span>;
const Heading = ({ text, collapsed }: { text: string; collapsed: boolean }) =>
  collapsed ? null : <p className="px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase">{text}</p>;

export default function Sidebar({ activeTab, onSelectTab, collapsed, onToggleCollapse, canSee }: SidebarProps) {
  const { user, logout } = useAuth();
  const discoverActive = DISCOVER.some((d) => d.id === activeTab);
  const aboutActive = ABOUT.some((d) => d.id === activeTab);
  const [discoverOpen, setDiscoverOpen] = useState(true);
  const [aboutOpen, setAboutOpen] = useState(true);

  const visible = (items: Item[]) => items.filter((i) => canSee(i.id as NavTab));

  const renderItem = (item: Item) => {
    const isActive = activeTab === item.id;
    return (
      <button key={item.id} type="button" title={item.label} onClick={() => onSelectTab(item.id as NavTab)} className={rowCls(isActive, collapsed)}>
        <Icon d={item.icon} />
        {!collapsed && (<><span className="truncate">{item.label}</span>{isActive && <Dot />}</>)}
      </button>
    );
  };

  // A dropdown group: a header row that opens and closes, with indented children
  const renderGroup = (title: string, icon: string, items: Item[], active: boolean, open: boolean, toggle: () => void) => (
    <>
      <button
        type="button"
        title={title}
        aria-expanded={open}
        onClick={() => { if (collapsed) onSelectTab(items[0].id as NavTab); else toggle(); }}
        className={rowCls(active && (collapsed || !open), collapsed)}
      >
        <Icon d={icon} />
        {!collapsed && (
          <>
            <span className="truncate">{title}</span>
            {active && !open && <Dot />}
            <svg className={`w-3.5 h-3.5 ml-auto text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </>
        )}
      </button>
      {!collapsed && open && (
        <div className="ml-4 border-l border-[#eaecf0] pl-2 space-y-0.5">
          {items.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button key={item.id} type="button" title={item.label} onClick={() => onSelectTab(item.id as NavTab)} className={rowCls(isActive, false)}>
                <Icon d={item.icon} />
                <span className="truncate">{item.label}</span>
                {isActive && <Dot />}
              </button>
            );
          })}
        </div>
      )}
    </>
  );

  return (
    <aside
      className={`bg-white border-r border-[#eaecf0] h-screen flex flex-col justify-between select-none z-30 sticky top-0 transition-all duration-200 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="flex flex-col min-h-0 flex-1">
        {/* 1. Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-[#eaecf0]/60">
          {!collapsed ? (
            <div onClick={() => onSelectTab('overview')} className="flex items-center gap-3 overflow-hidden cursor-pointer">
              <img src={ashramSeal} alt="Seal" className="h-9 w-9 rounded-xl object-contain shrink-0" />
              <div className="truncate">
                <div className="flex items-center gap-1.5"><span className="font-bold text-base text-slate-900 tracking-tight">Vedaneri</span></div>
                <p className="text-[11px] text-slate-400 font-medium truncate">Ashram Admin Portal</p>
              </div>
            </div>
          ) : (
            <img src={ashramSeal} alt="Seal" onClick={() => onSelectTab('overview')} className="h-8 w-8 rounded-xl object-contain mx-auto cursor-pointer" />
          )}

          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Toggle navigation"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M4 6h16M4 12h16M4 18h7" />
            </svg>
          </button>
        </div>

        {/* 2. Quick Search Pill */}
        {!collapsed && (
          <div className="px-4 pt-3 pb-1">
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#f8f9fc] border border-[#eaecf0] text-xs text-slate-400 hover:border-slate-300 transition-colors cursor-pointer">
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="text-slate-500 text-[11.5px]">Quick search</span>
              </div>
              <kbd className="px-1.5 py-0.5 text-[9.5px] font-medium text-slate-400 bg-white border border-slate-200 rounded">⌘K</kbd>
            </div>
          </div>
        )}

        {/* 3. Navigation List */}
        <div className="p-3 space-y-4 overflow-y-auto flex-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {canSee('overview') && (
            <div className="space-y-1">
              <Heading text="Menu" collapsed={collapsed} />
              <button type="button" title="Dashboard" onClick={() => onSelectTab('overview')} className={rowCls(activeTab === 'overview', collapsed, 'py-2.5')}>
                <Icon cls="text-slate-500" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10-4a1 1 0 011-1h4a1 1 0 011 1v8a1 1 0 01-1 1h-4a1 1 0 01-1-1v-8z" />
                {!collapsed && (<><span>Dashboard</span>{activeTab === 'overview' && <Dot />}</>)}
              </button>
            </div>
          )}

          {/* WEBSITE MANAGEMENT */}
          {(visible(WEBSITE_TOP).length + visible(ABOUT).length + visible(WEBSITE_BOTTOM).length + visible(DISCOVER).length) > 0 && (
            <div className="space-y-1">
              <Heading text="Website" collapsed={collapsed} />
              <div className="space-y-0.5">
                {visible(WEBSITE_TOP).map(renderItem)}
                {visible(ABOUT).length > 0 && renderGroup('About', ABOUT_ICON, visible(ABOUT), aboutActive, aboutOpen, () => setAboutOpen((o) => !o))}
                {visible(WEBSITE_BOTTOM).map(renderItem)}
                {visible(DISCOVER).length > 0 && renderGroup('Discover', DISCOVER_ICON, visible(DISCOVER), discoverActive, discoverOpen, () => setDiscoverOpen((o) => !o))}
              </div>
            </div>
          )}

          {/* PAYMENTS & OPERATIONS */}
          {visible(PAYMENTS).length > 0 && (
            <div className="space-y-1">
              <Heading text="Payments & Devotees" collapsed={collapsed} />
              <div className="space-y-0.5">{visible(PAYMENTS).map(renderItem)}</div>
            </div>
          )}

          {/* REGISTERS */}
          {visible(REGISTERS).length > 0 && (
            <div className="space-y-1">
              <Heading text="Registers" collapsed={collapsed} />
              <div className="space-y-0.5">{visible(REGISTERS).map(renderItem)}</div>
            </div>
          )}

          {/* POINT OF SALE */}
          {visible(POS).length > 0 && (
            <div className="space-y-1">
              <Heading text="Point of Sale" collapsed={collapsed} />
              <div className="space-y-0.5">{visible(POS).map(renderItem)}</div>
            </div>
          )}

          {/* SYSTEM */}
          {(canSee('settings') || canSee('users')) && (
            <div className="space-y-1">
              <Heading text="System" collapsed={collapsed} />
              {canSee('users') && (
                <button type="button" title="Users" onClick={() => onSelectTab('users')} className={rowCls(activeTab === 'users', collapsed)}>
                  <Icon d={USERS_ICON} />
                  {!collapsed && (<><span className="truncate">Users</span>{activeTab === 'users' && <Dot />}</>)}
                </button>
              )}
              {canSee('settings') && (
                <button type="button" title="Settings" onClick={() => onSelectTab('settings')} className={rowCls(activeTab === 'settings', collapsed)}>
                  <Icon d={SETTINGS_ICON} />
                  {!collapsed && (<><span className="truncate">Settings</span>{activeTab === 'settings' && <Dot />}</>)}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 4. Bottom User Profile Card */}
      <div className="p-3 border-t border-[#eaecf0]">
        <div className={`flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-slate-50 transition-colors ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="h-8 w-8 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-xs shrink-0">
              {user?.full_name?.charAt(0) || 'N'}
            </div>
            {!collapsed && (
              <div className="truncate">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900 truncate leading-tight">{user?.full_name || 'Admin'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[9.5px] font-bold text-[#7c3aed] uppercase tracking-wider">{ROLE_LABEL[user?.role || ''] || user?.role || 'Admin'}</span>
                  <span className="text-[10px] text-slate-400 truncate">• {user?.email}</span>
                </div>
              </div>
            )}
          </div>

          {!collapsed && (
            <button type="button" onClick={logout} title="Log out" className="p-1 rounded-md text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}