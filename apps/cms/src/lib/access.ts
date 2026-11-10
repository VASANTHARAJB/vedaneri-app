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

export const isAdminRole = (role?: string) => role === 'superadmin' || role === 'admin';

// slug is the first part of the page address, for example "sevas" or "pos-sales"
export function canOpen(role: string | undefined, slug: string): boolean {
  if (!role) return false;
  if (slug === 'users') return role === 'superadmin';
  if (isAdminRole(role)) return true;
  return (GROUPS[role] || []).includes(slug);
}

// The page a login lands on after signing in
export function homeSlug(role?: string): string {
  if (isAdminRole(role)) return 'dashboard';
  switch (role) {
    case 'payments': return 'payments-dashboard';
    case 'registration': return 'seva-register';
    case 'sales': return 'pos';
    default: return 'sevas';
  }
}