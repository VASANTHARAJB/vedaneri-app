// Main menu. Change the order or add items here; labels come from the dictionaries (en.json / ta.json).
// href '' means the language home page (/en or /ta).
export const NAV = [
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
  { key: 'donations', href: '/donate' },
  { key: 'magazine', href: '/magazine' },
  { key: 'camps', href: '/camps' },
] as const;