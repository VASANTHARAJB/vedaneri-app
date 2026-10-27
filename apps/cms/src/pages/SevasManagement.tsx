'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL } from '../lib/api';
import { useAuth } from '../lib/auth';

const CARD = 'rounded-2xl border border-[#f0e2c8] bg-white shadow-sm';

const FOCUS =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f59e0b]/60 focus-visible:ring-offset-1';

const LABEL = 'block font-bold text-[#5b2a1a] mb-1 text-xs';
const INPUT =
  'w-full rounded-xl border border-[#f0e2c8] bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#ea580c] focus:outline-none';

export type RecurrenceType = 'none' | 'annual' | 'monthly_tithi';
type ViewKey = 'all' | 'seva' | 'corpus' | 'published' | 'draft' | 'events';
type SortKey = 'title' | 'price' | 'status';

interface OfferingItem {
  id: string | number;
  slug?: string;
  title_en: any;
  title_ta: any;
  display_title_en?: string;
  display_title_ta?: string;
  description_en: any;
  description_ta: any;
  amount?: number;
  price?: number;
  price_type: 'fixed' | 'custom';
  category: 'seva' | 'corpus';
  status: 'published' | 'draft';
  image_url?: string;
  last_updated?: string;
  is_event_seva?: boolean;
  recurrence_type?: RecurrenceType;
  event_date?: string | null;
  tithi_trigger?: string;
  panchangam_tag?: string;
}

const VIEWS: { key: ViewKey; label: string }[] = [
  { key: 'all', label: 'All Items' },
  { key: 'seva', label: 'Seva List' },
  { key: 'corpus', label: 'Corpus Funds' },
  { key: 'published', label: 'Published' },
  { key: 'draft', label: 'Drafts' },
  { key: 'events', label: 'Events & Recurring' },
];

const COMMON_TITHI_TRIGGERS = [
  { id: 'Sashti', label: 'Skanda Shashti (சஷ்டி)', example: 'Sukla Paksha Sashti' },
  { id: 'Pradosham', label: 'Pradosham (பிரதோஷம்)', example: 'Trayodasi' },
  { id: 'Sankatahara Chaturthi', label: 'Sankatahara Chaturthi (சதுர்த்தி)', example: 'Krishna Paksha Chaturthi' },
  { id: 'Pournami', label: 'Pournami (பௌர்ணமி)', example: 'Full Moon' },
  { id: 'Amavasai', label: 'Amavasai (அமாவாசை)', example: 'New Moon' },
  { id: 'Kiruthigai', label: 'Karthigai / Kiruthigai (கிருத்திகை)', example: 'Krittika Nakshatram' },
];

const RECURRENCE_OPTIONS: { key: RecurrenceType; title: string; desc: string }[] = [
  { key: 'none', title: 'Regular Seva', desc: 'Devotee can choose any preferred date on booking' },
  { key: 'annual', title: 'Annual Festival', desc: 'Pinned to a specific occasion (e.g. Annabishekam)' },
  { key: 'monthly_tithi', title: 'Monthly Recurring', desc: 'Repeats every month (e.g. Sashti, Pradosham)' },
];

const EMPTY_FORM = {
  title_en: '',
  title_ta: '',
  description_en: '',
  description_ta: '',
  price_type: 'fixed' as 'fixed' | 'custom',
  amount: '',
  category: 'seva' as 'seva' | 'corpus',
  status: 'published' as 'published' | 'draft',
  image_url: '',
  recurrence_type: 'none' as RecurrenceType,
  event_date: '',
  tithi_trigger: 'Sashti',
  panchangam_tag: '',
};

type FormState = typeof EMPTY_FORM;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// ---------- helpers ----------

// Converts relative '/uploads/...' to full backend URL
function getImageUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const backendOrigin = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${backendOrigin}${cleanPath}`;
}

// Safe language extractor: string, JSON string, or { en, ta }
function toText(val: any, lang: 'en' | 'ta' = 'en'): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        return toText(JSON.parse(trimmed), lang);
      } catch (_) {
        return val;
      }
    }
    return val;
  }
  if (typeof val === 'object') {
    if (lang === 'ta') return String(val.ta || val.tamil || '');
    return String(val.en || val.english || '');
  }
  return String(val);
}

// Phonetic English -> Tamil transliteration (unofficial Google Input Tools endpoint)
async function transliterateToTamil(text: string): Promise<string> {
  if (!text || !text.trim()) return '';
  try {
    const res = await fetch(
      `https://inputtools.google.com/request?text=${encodeURIComponent(text)}&itc=ta-t-i0-und&num=1`
    );
    if (res.ok) {
      const data = await res.json();
      if (data && data[1] && data[1][0] && data[1][0][1] && data[1][0][1][0]) {
        return data[1][0][1][0];
      }
    }
  } catch (_) {}
  return '';
}

