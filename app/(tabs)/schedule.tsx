import { Redirect } from 'expo-router';

/**
 * Phase 4 (IA consolidation): the standalone Schedule tab was folded into
 * This Week, which now always shows the full week's day-by-day schedule
 * directly (no separate segment/toggle — see `app/(tabs)/index.tsx`). This
 * route file is kept in place (rather than deleted) purely so old
 * links/bookmarks/deep links to /schedule still resolve instead of
 * 404ing — it redirects straight there.
 */
export default function ScheduleRedirect() {
  return <Redirect href="/" />;
}
