// Which pages each CMS login can open. The API enforces the same split (apps/api/src/middleware/roleAccess.ts),
// so hiding a page here is only for convenience: the server refuses the data as well.

export type Role = 'superadmin' | 'admin' | 'website' | 'payments' | 'registration' | 'sales' | 'editor' | 'priest' | 'devotee';

export const STAFF_ROLES: Role[] = ['superadmin', 'admin', 'website', 'payments', 'registration', 'sales', 'editor', 'priest'];

export const ROLE_LABEL: Record<string, string> = {
  superadmin: 'Super admin',
  admin: 'Admin',
  website: 'Website',
  payments: 'Payments',
  registration: 'Registration',
  sales: 'Point of sale',
  editor: 'Website',
  priest: 'Website',
  devotee: 'Devotee',
};

export const ROLE_HELP: Record<string, string> = {
  superadmin: 'Every page, and can add or remove logins.',
  admin: 'Every page, but cannot manage logins.',
  website: 'Website pages: sevas, calendar, donations, camps, magazine, home, about, discover, accommodation and contact.',
  payments: 'Payments, devotee details and devotee records.',
  registration: 'The registers (seva, donation, magazine, camp) and printing labels.',
  sales: 'Point of sale: billing, items, stock, purchases, suppliers and reports.',
};

const WEBSITE = [
  'content-stats', 'sevas', 'panchangam-calendar', 'panchangam', 'donations', 'camps', 'magazine', 'page-home',
  'about-swami', 'about-ashramam', 'about-adhishtanam', 'about-vidyapitham', 'page-accommodation', 'page-contact',
  'discover-audio', 'discover-video', 'discover-album',
];
const PAYMENTS = ['payments-dashboard', 'seva-payments', 'payment-donations', 'payment-magazine', 'devotees', 'devotee-records'];
const REGISTERS = ['seva-register', 'donation-register', 'magazine-register', 'camp-register', 'printing-labels'];
const POS = ['pos', 'pos-new-sale', 'pos-sales', 'pos-items', 'pos-stock', 'pos-purchases', 'pos-suppliers', 'pos-adjustments', 'pos-reports'];

const GROUPS: Record<string, string[]> = {
  website: WEBSITE,
  editor: WEBSITE,
  priest: WEBSITE,
  payments: PAYMENTS,
  registration: REGISTERS,
  sales: POS,
};

// Every page, grouped like the sidebar. The Users page is left out: only a super admin opens it.
export const PAGE_GROUPS: { title: string; pages: { slug: string; label: string }[] }[] = [
  { title: 'Overview', pages: [{ slug: 'dashboard', label: 'Dashboard' }] },
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
    { slug: 'payment-donations', label: 'Donation Payments' }, { slug: 'payment-magazine', label: 'Magazine Payments' },
    { slug: 'devotees', label: 'Devotee Details' }, { slug: 'devotee-records', label: 'Devotee Records' },
  ] },
  { title: 'Registers', pages: [
    { slug: 'seva-register', label: 'Seva Register' }, { slug: 'donation-register', label: 'Donation Register' },
    { slug: 'magazine-register', label: 'Magazine Register' }, { slug: 'camp-register', label: 'Camp Register' }, { slug: 'printing-labels', label: 'Printing Labels' },
  ] },
  { title: 'Point of sale', pages: [
    { slug: 'pos', label: 'POS Dashboard' }, { slug: 'pos-new-sale', label: 'New Sale' }, { slug: 'pos-sales', label: 'Sales' },
    { slug: 'pos-items', label: 'Items' }, { slug: 'pos-stock', label: 'Stock' }, { slug: 'pos-purchases', label: 'Purchases (Stock In)' },
    { slug: 'pos-suppliers', label: 'Suppliers' }, { slug: 'pos-adjustments', label: 'Stock Adjustments' }, { slug: 'pos-reports', label: 'POS Reports' },
  ] },
  { title: 'System', pages: [{ slug: 'settings', label: 'Settings' }] },
];
export const ALL_PAGES: string[] = PAGE_GROUPS.flatMap((g) => g.pages.map((p) => p.slug));

export const isAdminRole = (role?: string) => role === 'superadmin' || role === 'admin';

// The pages a role opens when the login has no list of its own
export const roleDefaultPages = (role?: string): string[] => (isAdminRole(role) ? ALL_PAGES : (GROUPS[role || ''] || []));

// slug is the first part of the page address, for example "sevas" or "pos-sales".
// pages is the login's own ticked list (page_access); when it is empty or missing, the role decides.
export function canOpen(role: string | undefined, slug: string, pages?: string[] | null): boolean {
  if (!role) return false;
  if (slug === 'users') return role === 'superadmin';
  if (isAdminRole(role)) return true;
  if (pages && pages.length) return pages.includes(slug);
  return (GROUPS[role] || []).includes(slug);
}

// The page a login lands on after signing in
export function homeSlug(role?: string, pages?: string[] | null): string {
  if (isAdminRole(role)) return 'dashboard';
  if (pages && pages.length) return ALL_PAGES.find((s) => pages.includes(s)) || 'dashboard';
  switch (role) {
    case 'payments': return 'payments-dashboard';
    case 'registration': return 'seva-register';
    case 'sales': return 'pos';
    default: return 'sevas';
  }
}