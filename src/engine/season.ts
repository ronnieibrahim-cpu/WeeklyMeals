import { Season } from '@/domain/models';

/** Northern-hemisphere season for a date (Texas-appropriate). */
export function seasonForDate(date: Date): Season {
  const m = date.getMonth(); // 0–11
  if (m === 11 || m <= 1) return 'winter';
  if (m <= 4) return 'spring';
  if (m <= 7) return 'summer';
  return 'fall';
}