function getItemAmount(item: any): number {
  if (!item) return 0;
  const val = item.amount ?? item.price ?? item.base_amount ?? item.fixed_amount;
  if (val === null || val === undefined || val === '') return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

// Returns YYYY-MM-DD. Plain dates pass through; ISO timestamps are read in the
// browser's local timezone (correct for an admin in IST even if the API sends 18:30Z).
function toDateOnly(d?: string | null): string {
  if (!d) return '';
  const s = String(d);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dt = new Date(s);
  if (isNaN(dt.getTime())) return s.split('T')[0];
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

function formatDisplayDate(d?: string | null): string {
  const iso = toDateOnly(d);
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function matchesView(item: OfferingItem, view: ViewKey): boolean {
  switch (view) {
    case 'seva':
      return item.category === 'seva';
    case 'corpus':
      return item.category === 'corpus';
    case 'published':
      return item.status === 'published';
    case 'draft':
      return item.status === 'draft';
    case 'events':
      return (item.recurrence_type || 'none') !== 'none';
    default:
      return true;
  }
}

// ---------- small components ----------

function SevaImage({
  src,
  alt,
  category,
  recurrenceType,
}: {
  src?: string;
  alt: string;
  category: string;
  recurrenceType?: RecurrenceType;
}) {
  const [hasError, setHasError] = useState(false);
  const fullUrl = getImageUrl(src);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!fullUrl || hasError) {
    return (
      <div className="h-10 w-10 rounded-lg bg-[#fff3df] text-[#c2410c] flex items-center justify-center text-base border border-[#fde68a] shrink-0">
        {category === 'corpus'
          ? '🏛️'
          : recurrenceType === 'monthly_tithi'
          ? '🔄'
          : recurrenceType === 'annual'
          ? '✨'
          : '🪔'}
      </div>
    );
  }

  return (
    <img
      src={fullUrl}
      alt={alt}
      onError={() => setHasError(true)}
      className="h-10 w-10 rounded-lg object-cover border border-[#f0e2c8] shrink-0"
    />
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
  align = 'left',
}: {
  label: string;
  active: boolean;
  dir: 'asc' | 'desc';
  onClick: () => void;
  align?: 'left' | 'center';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 uppercase tracking-wider font-bold cursor-pointer hover:text-[#3b0d0d] ${
        align === 'center' ? 'justify-center w-full' : ''
      } ${active ? 'text-[#3b0d0d]' : ''}`}
    >
      {label}
      <span className="text-[9px]">{active ? (dir === 'asc' ? '▲' : '▼') : '↕'}</span>
    </button>
  );
}

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 pb-5 border-b border-[#f6ecd9] last:border-b-0 last:pb-0">
      <h4 className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#8a5a44]">{title}</h4>
      {children}
    </section>
  );
}

// ---------- main component ----------

export default function SevasManagement() {
  const auth = useAuth() as any;
  const authToken = auth?.token;

  const getToken = useCallback((): string | null => {
    if (authToken) return authToken;
    if (typeof window === 'undefined') return null;
    return (
      localStorage.getItem('token') ||
      localStorage.getItem('auth_token') ||
      localStorage.getItem('accessToken')
    );
  }, [authToken]);

  const [items, setItems] = useState<OfferingItem[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // List controls
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<ViewKey>('all');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string | number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [rowMenu, setRowMenu] = useState<{ id: string | number; top: number; left: number } | null>(null);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OfferingItem | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const formRef = useRef<FormState>(form);
  formRef.current = form;
  const initialFormJson = useRef<string>(JSON.stringify(EMPTY_FORM));

  // Transliteration guards
  const [isTamilTitleTouched, setIsTamilTitleTouched] = useState(false);
  const translitReqVersion = useRef(0);
  const titleTimer = useRef<any>(null);

  // Image upload
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const toastTimer = useRef<any>(null);
  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  // ---------- data ----------

  const fetchItems = useCallback(
    async (isInitial = false) => {
      const token = getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      try {
        if (isInitial) setInitialLoading(true);
        setFetchError(null);

        const res = await fetch(`${API_BASE_URL}/offerings`, { headers });
        if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);

        const data = await res.json();
        const rawList = data.sevas || data.offerings || data.items || [];

        const normalized: OfferingItem[] = rawList.map((it: any) => {
          const num = getItemAmount(it);
          const rType: RecurrenceType = it.recurrence_type || (it.is_event_seva ? 'annual' : 'none');
          return {
            ...it,
            amount: num,
            price: num,
            price_type: it.price_type || (num > 0 ? 'fixed' : 'custom'),
            recurrence_type: rType,
          };
        });

        setItems(normalized);
        const ids = new Set(normalized.map((n) => n.id));
        setSelected((prev) => new Set(Array.from(prev).filter((id) => ids.has(id))));
      } catch (err: any) {
        console.error('Fetch offerings error:', err);
        setFetchError(err.message || 'Unable to connect to service');
      } finally {
        if (isInitial) setInitialLoading(false);
      }
    },
    [getToken]
  );

  useEffect(() => {
    fetchItems(true);
  }, [fetchItems]);

  useEffect(() => {
    return () => {
      if (titleTimer.current) clearTimeout(titleTimer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // ---------- derived ----------

  const stats = useMemo(
    () => ({
      total: items.length,
      sevaCount: items.filter((s) => s.category === 'seva').length,
      corpusCount: items.filter((s) => s.category === 'corpus').length,
      publishedCount: items.filter((s) => s.status === 'published').length,
    }),
    [items]
  );

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = items.filter((item) => {
      if (!matchesView(item, view)) return false;
      if (!q) return true;
      const titleEn = toText(item.title_en, 'en').toLowerCase();
      const titleTa = toText(item.title_ta, 'ta').toLowerCase();
      return titleEn.includes(q) || titleTa.includes(q);
    });

    if (!sortKey) return list;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortKey === 'title') {
        return (
          dir *
          (item_title(a) as string).localeCompare(item_title(b) as string, undefined, { sensitivity: 'base' })
        );
      }
      if (sortKey === 'price') {
        return dir * (getItemAmount(a) - getItemAmount(b));
      }
      // status: published first when ascending
      const av = a.status === 'published' ? 0 : 1;
      const bv = b.status === 'published' ? 0 : 1;
      return dir * (av - bv);
    });
  }, [items, searchQuery, view, sortKey, sortDir]);

  function item_title(it: OfferingItem): string {
    return it.display_title_en || toText(it.title_en, 'en') || it.slug || '';
  }

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageItems = filteredItems.slice(pageStart, pageStart + pageSize);
  const pageIds = pageItems.map((i) => i.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageSelected = pageIds.some((id) => selected.has(id));

  // Reset page + selection when the list definition changes
  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [view, searchQuery, pageSize]);

  const toggleSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortKey(null);
      setSortDir('asc');
    }
  };

  const toggleSelectAllOnPage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const toggleSelectOne = (id: string | number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ---------- row menu (fixed position so the scroll area never clips it) ----------

  useEffect(() => {
    if (!rowMenu) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-row-menu]')) setRowMenu(null);
    };
    const close = () => setRowMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRowMenu(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [rowMenu]);

  const openRowMenu = (e: React.MouseEvent, id: string | number) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const MENU_H = 132;
    const MENU_W = 176;
    const top = rect.bottom + MENU_H + 8 > window.innerHeight ? rect.top - MENU_H - 4 : rect.bottom + 4;
    const left = Math.max(8, rect.right - MENU_W);
    setRowMenu((prev) => (prev?.id === id ? null : { id, top, left }));
  };

  // ---------- API actions ----------

  const apiToggle = async (id: string | number): Promise<boolean> => {
    const token = getToken();
    try {
      const res = await fetch(`${API_BASE_URL}/offerings/${id}/toggle-status`, {
        method: 'PATCH',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return res.ok;
    } catch (_) {
      return false;
    }
  };

  const apiDelete = async (id: string | number): Promise<boolean> => {
    const token = getToken();
    try {
      const res = await fetch(`${API_BASE_URL}/offerings/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return res.ok;
    } catch (_) {
      return false;
    }
  };

  const handleToggleStatus = async (id: string | number) => {
    // Optimistic update, reverted by refetch on failure
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: item.status === 'published' ? 'draft' : 'published' } : item
      )
    );
    const ok = await apiToggle(id);
    if (!ok) {
      showToast('Could not change status. Reverted.', 'error');
      fetchItems(false);
    }
  };

  const handleDelete = async (id: string | number) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    const ok = await apiDelete(id);
    if (ok) {
      showToast('Record deleted.');
      fetchItems(false);
    } else {
      showToast('Could not delete this record.', 'error');
    }
  };

  // Bulk actions: loops over the existing endpoints (not atomic)
  const runBulk = async (action: 'publish' | 'unpublish' | 'delete') => {
    const chosen = items.filter((i) => selected.has(i.id));
    if (chosen.length === 0 || bulkBusy) return;

    let targets = chosen;
    if (action === 'publish') targets = chosen.filter((i) => i.status !== 'published');
    if (action === 'unpublish') targets = chosen.filter((i) => i.status !== 'draft');

    if (action !== 'delete' && targets.length === 0) {
      showToast(action === 'publish' ? 'Selected items are already published.' : 'Selected items are already drafts.', 'info');
      return;
    }
    if (
      action === 'delete' &&
      !window.confirm(`Delete ${targets.length} selected record(s)? This cannot be undone.`)
    ) {
      return;
    }

    setBulkBusy(true);
    const results = await Promise.allSettled(
      targets.map((t) => (action === 'delete' ? apiDelete(t.id) : apiToggle(t.id)))
    );
    const okCount = results.filter((r) => r.status === 'fulfilled' && r.value === true).length;
    const failCount = targets.length - okCount;
    setBulkBusy(false);
    setSelected(new Set());
    await fetchItems(false);

    const verb = action === 'delete' ? 'deleted' : action === 'publish' ? 'published' : 'moved to draft';
    if (failCount === 0) showToast(`${okCount} item(s) ${verb}.`);
    else showToast(`${okCount} item(s) ${verb}, ${failCount} failed.`, 'error');
  };

  // ---------- drawer ----------

  const isDirty = () => JSON.stringify(formRef.current) !== initialFormJson.current;

  const closeDrawer = useCallback((force = false) => {
    if (!force && JSON.stringify(formRef.current) !== initialFormJson.current) {
      if (!window.confirm('Discard your unsaved changes?')) return;
    }
    if (titleTimer.current) clearTimeout(titleTimer.current);
    translitReqVersion.current += 1; // invalidate in-flight transliteration
    setDrawerOpen(false);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [drawerOpen, closeDrawer]);

  const openDrawer = (item?: OfferingItem) => {
    if (titleTimer.current) clearTimeout(titleTimer.current);
    translitReqVersion.current += 1; // invalidate in-flight transliteration from a previous form
    setRowMenu(null);

    let next: FormState;
    if (item) {
      const amt = getItemAmount(item);
      const rType: RecurrenceType = item.recurrence_type || (item.is_event_seva ? 'annual' : 'none');
      const taTitle = toText(item.title_ta, 'ta');
      setIsTamilTitleTouched(Boolean(taTitle.trim()));
      setEditingItem(item);
      next = {
        title_en: toText(item.title_en, 'en'),
        title_ta: taTitle,
        description_en: toText(item.description_en, 'en'),
        description_ta: toText(item.description_ta, 'ta'),
        price_type: item.price_type || 'fixed',
        amount: item.price_type === 'custom' ? '' : amt > 0 ? String(amt) : '',
        category: item.category || 'seva',
        status: item.status || 'published',
        image_url: item.image_url || '',
        recurrence_type: rType,
        event_date: toDateOnly(item.event_date),
        tithi_trigger: item.tithi_trigger || 'Sashti',
        panchangam_tag: item.panchangam_tag || '',
      };
    } else {
      setIsTamilTitleTouched(false);
      setEditingItem(null);
      next = { ...EMPTY_FORM };
    }
    initialFormJson.current = JSON.stringify(next);
    setForm(next);
    setDrawerOpen(true);
  };

  // English title -> Tamil fill, only while the Tamil title is untouched
  const handleEnglishTitleChange = (val: string) => {
    setForm((prev) => ({ ...prev, title_en: val }));
    if (isTamilTitleTouched) return;

    if (titleTimer.current) clearTimeout(titleTimer.current);
    const currentVersion = ++translitReqVersion.current;

    titleTimer.current = setTimeout(async () => {
      if (!val.trim()) return;
      const tamil = await transliterateToTamil(val);
      if (currentVersion === translitReqVersion.current && tamil) {
        setForm((prev) => ({ ...prev, title_ta: tamil }));
      }
    }, 450);
  };

  const handleTransliterateDescManual = async () => {
    if (!form.description_en.trim()) return;
    const version = translitReqVersion.current;
    const tamil = await transliterateToTamil(form.description_en);
    if (version === translitReqVersion.current && tamil) {
      setForm((prev) => ({ ...prev, description_ta: tamil }));
    } else if (!tamil) {
      showToast('Could not convert right now. Please type the Tamil text.', 'error');
    }
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_IMAGE_BYTES) {
      showToast('Image exceeds the 5MB limit. Please choose a smaller one.', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const token = getToken();
    const formData = new FormData();
    formData.append('image', file);

    try {
      setUploadingImage(true);
      const res = await fetch(`${API_BASE_URL}/offerings/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (res.ok) {
        const json = await res.json();
        setForm((prev) => ({ ...prev, image_url: json.url }));
      } else {
        showToast('Image upload failed. The server rejected the file.', 'error');
      }
    } catch (err) {
      console.error('Image upload error:', err);
      showToast('Image upload failed. Check your connection.', 'error');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const token = getToken();

    const numAmt = form.price_type === 'custom' ? 0 : Number(form.amount || 0);
    const isEvent = form.recurrence_type !== 'none';

    const payload = {
      ...form,
      amount: numAmt,
      price: numAmt,
      base_amount: numAmt,
      fixed_amount: numAmt,
      is_event_seva: isEvent,
      recurrence_type: form.recurrence_type,
      event_date: form.recurrence_type === 'annual' ? form.event_date : null,
      tithi_trigger: form.recurrence_type === 'monthly_tithi' ? form.tithi_trigger : null,
      panchangam_tag: form.panchangam_tag || form.tithi_trigger || '',
    };

    try {
      setSaving(true);
      const url = editingItem ? `${API_BASE_URL}/offerings/${editingItem.id}` : `${API_BASE_URL}/offerings`;
      const method = editingItem ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        closeDrawer(true);
        showToast(editingItem ? 'Changes saved.' : 'Entry created.');
        fetchItems(false);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'Failed to save entry.', 'error');
      }
    } catch (err) {
      console.error('Submit error:', err);
      showToast('Network error connecting to the server.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setView('all');
  };

  const menuItem = rowMenu ? items.find((i) => i.id === rowMenu.id) : null;

  // ---------- render ----------

  const statCards: { key: ViewKey; label: string; value: number; color: string; chip: string; chipBg: string }[] = [
    { key: 'all', label: 'Total Offerings', value: stats.total, color: 'text-[#3b0d0d]', chip: 'Incl. drafts', chipBg: 'bg-[#fff8ec] text-[#8a5a44]' },
    { key: 'seva', label: 'Sevas Catalog', value: stats.sevaCount, color: 'text-[#c2410c]', chip: 'Pooja Rituals', chipBg: 'bg-[#fff3df] text-[#c2410c]' },
    { key: 'corpus', label: 'Corpus Funds', value: stats.corpusCount, color: 'text-[#7a1c1c]', chip: 'Endowments', chipBg: 'bg-[#fdebec] text-[#7a1c1c]' },
    { key: 'published', label: 'Published Live', value: stats.publishedCount, color: 'text-[#047857]', chip: 'Public Portal', chipBg: 'bg-[#ecfdf5] text-[#047857]' },
  ];

  return (
    <div className="space-y-5">
      <style>{`
        @keyframes seva-drawer-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes seva-fade-in { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-[#3b0d0d] tracking-tight">Sevas & Corpus Management</h1>
          <p className="text-xs text-[#8a5a44] mt-1 font-medium">
            Manage poojas, annual festival events & recurring tithi rituals.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openDrawer()}
          className={`flex items-center gap-1.5 rounded-xl bg-[#fbbf24] px-4 py-2.5 text-xs font-bold text-[#3b0d0d] shadow-sm transition-all hover:bg-[#fcd34d] cursor-pointer ${FOCUS}`}
        >
          <span className="text-sm font-extrabold">+</span>
          <span>Add Seva / Corpus</span>
        </button>
      </div>

      {/* 2. Stat cards (click to apply a view) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setView(c.key)}
            className={`${CARD} p-4 text-left cursor-pointer transition-all hover:border-[#ea580c]/50 ${FOCUS} ${
              view === c.key ? 'ring-2 ring-[#ea580c]/40 border-[#ea580c]/60' : ''
            }`}
          >
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#8a5a44] block">{c.label}</span>
            <div className="mt-1.5 flex items-baseline justify-between gap-2">
              <span className={`text-2xl font-extrabold tracking-tight ${c.color}`}>{c.value}</span>
              <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md ${c.chipBg}`}>{c.chip}</span>
            </div>
          </button>
        ))}
      </div>

      {/* 3. List toolbar */}
      <div className={`${CARD} overflow-hidden`}>
        <div className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#f6ecd9]">
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={view}
              onChange={(e) => setView(e.target.value as ViewKey)}
              aria-label="Select view"
              className={`rounded-xl border border-[#f0e2c8] bg-[#fff8ec] px-3 py-2 text-xs font-bold text-[#3b0d0d] cursor-pointer ${FOCUS}`}
            >
              {VIEWS.map((v) => (
                <option key={v.key} value={v.key}>
                  {v.label}
                </option>
              ))}
            </select>
            <span className="text-xs font-semibold text-[#8a5a44]">
              {filteredItems.length} record{filteredItems.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title (English / தமிழ்)..."
              className="w-full md:w-72 rounded-xl border border-[#f0e2c8] bg-[#fffaf4] px-3.5 py-2 text-xs text-[#3b0d0d] placeholder:text-[#b59a86] focus:border-[#ea580c] focus:bg-white focus:outline-none"
            />
            {(searchQuery || view !== 'all') && (
              <button
                type="button"
                onClick={clearFilters}
                className="whitespace-nowrap text-xs font-bold text-[#ea580c] hover:underline cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="px-3 py-2 bg-[#fff3df] border-b border-[#fde68a] flex flex-wrap items-center gap-2 text-xs">
            <span className="font-extrabold text-[#3b0d0d]">{selected.size} selected</span>
            <span className="text-[#d6b98c]">|</span>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => runBulk('publish')}
              className="px-3 py-1 rounded-lg border border-[#a7f3d0] bg-white text-[#047857] font-bold hover:bg-[#ecfdf5] cursor-pointer disabled:opacity-60"
            >
              Publish
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => runBulk('unpublish')}
              className="px-3 py-1 rounded-lg border border-[#fde68a] bg-white text-[#b45309] font-bold hover:bg-[#fffbeb] cursor-pointer disabled:opacity-60"
            >
              Unpublish
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => runBulk('delete')}
              className="px-3 py-1 rounded-lg border border-rose-200 bg-white text-rose-600 font-bold hover:bg-rose-50 cursor-pointer disabled:opacity-60"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="ml-auto text-[#8a5a44] font-bold hover:underline cursor-pointer"
            >
              {bulkBusy ? 'Working...' : 'Clear selection'}
            </button>
          </div>
        )}

        {/* Error banner (data stays visible) */}
        {fetchError && items.length > 0 && (
          <div className="px-3 py-2 bg-rose-50 border-b border-rose-200 text-xs text-rose-700 flex items-center justify-between gap-3">
            <span className="font-semibold">Could not refresh: {fetchError}</span>
            <button
              type="button"
              onClick={() => fetchItems(false)}
              className="font-bold underline cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* 4. Table */}
        <div className="overflow-auto max-h-[65vh]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#fff8ec] border-b border-[#f6ecd9] text-[10.5px] font-bold uppercase tracking-wider text-[#8a5a44]">
                <th className="py-3 pl-4 pr-2 w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all on this page"
                    checked={allPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = somePageSelected && !allPageSelected;
                    }}
                    onChange={toggleSelectAllOnPage}
                    className="h-3.5 w-3.5 accent-[#ea580c] cursor-pointer"
                  />
                </th>
                <th className="py-3 px-3 min-w-[260px]">
                  <SortHeader label="Offering" active={sortKey === 'title'} dir={sortDir} onClick={() => toggleSort('title')} />
                </th>
                <th className="py-3 px-3 w-32 text-center whitespace-nowrap">Category</th>
                <th className="py-3 px-3 w-44 whitespace-nowrap">Schedule</th>
                <th className="py-3 px-3 w-36 whitespace-nowrap">
                  <SortHeader label="Price" active={sortKey === 'price'} dir={sortDir} onClick={() => toggleSort('price')} />
                </th>
                <th className="py-3 px-3 w-32 text-center whitespace-nowrap">
                  <SortHeader label="Status" active={sortKey === 'status'} dir={sortDir} onClick={() => toggleSort('status')} align="center" />
                </th>
                <th className="py-3 px-3 pr-4 w-28 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#f6ecd9] font-medium text-[#5b2a1a]">
              {initialLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="animate-pulse">
                    <td className="py-3 pl-4 pr-2">
                      <div className="h-3.5 w-3.5 rounded bg-[#f6ecd9]" />
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-[#f6ecd9]" />
                        <div className="space-y-1.5">
                          <div className="h-3 w-44 rounded bg-[#f6ecd9]" />
                          <div className="h-2.5 w-28 rounded bg-[#f6ecd9]" />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3"><div className="h-5 w-20 rounded-full bg-[#f6ecd9] mx-auto" /></td>
                    <td className="py-3 px-3"><div className="h-5 w-24 rounded-full bg-[#f6ecd9]" /></td>
                    <td className="py-3 px-3"><div className="h-4 w-16 rounded bg-[#f6ecd9]" /></td>
                    <td className="py-3 px-3"><div className="h-5 w-20 rounded-full bg-[#f6ecd9] mx-auto" /></td>
                    <td className="py-3 px-3"><div className="h-6 w-14 rounded bg-[#f6ecd9] ml-auto" /></td>
                  </tr>
                ))
              ) : fetchError && items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <p className="text-rose-600 font-bold mb-2">Failed to load offerings: {fetchError}</p>
                    <button
                      type="button"
                      onClick={() => fetchItems(true)}
                      className="px-3.5 py-1.5 rounded-xl border border-rose-300 bg-white hover:bg-rose-50 text-xs font-bold text-rose-700 cursor-pointer"
                    >
                      Retry Connection
                    </button>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    <div className="text-4xl mb-2">🪔</div>
                    <p className="font-extrabold text-[#3b0d0d] text-sm">No offerings yet</p>
                    <p className="text-[11.5px] text-[#8a5a44] mt-1 mb-3">
                      Create your first seva or corpus fund to show it on the website.
                    </p>
                    <button
                      type="button"
                      onClick={() => openDrawer()}
                      className="px-4 py-2 rounded-xl bg-[#fbbf24] hover:bg-[#fcd34d] text-[#3b0d0d] text-xs font-bold cursor-pointer"
                    >
                      + Add Seva / Corpus
                    </button>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    <div className="text-4xl mb-2">🔍</div>
                    <p className="font-extrabold text-[#3b0d0d] text-sm">No matching offerings</p>
                    <p className="text-[11.5px] text-[#8a5a44] mt-1 mb-3">Try a different search or view.</p>
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="px-4 py-2 rounded-xl border border-[#f0e2c8] bg-white hover:bg-[#fff8ec] text-xs font-bold text-[#c2410c] cursor-pointer"
                    >
                      Clear filters
                    </button>
                  </td>
                </tr>
              ) : (
                pageItems.map((item) => {
                  const titleEnText = item_title(item) || 'Item';
                  const titleTaText = item.display_title_ta || toText(item.title_ta, 'ta');
                  const descEnText = toText(item.description_en, 'en');
                  const displayAmount = getItemAmount(item);
                  const isMonthlyTithi = item.recurrence_type === 'monthly_tithi';
                  const isAnnualEvent = item.recurrence_type === 'annual';
                  const isSelected = selected.has(item.id);

                  return (
                    <tr
                      key={item.id}
                      className={`group transition-colors ${isSelected ? 'bg-[#fff8ec]' : 'hover:bg-[#fffaf4]'}`}
                    >
                      <td className="py-2.5 pl-4 pr-2 align-middle">
                        <input
                          type="checkbox"
                          aria-label={`Select ${titleEnText}`}
                          checked={isSelected}
                          onChange={() => toggleSelectOne(item.id)}
                          className="h-3.5 w-3.5 accent-[#ea580c] cursor-pointer"
                        />
                      </td>

                      {/* Offering */}
                      <td className="py-2.5 px-3 align-middle">
                        <div className="flex items-center gap-3">
                          <SevaImage
                            src={item.image_url}
                            alt={titleEnText}
                            category={item.category}
                            recurrenceType={item.recurrence_type}
                          />
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => openDrawer(item)}
                              className="font-extrabold text-[#3b0d0d] block text-[13px] leading-tight text-left hover:text-[#c2410c] hover:underline cursor-pointer"
                            >
                              {titleEnText}
                            </button>
                            {titleTaText && titleTaText !== titleEnText && (
                              <span className="text-[11.5px] font-bold text-[#ea580c] block mt-0.5">
                                {titleTaText}
                              </span>
                            )}
                            {descEnText && (
                              <span className="text-[11px] text-[#8a5a44] line-clamp-1 mt-0.5 font-medium">
                                {descEnText}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-2.5 px-3 align-middle text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold uppercase tracking-wider border ${
                            item.category === 'corpus'
                              ? 'bg-[#fdebec] text-[#7a1c1c] border-[#fecdd3]'
                              : 'bg-[#fff3df] text-[#c2410c] border-[#fde68a]'
                          }`}
                        >
                          {item.category === 'corpus' ? 'Corpus' : 'Seva'}
                        </span>
                      </td>

                      {/* Schedule */}
                      <td className="py-2.5 px-3 align-middle whitespace-nowrap">
                        {isAnnualEvent ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#eef2ff] text-[#4338ca] text-[10.5px] font-bold border border-[#c7d2fe]">
                              📅 {item.event_date ? formatDisplayDate(item.event_date) : 'Annual'}
                            </span>
                            {item.panchangam_tag && (
                              <span className="block text-[10px] text-slate-500 font-semibold mt-0.5 truncate max-w-[10rem]">
                                {item.panchangam_tag}
                              </span>
                            )}
                          </div>
                        ) : isMonthlyTithi ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#fdf4ff] text-[#a21caf] text-[10.5px] font-bold border border-[#f5d0fe]">
                              🔄 Monthly {item.tithi_trigger || ''}
                            </span>
                            {item.event_date && (
                              <span className="block text-[10px] text-amber-800 font-semibold mt-0.5">
                                Next: {formatDisplayDate(item.event_date)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-semibold">Regular</span>
                        )}
                      </td>

                      {/* Price */}
                      <td className="py-2.5 px-3 align-middle whitespace-nowrap">
                        {item.price_type === 'custom' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd]">
                            Devotee enters
                          </span>
                        ) : (
                          <span className="font-extrabold text-[#3b0d0d] text-[13px] tracking-tight">
                            ₹ {displayAmount.toLocaleString('en-IN')}
                          </span>
                        )}
                      </td>

                      {/* Status chip (click to toggle) */}
                      <td className="py-2.5 px-3 align-middle text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(item.id)}
                          title="Click to switch between Published and Draft"
                          aria-label={`Status: ${item.status}. Click to toggle.`}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border cursor-pointer transition-colors ${
                            item.status === 'published'
                              ? 'bg-[#ecfdf5] text-[#047857] border-[#a7f3d0] hover:bg-[#d1fae5]'
                              : 'bg-[#fffbeb] text-[#b45309] border-[#fde68a] hover:bg-[#fef3c7]'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              item.status === 'published' ? 'bg-[#10b981]' : 'bg-[#f59e0b]'
                            }`}
                          />
                          {item.status === 'published' ? 'Published' : 'Draft'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 pr-4 align-middle text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openDrawer(item)}
                            className="px-2.5 py-1 rounded-lg border border-[#f0e2c8] bg-white hover:bg-[#fff8ec] text-[11px] font-bold text-[#c2410c] cursor-pointer md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            data-row-menu
                            aria-label="More actions"
                            aria-haspopup="menu"
                            onClick={(e) => openRowMenu(e, item.id)}
                            className="h-7 w-7 rounded-lg border border-transparent hover:border-[#f0e2c8] hover:bg-white text-[#8a5a44] font-extrabold cursor-pointer"
                          >
                            ⋯
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!initialLoading && filteredItems.length > 0 && (
          <div className="px-4 py-2.5 border-t border-[#f6ecd9] bg-[#fffaf4] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#8a5a44] font-semibold">
            <div className="flex items-center gap-2">
              <span>Records per page</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className={`rounded-lg border border-[#f0e2c8] bg-white px-2 py-1 text-xs font-bold text-[#3b0d0d] cursor-pointer ${FOCUS}`}
              >
                {[25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <span>
                {pageStart + 1}–{Math.min(pageStart + pageSize, filteredItems.length)} of {filteredItems.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage(safePage - 1)}
                  className="px-2.5 py-1 rounded-lg border border-[#f0e2c8] bg-white font-bold text-[#3b0d0d] hover:bg-[#fff8ec] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ‹ Prev
                </button>
                <span className="px-2 text-[#3b0d0d] font-bold">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(safePage + 1)}
                  className="px-2.5 py-1 rounded-lg border border-[#f0e2c8] bg-white font-bold text-[#3b0d0d] hover:bg-[#fff8ec] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next ›
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Row action menu (fixed so it is never clipped by the table) */}
      {rowMenu && menuItem && (
        <div
          data-row-menu
          role="menu"
          style={{ position: 'fixed', top: rowMenu.top, left: rowMenu.left, width: 176 }}
          className="z-40 rounded-xl border border-[#f0e2c8] bg-white shadow-xl py-1 text-xs font-bold"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => openDrawer(menuItem)}
            className="w-full text-left px-3 py-2 text-[#3b0d0d] hover:bg-[#fff8ec] cursor-pointer"
          >
            ✏️ Edit
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setRowMenu(null);
              handleToggleStatus(menuItem.id);
            }}
            className="w-full text-left px-3 py-2 text-[#3b0d0d] hover:bg-[#fff8ec] cursor-pointer"
          >
            {menuItem.status === 'published' ? '📝 Move to Draft' : '✅ Publish'}
          </button>
          <div className="my-1 border-t border-[#f6ecd9]" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setRowMenu(null);
              handleDelete(menuItem.id);
            }}
            className="w-full text-left px-3 py-2 text-rose-600 hover:bg-rose-50 cursor-pointer"
          >
            🗑️ Delete
          </button>
        </div>
      )}

      {/* 5. Right-side drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            style={{ animation: 'seva-fade-in 150ms ease-out' }}
            onMouseDown={() => closeDrawer()}
          />

          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="seva-drawer-title"
            style={{ animation: 'seva-drawer-in 180ms ease-out' }}
            className="absolute right-0 top-0 h-full w-full sm:max-w-xl bg-white shadow-2xl border-l border-[#f0e2c8] flex flex-col"
          >
            {/* Header */}
            <div className="bg-[#fff8ec] px-6 py-4 border-b border-[#f6ecd9] flex items-center justify-between shrink-0">
              <div>
                <h3 id="seva-drawer-title" className="font-extrabold text-base text-[#3b0d0d]">
                  {editingItem ? 'Edit Entry' : 'Create New Seva / Corpus'}
                </h3>
                <p className="text-[11px] text-[#8a5a44]">
                  Configure catalog details, pricing & calendar recurrence.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => closeDrawer()}
                className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Scrollable form body */}
            <form
              id="seva-form"
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-xs"
            >
              {/* Basic info */}
              <SectionBlock title="Basic Info">
                <div>
                  <label className={LABEL}>Category *</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(
                      [
                        { key: 'seva', icon: '🪔', title: 'Seva List', desc: 'Pooja & Abhishekam rituals', on: 'border-[#ea580c] bg-[#fff3df] text-[#c2410c] ring-[#ea580c]' },
                        { key: 'corpus', icon: '🏛️', title: 'Corpus', desc: 'Endowment & Corpus fund', on: 'border-[#7a1c1c] bg-[#fdebec] text-[#7a1c1c] ring-[#7a1c1c]' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setForm({ ...form, category: opt.key })}
                        className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                          form.category === opt.key
                            ? `${opt.on} font-bold ring-1`
                            : 'border-[#f0e2c8] bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-xl">{opt.icon}</span>
                        <div>
                          <p className="text-xs font-bold">{opt.title}</p>
                          <p className="text-[10px] text-slate-500">{opt.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={LABEL}>
                    Title (English) *
                    {!isTamilTitleTouched && (
                      <span className="text-[10px] text-[#ea580c] font-normal ml-2">
                        (Auto-fills the Tamil title below)
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    required
                    value={form.title_en}
                    onChange={(e) => handleEnglishTitleChange(e.target.value)}
                    placeholder="e.g. Sri Kasi Viswanathar Annabishekam"
                    className={INPUT}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className={LABEL}>Title (தமிழ்) *</label>
                    {isTamilTitleTouched && (
                      <span className="text-[10px] text-slate-400 mb-1">Manual edit preserved</span>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    value={form.title_ta}
                    onChange={(e) => {
                      setIsTamilTitleTouched(true);
                      setForm({ ...form, title_ta: e.target.value });
                    }}
                    placeholder="e.g. ஸ்ரீ காசி விஸ்வநாதர் அன்னாபிஷேகம்"
                    className={`${INPUT} font-medium`}
                  />
                </div>
              </SectionBlock>

              {/* Pricing */}
              <SectionBlock title="Pricing">
                <div className="bg-[#fafbfc] p-3.5 rounded-xl border border-[#eaecf0] space-y-3">
                  <div className="flex flex-wrap items-center gap-3 sm:gap-6">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                      <input
                        type="radio"
                        name="price_type"
                        checked={form.price_type === 'fixed'}
                        onChange={() => setForm({ ...form, price_type: 'fixed' })}
                        className="accent-[#ea580c]"
                      />
                      <span>Fixed Price (Ashram sets amount)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                      <input
                        type="radio"
                        name="price_type"
                        checked={form.price_type === 'custom'}
                        onChange={() => setForm({ ...form, price_type: 'custom', amount: '' })}
                        className="accent-[#ea580c]"
                      />
                      <span>Non-Fixed (Devotee enters amount)</span>
                    </label>
                  </div>

                  {form.price_type === 'fixed' ? (
                    <div>
                      <label className={LABEL}>Fixed Offering Amount (₹ INR) *</label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={form.amount}
                        onChange={(e) => setForm({ ...form, amount: e.target.value })}
                        placeholder="e.g. 1008"
                        className={`${INPUT} font-bold text-sm`}
                      />
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#0369a1] bg-[#e0f2fe] p-2 rounded-lg font-medium">
                      ✓ Devotees can enter any amount on the website checkout page.
                    </p>
                  )}
                </div>
              </SectionBlock>

              {/* Scheduling */}
              <SectionBlock title="Scheduling (பூஜை அட்டவணை)">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {RECURRENCE_OPTIONS.map((opt) => (
                    <label
                      key={opt.key}
                      className={`p-3 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
                        form.recurrence_type === opt.key
                          ? 'border-[#ea580c] bg-[#fff3df] text-[#c2410c] font-bold ring-1 ring-[#ea580c]'
                          : 'border-[#f0e2c8] bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="recurrence_type"
                          checked={form.recurrence_type === opt.key}
                          onChange={() => setForm({ ...form, recurrence_type: opt.key })}
                          className="accent-[#ea580c]"
                        />
                        <span className="text-xs font-bold">{opt.title}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1 font-normal">{opt.desc}</span>
                    </label>
                  ))}
                </div>

                {form.recurrence_type === 'annual' && (
                  <div className="pt-3 border-t border-[#f6ecd9] space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className={LABEL}>விசேஷ நாள் (Festival Date) *</label>
                        <input
                          type="date"
                          required
                          value={form.event_date}
                          onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                          className={`${INPUT} font-bold`}
                        />
                      </div>
                      <div>
                        <label className={LABEL}>விசேஷக் குறிப்பு (Occasion Identifier)</label>
                        <input
                          type="text"
                          value={form.panchangam_tag}
                          onChange={(e) => setForm({ ...form, panchangam_tag: e.target.value })}
                          placeholder="e.g. Annabishekam"
                          className={INPUT}
                        />
                      </div>
                    </div>

                    {form.event_date && (
                      <div className="p-2.5 rounded-xl bg-[#fff8ec] border border-[#fde68a] text-[11.5px] text-[#7a1c1c] flex flex-wrap items-center justify-between gap-2">
                        <span>
                          📅 <b>Pinned date:</b> {form.title_en || 'Seva'} – {formatDisplayDate(form.event_date)}
                        </span>
                        <span className="font-extrabold bg-[#fef3c7] text-[#92400e] border border-[#fcd34d] px-2 py-0.5 rounded-md text-[10.5px]">
                          Locked Date
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {form.recurrence_type === 'monthly_tithi' && (
                  <div className="pt-3 border-t border-[#f6ecd9] space-y-3">
                    <div>
                      <label className={LABEL}>திதி தேர்வு (Recurring Tithi Trigger) *</label>
                      <select
                        value={form.tithi_trigger}
                        onChange={(e) => setForm({ ...form, tithi_trigger: e.target.value })}
                        className={`${INPUT} font-bold`}
                      >
                        {COMMON_TITHI_TRIGGERS.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label} ({t.example})
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="text-[11px] text-[#701a75] bg-[#fdf4ff] border border-[#f5d0fe] rounded-xl p-2.5 font-medium">
                      🔄 This offering repeats monthly on the selected tithi. The next date is set by the server.
                    </p>
                  </div>
                )}
              </SectionBlock>

              {/* Content */}
              <SectionBlock title="Content">
                <div>
                  <label className={LABEL}>English Description</label>
                  <textarea
                    rows={3}
                    value={form.description_en}
                    onChange={(e) => setForm({ ...form, description_en: e.target.value })}
                    placeholder="Details of the seva/corpus..."
                    className={INPUT}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className={LABEL}>Tamil Description (தமிழ் விவரம்)</label>
                    {form.description_en.trim() && (
                      <button
                        type="button"
                        onClick={handleTransliterateDescManual}
                        title="Phonetic conversion only, not a translation. Please review the result."
                        className="text-[10.5px] font-bold text-[#ea580c] hover:underline cursor-pointer mb-1"
                      >
                        Convert from English (phonetic)
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={3}
                    value={form.description_ta}
                    onChange={(e) => setForm({ ...form, description_ta: e.target.value })}
                    placeholder="தமிழ் விவரம்..."
                    className={`${INPUT} font-medium`}
                  />
                </div>
              </SectionBlock>

              {/* Image */}
              <SectionBlock title="Image">
                <div className="flex items-center gap-3">
                  {form.image_url ? (
                    <img
                      src={getImageUrl(form.image_url)}
                      alt="Preview"
                      className="h-16 w-16 rounded-xl object-cover border border-[#f0e2c8]"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-xl bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xl">
                      📷
                    </div>
                  )}

                  <div className="space-y-1">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleImageFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={uploadingImage}
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-1.5 rounded-xl border border-[#f0e2c8] bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 cursor-pointer disabled:opacity-60"
                    >
                      {uploadingImage ? 'Uploading...' : form.image_url ? 'Change Image' : 'Upload Image'}
                    </button>
                    {form.image_url && (
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, image_url: '' })}
                        className="text-[11px] text-rose-600 block hover:underline ml-1 cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                    <p className="text-[10px] text-slate-400 ml-1">JPG or PNG, up to 5MB</p>
                  </div>
                </div>
              </SectionBlock>

              {/* Visibility */}
              <SectionBlock title="Visibility">
                <div className="flex flex-col sm:flex-row items-stretch gap-3">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, status: 'published' })}
                    className={`flex-1 py-2 px-3 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                      form.status === 'published'
                        ? 'bg-[#ecfdf5] border-[#a7f3d0] text-[#047857] shadow-sm'
                        : 'border-[#eaecf0] bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    ● Publish (Live on Website)
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, status: 'draft' })}
                    className={`flex-1 py-2 px-3 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                      form.status === 'draft'
                        ? 'bg-[#fffbeb] border-[#fde68a] text-[#b45309] shadow-sm'
                        : 'border-[#eaecf0] bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    Draft (Hidden)
                  </button>
                </div>
              </SectionBlock>
            </form>

            {/* Sticky footer */}
            <div className="shrink-0 px-6 py-3.5 border-t border-[#f6ecd9] bg-[#fffaf4] flex items-center justify-between gap-3">
              <span className="text-[11px] text-[#8a5a44] font-semibold">
                {isDirty() ? '● Unsaved changes' : ''}
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => closeDrawer()}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="seva-form"
                  disabled={saving || uploadingImage}
                  className="px-5 py-2 rounded-xl bg-[#fbbf24] hover:bg-[#fcd34d] text-[#3b0d0d] text-xs font-bold shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : editingItem ? 'Save Changes' : 'Create Entry'}
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-[60] max-w-sm rounded-xl px-4 py-3 text-xs font-bold shadow-xl border ${
            toast.type === 'error'
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : toast.type === 'info'
              ? 'bg-[#fff8ec] text-[#7a1c1c] border-[#fde68a]'
              : 'bg-[#ecfdf5] text-[#047857] border-[#a7f3d0]'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}