import React, { useState } from 'react';

interface DevoteeRecord {
  id: string;
  name: string;
  phone: string;
  email: string;
  gotram: string;
  nakshatram: string;
  rasi: string;
  activeSeva: string;
  city: string;
  status: 'Active' | 'Patron' | 'Donor';
  lastBooking: string;
}

const INITIAL_DEVOTEES: DevoteeRecord[] = [
  {
    id: 'DEV-1081',
    name: 'Nagaraj Iyer',
    phone: '+91 95260 82655',
    email: 'nagaraj.iyer@divasprik.com',
    gotram: 'Kashyapa',
    nakshatram: 'Anusham',
    rasi: 'Vrishchika',
    activeSeva: 'Ekadasa Rudrabhishekam',
    city: 'Coimbatore, TN',
    status: 'Patron',
    lastBooking: '20 Oct 2026',
  },
  {
    id: 'DEV-1082',
    name: 'Dr. T. E. Girish',
    phone: '+91 98471 22340',
    email: 'girish.te@keralauniv.ac.in',
    gotram: 'Bharadwaja',
    nakshatram: 'Rohini',
    rasi: 'Rishaba',
    activeSeva: 'Nitya Archana & Annadhanam',
    city: 'Trivandrum, KL',
    status: 'Donor',
    lastBooking: '18 Oct 2026',
  },
  {
    id: 'DEV-1083',
    name: 'Sundaresan Krishnamoorthy',
    phone: '+91 94432 11980',
    email: 'sundar.k@chennai.org',
    gotram: 'Vadhula',
    nakshatram: 'Thiruvathirai',
    rasi: 'Mithuna',
    activeSeva: 'Pradosha Pooja Sankalpam',
    city: 'Theni, TN',
    status: 'Active',
    lastBooking: '15 Oct 2026',
  },
  {
    id: 'DEV-1084',
    name: 'Meenakshi Sundaram & Family',
    phone: '+91 98421 55670',
    email: 'meenakshi.s@madurai.net',
    gotram: 'Kaundinya',
    nakshatram: 'Uthiradam',
    rasi: 'Dhanusu',
    activeSeva: 'Navaratri Chandi Homam',
    city: 'Madurai, TN',
    status: 'Patron',
    lastBooking: '12 Oct 2026',
  },
  {
    id: 'DEV-1085',
    name: 'Venkatesh Ramanathan',
    phone: '+91 97900 44321',
    email: 'v.ramanathan@bangalore.co',
    gotram: 'Haritha',
    nakshatram: 'Hastham',
    rasi: 'Kanni',
    activeSeva: 'Monthly Sankatahara Chaturthi',
    city: 'Bengaluru, KA',
    status: 'Active',
    lastBooking: '08 Oct 2026',
  },
];

export default function DevoteeDirectory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'Patron' | 'Donor' | 'Active'>('All');
  const [devotees] = useState<DevoteeRecord[]>(INITIAL_DEVOTEES);

  const filtered = devotees.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.gotram.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.phone.includes(searchTerm) ||
      d.city.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'All' ? true : d.status === filterType;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-5">
      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Registered Devotees</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">1,428</p>
          <span className="text-[11px] text-emerald-600 font-medium">↑ +38 this month</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Active Daily Sevas</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">142</p>
          <span className="text-[11px] text-amber-700 font-medium">Archana list synced</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Prasadam Postal Pending</p>
          <p className="text-2xl font-bold text-purple-900 mt-1">26</p>
          <span className="text-[11px] text-purple-600 font-medium">Ready for label printing</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Ashram Life Patrons</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">84</p>
          <span className="text-[11px] text-slate-500 font-medium">Special pooja privileges</span>
        </div>
      </div>

      {/* Main SaaS Data Table Card */}
      <div className="bg-white border border-slate-200/90 rounded-xl shadow-2xs overflow-hidden">
        {/* Table Action Header */}
        <div className="p-4 border-b border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-72">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, gotram, phone, city..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-amber-600"
              />
            </div>

            {/* Filter Tabs */}
            <div className="hidden sm:inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium text-slate-600">
              {(['All', 'Patron', 'Donor', 'Active'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilterType(tab)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    filterType === tab ? 'bg-white text-slate-900 font-semibold shadow-2xs' : 'hover:text-slate-900'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 text-xs font-medium border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-700 transition-colors"
            >
              Export CSV
            </button>
            <button className="px-3.5 py-1.5 text-xs font-semibold bg-[#7a1c1c] hover:bg-[#631414] text-white rounded-lg transition-colors shadow-2xs">
              + Add Devotee
            </button>
          </div>
        </div>

        {/* Data Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4 w-10 text-center"><input type="checkbox" className="rounded border-slate-300" /></th>
                <th className="py-3 px-4">Devotee & Contact</th>
                <th className="py-3 px-4">Gothram / Nakshatram</th>
                <th className="py-3 px-4">Rasi</th>
                <th className="py-3 px-4">Enrolled Seva</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 text-center">
                    <input type="checkbox" className="rounded border-slate-300" />
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-900 text-[12.5px] block">{item.name}</span>
                    <span className="text-[11px] text-slate-400">{item.phone} • {item.email}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-medium text-amber-950 block">{item.gotram}</span>
                    <span className="text-[11px] text-slate-500">{item.nakshatram}</span>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800">{item.rasi}</td>
                  <td className="py-3 px-4 font-medium text-[#7a1c1c]">{item.activeSeva}</td>
                  <td className="py-3 px-4 text-slate-500">{item.city}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      item.status === 'Patron'
                        ? 'bg-amber-50 text-amber-900 border-amber-200'
                        : item.status === 'Donor'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-blue-50 text-blue-800 border-blue-200'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="text-purple-700 hover:text-purple-900 font-medium hover:underline">
                        Label
                      </button>
                      <span className="text-slate-300">|</span>
                      <button className="text-slate-600 hover:text-slate-900 font-medium hover:underline">
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Zoho Pagination Controls */}
        <div className="px-4 py-3 bg-slate-50/60 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
          <span>Showing <strong>{filtered.length}</strong> of <strong>{devotees.length}</strong> devotees</span>
          <div className="flex items-center gap-1.5">
            <button className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40" disabled>
              Previous
            </button>
            <span className="px-2 py-1 text-slate-800 font-semibold">1</span>
            <button className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40" disabled>
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}