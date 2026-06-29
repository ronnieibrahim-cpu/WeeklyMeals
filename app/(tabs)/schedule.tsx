import { EmptyState, Screen } from '@/ui/components';

export default function ScheduleScreen() {
  return (
    <Screen title="Schedule">
      <EmptyState
        emoji="📅"
        title="No schedule yet"
        body="Once you plan a week, your dinners and leftover days will appear here, organized day by day."
      />
    </Screen>
  );
}
