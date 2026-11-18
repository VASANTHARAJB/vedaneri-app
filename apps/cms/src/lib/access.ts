// Which pages each CMS login can open. The API enforces the same split (apps/api/src/middleware/roleAccess.ts),
// so hiding a page here is only for convenience: the server refuses the data as well.
//
// The rule: only a super admin opens everything. Every other login (admin, GM, developer, website, payments, registration, sales)
// opens only the pages a super admin ticked for it on the Users page.
// Logins made before this rule, with no ticked pages yet, keep what their role always had until a super admin sets their pages.

export type Role = 'superadmin' | 'admin' | 'gm' | 'developer' | 'website' | 'payments' | 'registration' | 'sales' | 'editor' | 'priest' | 'devotee';

export const STAFF_ROLES: Role[] = ['superadmin', 'admin', 'gm', 'developer', 'website', 'payments', 'registration', 'sales', 'editor', 'priest'];

export const ROLE_LABEL: Record<string, string> = {
  superadmin: 'Super admin',
  admin: 'Admin',
  gm: 'General manager',
  developer: 'Developer',
  website: 'Website',
  payments: 'Payments',
  registration: 'Registration',
  sales: 'Point of sale',
  editor: 'Website',
  priest: 'Website',
  devotee: 'Devotee',
};

export const ROLE_HELP: Record<string, string> = {
  superadmin: 'Every page, and the only role that can add or remove logins and give pages.',
  admin: 'Only the pages a super admin ticks. Nothing is open until pages are ticked.',
  gm: 'General manager. Only the pages a super admin ticks, usually the GM Report Dashboard. With the Users page ticked, a GM can make logins for its own team.',
  developer: 'Developer. Only the pages a super admin ticks, usually the Developer Dashboard.',
  website: 'Only the pages a super admin ticks, usually the website pages.',
  payments: 'Only the pages a super admin ticks, usually payments and devotees.',
  registration: 'Only the pages a super admin ticks, usually the registers and offline registration.',
  sales: 'Only the pages a super admin ticks, usually point of sale.',
};

const WEBSITE = [
  'content-stats', 'sevas', 'panchangam-calendar', 'panchangam', 'donations', 'camps', 'magazine', 'page-home',
  'about-swami', 'about-ashramam', 'about-adhishtanam', 'about-vidyapitham', 'page-accommodation', 'page-contact',
  'discover-audio', 'discover-video', 'discover-album',
];
const PAYMENTS = ['payments-dashboard', 'seva-payments', 'payment-donations', 'payment-magazine', 'payment-camps', 'devotees', 'devotee-records'];
const REGISTERS = [
  'seva-register', 'seva-offline', 'donation-register', 'donation-offline', 'magazine-register', 'magazine-offline',
  'camp-register', 'camp-offline', 'printing-labels',
];
const POS = ['pos', 'pos-new-sale', 'pos-sales', 'pos-items', 'pos-stock', 'pos-purchases', 'pos-suppliers', 'pos-adjustments', 'pos-reports'];

// What the older roles always had, for logins that have no ticked pages yet
const LEGACY: Record<string, string[]> = {
  website: WEBSITE,
  editor: WEBSITE,
  priest: WEBSITE,
  payments: PAYMENTS,
  registration: REGISTERS,
  sales: POS,
};

// The usual pages of a role: offered as a one-click tick, never ticked by itself
const USUAL: Record<string, string[]> = {
  ...LEGACY,
  gm: ['dashboard-gm'],
  admin: ['dashboard-admin'],
  developer: ['dashboard-developer'],
};

