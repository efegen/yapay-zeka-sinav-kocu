import { COLORS } from './colors';

// Ders renk paleti — takvim noktaları, ajanda kartları ve plan detayında kullanılır.
export const DERS_RENK: Record<string, string> = {
  'AYT Matematik': '#7C3AED',
  'TYT Matematik': '#7C3AED',
  Matematik: '#7C3AED',
  Fizik: '#EC4899',
  Kimya: '#F59E0B',
  Biyoloji: '#10B981',
  Türkçe: '#0EA5E9',
  Fen: '#14B8A6',
  Sosyal: '#64748B',
  Genel: '#64748B',
};

// Görev ekleme formunda seçilebilen dersler (sırayla).
export const DERSLER = ['Matematik', 'Fizik', 'Kimya', 'Biyoloji', 'Türkçe', 'Genel'] as const;
export type Ders = (typeof DERSLER)[number];

export function dersRenk(ders?: string | null): string {
  if (!ders) return COLORS.primary;
  return DERS_RENK[ders] ?? COLORS.primary;
}
