import { EmptyState, Screen } from '@/ui/components';

export default function ShoppingScreen() {
  return (
    <Screen title="Shopping List" subtitle="H-E-B">
      <EmptyState
        emoji="🛒"
        title="Nothing to buy yet"
        body="Approve a weekly plan and a consolidated H-E-B list — organized by department, with an estimated total — shows up here."
      />
    </Screen>
  );
}
