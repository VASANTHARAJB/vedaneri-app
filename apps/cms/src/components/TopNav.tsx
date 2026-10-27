import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/auth';

export interface QuickAction {
  label: string;
  description?: string;
  onClick: () => void;
}

export interface TopNavNotification {
  id: string;
  title: string;
  description?: string;
  /** Display text such as "5 min ago". Format it where the data comes from. */
  time: string;
  read?: boolean;
}

interface TopNavProps {
  /** Breadcrumb trail after the console name, e.g. getNavTrail(activeTab) from Sidebar. */
  breadcrumbs?: string[];
  consoleName?: string;
  /** Mobile menu button. Only renders if provided (the sidebar needs a drawer mode for this to be useful). */
  onToggleSidebar?: () => void;
  /** Opens your global search / command palette. Search is hidden without it. */
  onOpenSearch?: () => void;
  /** Items for the "New" dropdown. If empty, falls back to a single button using onQuickAction. */
  quickActions?: QuickAction[];
  onQuickAction?: () => void;
  createLabel?: string;
  notifications?: TopNavNotification[];
  onNotificationClick?: (notification: TopNavNotification) => void;
  onMarkAllRead?: () => void;
  onViewAllNotifications?: () => void;
  onOpenHelp?: () => void;
  onOpenProfile?: () => void;
}

/*
  Colors in this file are hex values on purpose (not amber-*, slate-*, etc.),
  so they render even if the project's Tailwind theme has no default palette.
    maroon text: #3b0d0d   muted brown: #8a5a44   icon brown: #5b2a1a
    saffron: #f59e0b / #ea580c   deep maroon: #7a1c1c   background: white
*/

/* ---------- Icons ---------- */

const ICON_PATHS = {
  menu: 'M4 6h16M4 12h16M4 18h16',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  plus: 'M12 4v16m8-8H4',
  bell: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  help: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  lifebuoy:
    'M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z',
  user: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  logout:
    'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
  chevronDown: 'M19 9l-7 7-7-7',
  chevronRight: 'M9 5l7 7-7 7',
  check: 'M5 13l4 4L19 7',
} as const;

type IconName = keyof typeof ICON_PATHS;

function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d={ICON_PATHS[name]} />
    </svg>
  );
}

/* ---------- Helpers ---------- */

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f59e0b]/60 focus-visible:ring-offset-1';

function getInitials(name?: string) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'A';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function useOnlineStatus() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);
  return online;
}

type MenuId = 'create' | 'notifications' | 'profile' | null;

/* ---------- Component ---------- */

