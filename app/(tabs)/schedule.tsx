import { useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { dateForDayIndex } from '@/engine/schedule';
import { useLearningStore } from '@/stores/learningStore';
import { usePlanStore } from '@/stores/planStore';
import { Card, EmptyState, MealCard, Screen, Text } from '@/ui/components';
import { useTheme } from '@/ui/theme/useTheme';

export default function ScheduleScreen() {
  const router = useRouter();
  const theme = useTheme();
  const plan = usePlanStore((s) => s.plan);
  const hydrated = usePlanStore((s) => s.hydrated);
  const recipeFor = usePlanStore((s) => s.recipeFor);
  const toggleCooked = usePlanStore((s) => s.toggleCooked);
  const rateMeal = usePlanStore((s) => s.rateMeal);
  const isKidApproved = useLearningStore((s) => s.isKidApproved);
  const toggleKidApproved = useLearningStore((s) => s.toggleKidApproved);

  if (!hydrated) {
    return (
      <Screen title="Schedule" scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      </Screen>
    );
  }

  if (!plan || plan.status !== 'approved') {
    return (
      <Screen title="Schedule">
        <EmptyState
          emoji="📅"
          title="No schedule yet"
          body="Once you approve a week, your dinners land here day by day, with a heads-up on any meals that make leftovers."
          action={{ label: "Let's plan this week", onPress: () => router.push('/plan') }}
        />
      </Screen>
    );
  }

  const meals = [...plan.meals].sort((a, b) => a.dayIndex - b.dayIndex);
  const dateLabel = (i: number) =>
    dateForDayIndex(plan.weekStartISO, i).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  const rangeStart = dateForDayIndex(plan.weekStartISO, 0);
  const rangeEnd = dateForDayIndex(plan.weekStartISO, Math.max(0, meals.length - 1));
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const leftovers = meals.filter((m) => recipeFor(m)?.makesLeftovers).length;
  const cooked = meals.filter((m) => m.cooked).length;

  return (
    <Screen title="Schedule" subtitle={`${fmt(rangeStart)} – ${fmt(rangeEnd)} · ${cooked}/${meals.length} cooked`}>
      {meals.map((meal) => {
        const recipe = recipeFor(meal);
        if (!recipe) return null;
        return (
          <View key={meal.dayIndex} style={{ marginBottom: theme.spacing.sm }}>
            <Text
              variant="footnote"
              color="secondary"
              style={{ marginBottom: 4, marginLeft: theme.spacing.xs }}
            >
              {dateLabel(meal.dayIndex).toUpperCase()}
            </Text>
            <MealCard
              recipe={recipe}
              badge={recipe.makesLeftovers ? 'makes leftovers' : undefined}
              cooked={meal.cooked}
              rating={meal.rating}
              onRate={(rating) => rateMeal(meal.dayIndex, rating)}
              onToggleCooked={() => toggleCooked(meal.dayIndex)}
              onPress={() => router.push({ pathname: '/meal/[id]', params: { id: recipe.id } })}
              kidApproved={isKidApproved(recipe.id)}
              onToggleKidApproved={() => toggleKidApproved(recipe.id)}
            />
          </View>
        );
      })}

      {leftovers > 0 ? (
        <Card style={{ marginTop: theme.spacing.md, backgroundColor: theme.colors.accentMuted }}>
          <Text variant="subhead">
            🥡 {leftovers} meal{leftovers === 1 ? '' : 's'} make leftovers — a great excuse for a
            lighter or no-cook night to reuse them.
          </Text>
        </Card>
      ) : null}
    </Screen>
  );
}
