import { useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

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
  const ratings = useLearningStore((s) => s.ratings);
  const rateMeal = useLearningStore((s) => s.rateMeal);

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
          body="Once you approve a week, your dinners land here day by day — with leftover days and a meal-prep tip."
          action={{ label: "Let's plan this week", onPress: () => router.push('/plan') }}
        />
      </Screen>
    );
  }

  const meals = [...plan.meals].sort((a, b) => a.dayIndex - b.dayIndex);
  const start = new Date(plan.weekStartISO);
  const dayLabel = (i: number) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  };
  const rangeEnd = new Date(start);
  rangeEnd.setDate(rangeEnd.getDate() + Math.max(0, meals.length - 1));
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const leftovers = meals.filter((m) => recipeFor(m)?.makesLeftovers).length;
  const cooked = meals.filter((m) => m.cooked).length;

  return (
    <Screen title="Schedule" subtitle={`${fmt(start)} – ${fmt(rangeEnd)} · ${cooked}/${meals.length} cooked`}>
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
              {dayLabel(meal.dayIndex).toUpperCase()}
            </Text>
            <MealCard
              recipe={recipe}
              badge={recipe.makesLeftovers ? 'makes leftovers' : undefined}
              cooked={meal.cooked}
              rating={
                ratings.find((r) => r.planId === plan.id && r.recipeId === recipe.id)?.enjoyment
              }
              onRate={(v) => rateMeal(plan.id, recipe.id, v)}
              onToggleCooked={() => toggleCooked(meal.dayIndex)}
              onSwap={
                meal.cooked
                  ? undefined
                  : () =>
                      router.push({ pathname: '/plan/reroll', params: { day: String(meal.dayIndex) } })
              }
              onPress={() => router.push({ pathname: '/meal/[id]', params: { id: recipe.id } })}
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

      <Card style={{ marginTop: theme.spacing.md }}>
        <Text variant="headline">🧑‍🍳 Meal-prep tip</Text>
        <Text variant="subhead" color="secondary" style={{ marginTop: 4 }}>
          Cook the grains and proteins for your first couple of dinners together on your prep day to
          save time midweek.
        </Text>
      </Card>
    </Screen>
  );
}
