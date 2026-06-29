import { useRouter } from 'expo-router';

import { EmptyState, Screen } from '@/ui/components';

export default function ThisWeekScreen() {
  const router = useRouter();

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Screen title="This Week" subtitle={today}>
      <EmptyState
        emoji="🍽️"
        title="No plan yet for this week"
        body="Answer a few quick questions and I'll build your whole week of dinners — recipes, a schedule, and one H-E-B shopping list."
        action={{ label: "Let's plan this week", onPress: () => router.push('/plan') }}
        footnote="Takes about 3 minutes · 7 dinners"
      />
    </Screen>
  );
}
