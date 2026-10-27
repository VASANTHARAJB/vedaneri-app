export type DonationCategory = 'donation' | 'corpus' | 'ashram';

export interface DonationFund {
  id: string | number;
  slug: string;
  title_en: string;
  title_ta: string;
  description_en: string;
  description_ta: string;
  amount: number;
  price_type: 'fixed' | 'custom';
  category: DonationCategory;
  image_url?: string;
  recurrence_type?: 'none' | 'annual' | 'monthly_tithi';
  event_date?: string | null;
  tithi_trigger?: string;
}