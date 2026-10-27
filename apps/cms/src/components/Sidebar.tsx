import React from 'react';
import ashramSeal from '@images/ashram-seal.png';
import { useAuth } from '../lib/auth';

export type NavTab =
  | 'overview'
  | 'site-dashboard'
  | 'sevas'
  | 'panchangam'
  | 'donations'
  | 'camps'
  | 'magazine'
  | 'page-home'
  | 'page-about'
  | 'page-contact'
  | 'discover'
  | 'payments-dashboard'
  | 'payment-sevas'
  | 'payment-donations'
  | 'address-labels'
  | 'devotee-details'
  | 'devotee-data'
  | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({ activeTab, onSelectTab, collapsed, onToggleCollapse }: SidebarProps) {
  const { user, logout } = useAuth();

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
            <div
              onClick={() => onSelectTab('overview')}
              className="flex items-center gap-3 overflow-hidden cursor-pointer"
            >
              <img src={ashramSeal} alt="Seal" className="h-9 w-9 rounded-xl object-contain shrink-0" />
              <div className="truncate">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-base text-slate-900 tracking-tight">Vedaneri</span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium truncate">Ashram Admin Portal</p>
              </div>
            </div>
          ) : (
            <img
              src={ashramSeal}
              alt="Seal"
              onClick={() => onSelectTab('overview')}
              className="h-8 w-8 rounded-xl object-contain mx-auto cursor-pointer"
            />
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
          {/* MENU SECTION */}
          <div className="space-y-1">
            {!collapsed && (
              <p className="px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                Menu
              </p>
            )}
            <button
              type="button"
              title="Dashboard"
              onClick={() => onSelectTab('overview')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-[#f4f5f9] text-slate-900 font-bold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
              } ${collapsed ? 'justify-center px-0' : ''}`}
            >
              <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10-4a1 1 0 011-1h4a1 1 0 011 1v8a1 1 0 01-1 1h-4a1 1 0 01-1-1v-8z" />
              </svg>
              {!collapsed && (
                <>
                  <span>Dashboard</span>
                  {activeTab === 'overview' && <span className="h-1.5 w-1.5 rounded-full bg-[#7c3aed] ml-auto"></span>}
                </>
              )}
            </button>
          </div>

          {/* WEBSITE MANAGEMENT */}
          <div className="space-y-1">
            {!collapsed && (
              <p className="px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                Website
              </p>
            )}
            <div className="space-y-0.5">
              {[
                { id: 'site-dashboard', label: 'Content Stats', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
                { id: 'sevas', label: 'Sevas', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
                { id: 'panchangam', label: 'Panchangam Calendar', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
                { id: 'donations', label: 'Donations', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                { id: 'camps', label: 'Camps', icon: 'M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z' },
                { id: 'magazine', label: 'Magazine', icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z' },
                { id: 'page-home', label: 'Home Page', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
                { id: 'page-about', label: 'About Page', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                { id: 'page-contact', label: 'Contact Page', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
                { id: 'discover', label: 'Discover', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
              ].map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.label}
                    onClick={() => onSelectTab(item.id as NavTab)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#f4f5f9] text-slate-900 font-bold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                    } ${collapsed ? 'justify-center px-0' : ''}`}
                  >
                    <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d={item.icon} />
                    </svg>
                    {!collapsed && (
                      <>
                        <span className="truncate">{item.label}</span>
                        {isActive && <span className="h-1.5 w-1.5 rounded-full bg-[#7c3aed] ml-auto"></span>}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* PAYMENTS & OPERATIONS */}
          <div className="space-y-1">
            {!collapsed && (
              <p className="px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                Payments & Devotees
              </p>
            )}
            <div className="space-y-0.5">
              {[
                { id: 'payments-dashboard', label: 'Payments Dashboard', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
                { id: 'payment-sevas', label: 'Seva Orders (2 Types)', icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z' },
                { id: 'payment-donations', label: 'Donations (2 Types)', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
                { id: 'address-labels', label: 'Printing Labels', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z' },
                { id: 'devotee-details', label: 'Devotee Details', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
                { id: 'devotee-data', label: 'Devotee Records', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
              ].map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.label}
                    onClick={() => onSelectTab(item.id as NavTab)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#f4f5f9] text-slate-900 font-bold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                    } ${collapsed ? 'justify-center px-0' : ''}`}
                  >
                    <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d={item.icon} />
                    </svg>
                    {!collapsed && (
                      <>
                        <span className="truncate">{item.label}</span>
                        {isActive && <span className="h-1.5 w-1.5 rounded-full bg-[#7c3aed] ml-auto"></span>}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SYSTEM SETTINGS */}
          <div className="space-y-1">
            {!collapsed && (
              <p className="px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                System
              </p>
            )}
            <button
              type="button"
              title="Settings"
              onClick={() => onSelectTab('settings')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-[#f4f5f9] text-slate-900 font-bold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
              } ${collapsed ? 'justify-center px-0' : ''}`}
            >
              <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {!collapsed && (
                <>
                  <span className="truncate">Settings</span>
                  {activeTab === 'settings' && <span className="h-1.5 w-1.5 rounded-full bg-[#7c3aed] ml-auto"></span>}
                </>
              )}
            </button>
          </div>
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
                  <span className="text-[9.5px] font-bold text-[#7c3aed] uppercase tracking-wider">{user?.role || 'ADMIN'}</span>
                  <span className="text-[10px] text-slate-400 truncate">• {user?.email}</span>
                </div>
              </div>
            )}
          </div>

          {!collapsed && (
            <button
              type="button"
              onClick={logout}
              title="Log out"
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
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