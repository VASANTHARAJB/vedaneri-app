import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../lib/api';
import { useAuth } from '../lib/auth';

interface SankalpamItem {
  id: string;
  devotee_name: string;
  gothram: string;
  nakshatram: string;
  rasi: string;
  seva_name: string;
  is_completed: boolean;
  notes?: string;
  contact_phone?: string;
}

export default function SankalpamRoster() {
  const { token } = useAuth();
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [entries, setEntries] = useState<SankalpamItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoster = async (selectedDate: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/sankalpam/roster?date=${selectedDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoster(date);
  }, [date]);

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    // Optimistic UI update
    setEntries((prev) =>
      prev.map((item) => (item.id === id ? { ...item, is_completed: newStatus } : item))
    );

    try {
      await fetch(`${API_BASE_URL}/sankalpam/${id}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ completed: newStatus }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>🕉️</span> Daily Sankalpam & Priest Roster
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Archana, Gothram & Nakshatram lists for ashram priests and morning rituals.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-[#7a1c1c] shadow-sm"
          />
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg shadow transition-colors flex items-center gap-1.5"
          >
            🖨️ <span>Print Roster</span>
          </button>
        </div>
      </div>

      {/* Roster Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading daily sankalpam list...</div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No sankalpam bookings scheduled for this date ({date}).
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-12 text-center">Status</th>
                  <th className="py-3.5 px-4">Devotee Name</th>
                  <th className="py-3.5 px-4">Gothram</th>
                  <th className="py-3.5 px-4">Nakshatram / Rasi</th>
                  <th className="py-3.5 px-4">Seva / Pooja</th>
                  <th className="py-3.5 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {entries.map((item) => (
                  <tr
                    key={item.id}
                    className={`transition-colors hover:bg-slate-50/60 ${
                      item.is_completed ? 'bg-emerald-50/30' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={item.is_completed}
                        onChange={() => toggleStatus(item.id, item.is_completed)}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                        title="Mark Pooja as Completed"
                      />
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {item.devotee_name}
                      {item.contact_phone && (
                        <span className="block text-[11px] font-normal text-slate-400">
                          {item.contact_phone}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-amber-900">{item.gothram || '—'}</td>
                    <td className="py-3.5 px-4 text-slate-700">
                      <span className="font-medium text-slate-900">{item.nakshatram || '—'}</span>
                      {item.rasi && <span className="text-xs text-slate-400 ml-1.5">({item.rasi})</span>}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-[#7a1c1c]">{item.seva_name}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">{item.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}