export default function TopNav({
  breadcrumbs = [],
  consoleName = 'Vedapuri Staff Console',
  onToggleSidebar,
  onOpenSearch,
  quickActions = [],
  onQuickAction,
  createLabel = 'New Entry',
  notifications = [],
  onNotificationClick,
  onMarkAllRead,
  onViewAllNotifications,
  onOpenHelp,
  onOpenProfile,
}: TopNavProps) {
  const { user, logout } = useAuth();
  const [openMenu, setOpenMenu] = useState<MenuId>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const online = useOnlineStatus();

  // Close any open menu on outside click or Escape.
  useEffect(() => {
    if (!openMenu) return;
    const onPointerDown = (e: MouseEvent) => {
      if (controlsRef.current && !controlsRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openMenu]);

  const toggle = (id: Exclude<MenuId, null>) => setOpenMenu((cur) => (cur === id ? null : id));
  const close = () => setOpenMenu(null);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const hasCreateMenu = quickActions.length > 0;
  const showCreate = hasCreateMenu || !!onQuickAction;
  const roleLabel = user?.role || 'Staff';

  const trail = [consoleName, ...breadcrumbs];

  return (
    <header className="sticky top-0 z-20 shrink-0 select-none border-b border-[#f3dcb4] bg-white/90 backdrop-blur-md">
      {/* Thin brand line */}
      <div className="h-0.5 bg-gradient-to-r from-[#f59e0b] via-[#ea580c] to-[#7a1c1c]" aria-hidden="true" />

      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        {/* Left: menu button + breadcrumbs */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              aria-label="Open navigation"
              className={`rounded-lg p-2 text-[#5b2a1a] hover:bg-[#fdeccb]/70 lg:hidden ${FOCUS_RING}`}
            >
              <Icon name="menu" />
            </button>
          )}

          <nav aria-label="Breadcrumb" className="min-w-0">
            <ol className="flex items-center gap-1.5 text-xs">
              {trail.map((crumb, i) => {
                const isLast = i === trail.length - 1;
                return (
                  <li
                    key={`${crumb}-${i}`}
                    className={`min-w-0 items-center gap-1.5 ${isLast ? 'flex' : 'hidden md:flex'}`}
                  >
                    {i > 0 && (
                      <Icon name="chevronRight" className="hidden h-3 w-3 shrink-0 text-[#e9c885] md:block" />
                    )}
                    <span
                      aria-current={isLast ? 'page' : undefined}
                      className={`truncate ${
                        isLast ? 'text-sm font-bold text-[#3b0d0d]' : 'font-medium text-[#8a5a44]'
                      }`}
                    >
                      {crumb}
                    </span>
                  </li>
                );
              })}
            </ol>
          </nav>

          {!online && (
            <span
              role="status"
              className="hidden shrink-0 items-center gap-1.5 rounded-full bg-[#fff1f2] px-2.5 py-1 text-[11px] font-semibold text-[#be123c] ring-1 ring-[#fecdd3] sm:inline-flex"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#f43f5e]" aria-hidden="true" />
              Offline
            </span>
          )}
        </div>

        {/* Center: search */}
        {onOpenSearch && (
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="Search"
            className={`hidden h-10 w-full max-w-sm items-center justify-between rounded-xl border border-[#f3dcb4] bg-white px-3.5 text-[13px] text-[#8a5a44]/70 shadow-sm transition-colors hover:border-[#e9c885] hover:text-[#5b2a1a] lg:flex ${FOCUS_RING}`}
          >
            <span className="flex items-center gap-2.5">
              <Icon name="search" className="h-4 w-4" />
              Search devotees, sevas, pages…
            </span>
            <kbd className="rounded-md bg-[#fff6e5] px-1.5 py-0.5 text-[10px] font-medium text-[#8a5a44]">
              Ctrl K
            </kbd>
          </button>
        )}

        {/* Right: controls */}
        <div ref={controlsRef} className="flex flex-1 items-center justify-end gap-1.5 sm:gap-2.5">
          {onOpenSearch && (
            <button
              type="button"
              onClick={onOpenSearch}
              aria-label="Search"
              className={`rounded-lg p-2 text-[#5b2a1a] hover:bg-[#fdeccb]/70 lg:hidden ${FOCUS_RING}`}
            >
              <Icon name="search" />
            </button>
          )}

          {/* Create */}
          {showCreate && (
            <div className="relative">
              <button
                type="button"
                onClick={() => (hasCreateMenu ? toggle('create') : onQuickAction?.())}
                aria-haspopup={hasCreateMenu ? 'menu' : undefined}
                aria-expanded={hasCreateMenu ? openMenu === 'create' : undefined}
                className={`flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#f59e0b] via-[#ea580c] to-[#7a1c1c] px-3 py-2 text-xs font-bold text-white shadow-md shadow-[#ea580c]/25 transition-all hover:shadow-lg hover:brightness-110 sm:px-4 ${FOCUS_RING}`}
              >
                <Icon name="plus" className="h-4 w-4" />
                <span className="hidden sm:inline">{createLabel}</span>
                {hasCreateMenu && (
                  <Icon
                    name="chevronDown"
                    className={`hidden h-3.5 w-3.5 transition-transform sm:block ${
                      openMenu === 'create' ? 'rotate-180' : ''
                    }`}
                  />
                )}
              </button>

              {openMenu === 'create' && hasCreateMenu && (
                <div
                  role="menu"
                  className="absolute right-0 z-50 mt-2 w-64 origin-top-right rounded-2xl border border-[#f3dcb4] bg-white p-1.5 shadow-xl"
                >
                  {quickActions.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        close();
                        action.onClick();
                      }}
                      className="block w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-[#fff6e5] focus:bg-[#fff6e5] focus:outline-none"
                    >
                      <span className="block text-xs font-semibold text-[#3b0d0d]">{action.label}</span>
                      {action.description && (
                        <span className="mt-0.5 block text-[11px] text-[#64748b]">{action.description}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Help */}
          {onOpenHelp && (
            <button
              type="button"
              onClick={onOpenHelp}
              aria-label="Help and support"
              title="Help & Support"
              className={`hidden rounded-lg p-2 text-[#5b2a1a] hover:bg-[#fdeccb]/70 sm:block ${FOCUS_RING}`}
            >
              <Icon name="help" />
            </button>
          )}

          {/* Notifications */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toggle('notifications')}
              aria-haspopup="true"
              aria-expanded={openMenu === 'notifications'}
              aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
              className={`relative rounded-lg p-2 text-[#5b2a1a] hover:bg-[#fdeccb]/70 ${FOCUS_RING}`}
            >
              <Icon name="bell" />
              {unreadCount > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full border-2 border-white bg-[#f43f5e] px-1 text-[9px] font-bold leading-none text-white"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {openMenu === 'notifications' && (
              <div className="absolute right-0 z-50 mt-2 w-80 origin-top-right overflow-hidden rounded-2xl border border-[#f3dcb4] bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-[#f3ede4] px-4 py-3">
                  <p className="text-xs font-bold text-[#3b0d0d]">Notifications</p>
                  {unreadCount > 0 && onMarkAllRead && (
                    <button
                      type="button"
                      onClick={onMarkAllRead}
                      className="flex items-center gap-1 rounded text-[11px] font-semibold text-[#b45309] hover:text-[#78350f] focus:outline-none focus-visible:underline"
                    >
                      <Icon name="check" className="h-3 w-3" />
                      Mark all read
                    </button>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <p className="text-xs font-semibold text-[#334155]">You're all caught up</p>
                    <p className="mt-1 text-[11px] text-[#94a3b8]">New activity will show up here.</p>
                  </div>
                ) : (
                  <ul className="max-h-80 divide-y divide-[#f3ede4] overflow-y-auto">
                    {notifications.map((n) => (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => {
                            close();
                            onNotificationClick?.(n);
                          }}
                          className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-[#fffaf4] focus:bg-[#fffaf4] focus:outline-none ${
                            n.read ? '' : 'bg-[#fff8ec]'
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                              n.read ? 'bg-[#ffffff]/0' : 'bg-[#f59e0b]'
                            }`}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-semibold text-[#1f2937]">{n.title}</span>
                            {n.description && (
                              <span className="mt-0.5 block line-clamp-2 text-[11px] text-[#64748b]">
                                {n.description}
                              </span>
                            )}
                            <span className="mt-1 block text-[10px] text-[#94a3b8]">{n.time}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {onViewAllNotifications && notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      onViewAllNotifications();
                    }}
                    className="block w-full border-t border-[#f3ede4] px-4 py-2.5 text-center text-[11px] font-semibold text-[#b45309] hover:bg-[#fffaf4] focus:bg-[#fffaf4] focus:outline-none"
                  >
                    View all
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="mx-0.5 hidden h-6 w-px bg-[#f3dcb4] sm:block" aria-hidden="true" />

          {/* Profile */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toggle('profile')}
              aria-haspopup="menu"
              aria-expanded={openMenu === 'profile'}
              className={`flex items-center gap-2.5 rounded-xl p-1 pr-2 transition-colors hover:bg-[#fdeccb]/60 ${FOCUS_RING}`}
            >
              <span
                aria-hidden="true"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#f59e0b] to-[#7a1c1c] text-xs font-bold text-white shadow-sm ring-2 ring-white"
              >
                {getInitials(user?.full_name)}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block max-w-[130px] truncate text-xs font-bold leading-none text-[#3b0d0d]">
                  {user?.full_name}
                </span>
                <span className="mt-1 block text-[10px] font-semibold capitalize leading-none text-[#8a5a44]">
                  {roleLabel}
                </span>
              </span>
              <Icon
                name="chevronDown"
                className={`hidden h-3.5 w-3.5 text-[#8a5a44] transition-transform sm:block ${
                  openMenu === 'profile' ? 'rotate-180' : ''
                }`}
              />
            </button>

            {openMenu === 'profile' && (
              <div
                role="menu"
                className="absolute right-0 z-50 mt-2 w-64 origin-top-right overflow-hidden rounded-2xl border border-[#f3dcb4] bg-white shadow-xl"
              >
                <div className="bg-gradient-to-br from-[#fff6e5] to-[#ffedd5] px-4 py-3.5">
                  <p className="text-xs font-bold text-[#3b0d0d]">{user?.full_name}</p>
                  {user?.email && <p className="mt-0.5 truncate text-[11px] text-[#64748b]">{user.email}</p>}
                  <span className="mt-2 inline-block rounded-md bg-[#7a1c1c] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-[#fef3c7]">
                    {roleLabel}
                  </span>
                </div>

                <div className="space-y-0.5 p-1.5">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      close();
                      onOpenProfile?.();
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-medium text-[#334155] transition-colors hover:bg-[#fff6e5] focus:bg-[#fff6e5] focus:outline-none"
                  >
                    <span className="rounded-md bg-[#fef3c7] p-1 text-[#b45309]">
                      <Icon name="user" className="h-3.5 w-3.5" />
                    </span>
                    My Profile
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      close();
                      onOpenHelp?.();
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-medium text-[#334155] transition-colors hover:bg-[#fff6e5] focus:bg-[#fff6e5] focus:outline-none"
                  >
                    <span className="rounded-md bg-[#ffedd5] p-1 text-[#c2410c]">
                      <Icon name="lifebuoy" className="h-3.5 w-3.5" />
                    </span>
                    Help &amp; Support
                  </button>
                </div>

                <div className="border-t border-[#f3ede4] p-1.5">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      close();
                      logout();
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-semibold text-[#e11d48] transition-colors hover:bg-[#fff1f2] focus:bg-[#fff1f2] focus:outline-none"
                  >
                    <span className="rounded-md bg-[#ffe4e6] p-1 text-[#e11d48]">
                      <Icon name="logout" className="h-3.5 w-3.5" />
                    </span>
                    Log out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}