export interface NavLeaf {
  key: string;
  href: string;
}

export interface NavParent {
  key: string;
  children: NavLeaf[];
}

export type NavItem = NavLeaf | NavParent;

export const NAV: NavItem[] = [
  { key: 'home', href: '' },
  {
    key: 'about',
    children: [
      { key: 'omkarananda', href: '/about/omkarananda' },
      { key: 'ashramam', href: '/about/ashramam' },
      { key: 'adhishtanam', href: '/about/adhishtanam' },
      { key: 'vidyapitham', href: '/about/vidyapitham' },
    ],
  },
  {
    key: 'discourses',
    children: [
      { key: 'audio', href: '/audio' },
      { key: 'video', href: '/video' },
      { key: 'albums', href: '/albums' },
    ],
  },
  { key: 'seva', href: '/sevas' },
  {
  key: 'donations',
  children: [
    { key: 'annadhanamCorpus', href: '/donate/annadhanam-corpus' },
    { key: 'ashramDonation', href: '/donate/ashram-donation' },
  ],
},
  { key: 'magazine', href: '/magazine' },
  { key: 'camps', href: '/camps' },
  {
    key: 'contact',
    children: [
      { key: 'contactUs', href: '/contact' },
      { key: 'accommodation', href: '/contact#accommodation' },
    ],
  },
];