// Every page, grouped like the sidebar. The Users page is last: a super admin opens it always; any other login only when it is ticked (it then manages its own team).
export const PAGE_GROUPS: { title: string; pages: { slug: string; label: string }[] }[] = [
  { title: 'Overview', pages: [{ slug: 'dashboard', label: 'Dashboard' }] },
  { title: 'Dashboards', pages: [
    { slug: 'dashboard-gm', label: 'GM Report Dashboard' }, { slug: 'dashboard-admin', label: 'Admin Dashboard' }, { slug: 'dashboard-developer', label: 'Developer Dashboard' },
  ] },
  { title: 'Website', pages: [
    { slug: 'content-stats', label: 'Content Stats' }, { slug: 'sevas', label: 'Sevas' }, { slug: 'panchangam-calendar', label: 'Tamil Calendar' },
    { slug: 'panchangam', label: 'Panchangam Manager' }, { slug: 'donations', label: 'Donations' }, { slug: 'camps', label: 'Camps' },
    { slug: 'magazine', label: 'Magazine' }, { slug: 'page-home', label: 'Home Page' },
  ] },
  { title: 'About', pages: [
    { slug: 'about-swami', label: 'Sri Swami Omkarananda' }, { slug: 'about-ashramam', label: 'Ashramam' },
    { slug: 'about-adhishtanam', label: 'Adhishtanam' }, { slug: 'about-vidyapitham', label: 'Vidyapitham' },
  ] },
  { title: 'Website pages', pages: [{ slug: 'page-accommodation', label: 'Accommodation' }, { slug: 'page-contact', label: 'Contact Page' }] },
  { title: 'Discover', pages: [{ slug: 'discover-audio', label: 'Audio' }, { slug: 'discover-video', label: 'Video' }, { slug: 'discover-album', label: 'Album' }] },
  { title: 'Payments', pages: [
    { slug: 'payments-dashboard', label: 'Payments Dashboard' }, { slug: 'seva-payments', label: 'Seva Payments' },
    { slug: 'payment-donations', label: 'Donation Payments' }, { slug: 'payment-magazine', label: 'Magazine Payments' }, { slug: 'payment-camps', label: 'Camp Payments' },
    { slug: 'devotees', label: 'Devotee Details' }, { slug: 'devotee-records', label: 'Devotee Records' },
  ] },
  { title: 'Registers', pages: [
    { slug: 'seva-register', label: 'Seva Register' }, { slug: 'seva-offline', label: 'Seva Offline Registration' },
    { slug: 'donation-register', label: 'Donation Register' }, { slug: 'donation-offline', label: 'Donation Offline Registration' },
    { slug: 'magazine-register', label: 'Magazine Register' }, { slug: 'magazine-offline', label: 'Magazine Offline Registration' },
    { slug: 'camp-register', label: 'Camp Register' }, { slug: 'camp-offline', label: 'Camp Offline Registration' },
    { slug: 'printing-labels', label: 'Printing Labels' },
  ] },
  { title: 'Forms', pages: [{ slug: '80g-form', label: '80G Form (permission only, the page comes later)' }] },
  { title: 'Point of sale', pages: [
    { slug: 'pos', label: 'POS Dashboard' }, { slug: 'pos-new-sale', label: 'New Sale' }, { slug: 'pos-sales', label: 'Sales' },
    { slug: 'pos-items', label: 'Items' }, { slug: 'pos-stock', label: 'Stock' }, { slug: 'pos-purchases', label: 'Purchases (Stock In)' },
    { slug: 'pos-suppliers', label: 'Suppliers' }, { slug: 'pos-adjustments', label: 'Stock Adjustments' }, { slug: 'pos-reports', label: 'POS Reports' },
  ] },
  { title: 'System', pages: [{ slug: 'settings', label: 'Settings' }, { slug: 'users', label: 'Users (make and manage its own team logins)' }] },
];
export const ALL_PAGES: string[] = PAGE_GROUPS.flatMap((g) => g.pages.map((p) => p.slug));

// Pages that only open when ticked, even for a login that has no ticked list yet
const TICK_ONLY = (slug: string) => slug.startsWith('dashboard-') || slug === '80g-form';

export const isSuper = (role?: string) => role === 'superadmin';
// Kept for the older screens: an admin role has the same meaning as before for logins without ticked pages
export const isAdminRole = (role?: string) => role === 'superadmin' || role === 'admin';

// The pages a role usually needs (for the "Tick the usual pages" button)
export const roleDefaultPages = (role?: string): string[] => (isSuper(role) ? ALL_PAGES : (USUAL[role || ''] || []));

// slug is the first part of the page address, for example "sevas" or "pos-sales".
// pages is the login's own ticked list (page_access).
export function canOpen(role: string | undefined, slug: string, pages?: string[] | null): boolean {
  if (!role) return false;
  if (slug === 'no-access') return true;
  if (isSuper(role)) return true;
  if (slug === 'users') return !!pages && pages.includes('users');
  if (pages && pages.length) return pages.includes(slug);
  // No ticked pages: only what the older roles always had. Admin keeps every older page; the new dashboards and forms need a tick.
  if (TICK_ONLY(slug)) return false;
  if (role === 'admin') return true;
  return (LEGACY[role] || []).includes(slug);
}

// The page a login lands on after signing in. A login that can open nothing is sent to a page that says so.
export function homeSlug(role?: string, pages?: string[] | null): string {
  if (isSuper(role)) return 'dashboard';
  if (pages && pages.length) return ALL_PAGES.find((s) => pages.includes(s) && !s.startsWith('80g')) || 'no-access';
  if (role === 'admin') return 'dashboard';
  switch (role) {
    case 'payments': return 'payments-dashboard';
    case 'registration': return 'seva-register';
    case 'sales': return 'pos';
    case 'website': case 'editor': case 'priest': return 'sevas';
    default: return 'no-access';
  }
}

// The pages a login really opens right now: its ticked list, or what its older role gives it while no list is set
export function currentPages(role: string | undefined, pages?: string[] | null): string[] {
  if (isSuper(role)) return ALL_PAGES;
  return ALL_PAGES.filter((s) => canOpen(role, s, pages));
}