import { Redirect } from 'expo-router';

/**
 * Phase 4 G1 (IA consolidation): the standalone Schedule tab was folded
 * into This Week as a "Full week" segment — see the `WeekViewSwitch` in
 * `app/(tabs)/index.tsx`. This route file is kept in place (rather than
 * deleted) purely so old links/bookmarks/deep links to /schedule still
 * resolve instead of 404ing — it redirects straight into that segment.
 */
export default function ScheduleRedirect() {
  return <Redirect href={{ pathname: '/', params: { view: 'schedule' } }} />;
}
