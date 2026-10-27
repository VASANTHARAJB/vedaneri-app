export interface Offering {
  id: string | number;
  slug: string;
  title_en: string;
  title_ta: string;
  description_en: string;
  description_ta: string;
  amount: number;
  price_type: 'fixed' | 'custom';
  category: 'seva' | 'corpus';
  status: 'published' | 'draft';
  image_url?: string;
  // Recurrence fields (present once the backend returns them)
  is_event_seva?: boolean;
  recurrence_type?: 'none' | 'annual' | 'monthly_tithi';
  event_date?: string | null;
  tithi_trigger?: string;
  panchangam_tag?: string;
}