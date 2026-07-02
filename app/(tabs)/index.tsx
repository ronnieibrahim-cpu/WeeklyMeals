import { useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { roughCostPerServing } from '@/engine/cost';
import { useLearningStore } from '@/stores/learningStore';
import { usePlanStore } from '@/stores/planStore';
import { Card, EmptyState, MealCard, Screen, SecondaryButton, Text } from '@/ui/components';
import { useTheme } from '@/ui/theme/useTheme';

export default function ThisWeekScreen() {
  const router = useRouter();
  const theme = useTheme();
  const plan = usePlanStore((s) => s.plan);
  const hydrated = usePlanStore((s) => s.hydrated);
  const recipeFor = usePlanStore((s) => s.recipeFor);
  const shoppingList = usePlanStore((s) => s.shoppingList);
  const toggleCooked = usePlanStore((s) => s.toggleCooked);
  const ratings = useLearningStore((s) => s.ratings);
  const rateMeal = useLearningStore((s) => s.rateMeal);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  if (!hydrated) {
    return (
      <Screen title="This Week" subtitle={today} scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      </Screen>
    );
  }

  // No plan yet → invite to plan.
  if (!plan) {
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

  // Draft plan → nudge to finish reviewing.
  if (plan.status !== 'approved') {
    return (
      <Screen title="This Week" subtitle={today}>
        <EmptyState
          emoji="📝"
          title="Your week is ready to review"
          body="I've drafted your dinners. Take a look, lock your favorites, and approve."
          action={{ label: 'Review my week', onPress: () => router.push('/plan/review') }}
        />
      </Screen>
    );
  }

  const meals = [...plan.meals].sort((a, b) => a.dayIndex - b.dayIndex);
  const hasList = !!shoppingList && shoppingList.planId === plan.id;
  const totalServings = meals.reduce((s, m) => s + m.servings, 0);
  const roughTotal = meals.reduce((sum, m) => {
    const r = recipeFor(m);
    return r ? sum + roughCostPerServing(r) * m.servings : sum;
  }, 0);
  const totalCost = hasList ? shoppingList!.estimatedTotal : roughTotal;
  const perServing = hasList
    ? shoppingList!.costPerServing
    : totalServings
      ? roughTotal / totalServings
      : 0;

  const dayLabel = (i: number) => {
    if (i === 0) return 'Tonight';
    const d = new Date(plan.weekStartISO);
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString(undefined, { weekday: 'long' });
  };

  const [tonight, ...rest] = meals;
  const tonightRecipe = tonight ? recipeFor(tonight) : undefined;
  const cookedCount = meals.filter((m) => m.cooked).length;

  const ratingFor = (recipeId: string) =>
    ratings.find((r) => r.planId === plan.id && r.recipeId === recipeId)?.enjoyment;
  const rerollMeal = (dayIndex: number) =>
    router.push({ pathname: '/plan/reroll', params: { day: String(dayIndex) } });

  return (
    <Screen
      title="This Week"
      subtitle={`${meals.length} dinners · $${totalCost.toFixed(0)} · ${cookedCount}/${meals.length} cooked`}
    >
      {tonight && tonightRecipe ? (
        <MealCard
          recipe={tonightRecipe}
          dayLabel={dayLabel(tonight.dayIndex)}
          badge={tonightRecipe.makesLeftovers ? 'leftovers' : undefined}
          cooked={tonight.cooked}
          rating={ratingFor(tonightRecipe.id)}
          onRate={(v) => rateMeal(plan.id, tonightRecipe.id, v)}
          onToggleCooked={() => toggleCooked(tonight.dayIndex)}
          onSwap={tonight.cooked ? undefined : () => rerollMeal(tonight.dayIndex)}
          onPress={() =>
            router.push({ pathname: '/meal/[id]', params: { id: tonightRecipe.id } })
          }
        />
      ) : null}

      {rest.length > 0 ? (
        <Text
          variant="footnote"
          color="secondary"
          style={{ marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm, marginLeft: theme.spacing.xs }}
        >
          LATER THIS WEEK
        </Text>
      ) : null}

      {rest.map((meal) => {
        const recipe = recipeFor(meal);
        if (!recipe) return null;
        return (
          <MealCard
            key={meal.dayIndex}
            recipe={recipe}
            dayLabel={dayLabel(meal.dayIndex)}
            badge={recipe.makesLeftovers ? 'leftovers' : undefined}
            cooked={meal.cooked}
            rating={ratingFor(recipe.id)}
            onRate={(v) => rateMeal(plan.id, recipe.id, v)}
            onToggleCooked={() => toggleCooked(meal.dayIndex)}
            onSwap={meal.cooked ? undefined : () => rerollMeal(meal.dayIndex)}
            onPress={() => router.push({ pathname: '/meal/[id]', params: { id: recipe.id } })}
          />
        );
      })}

      <Card
        onPress={() => router.push('/review')}
        style={{ marginTop: theme.spacing.lg, backgroundColor: theme.colors.accentMuted }}
      >
        <Text variant="headline">⭐ How did this week go?</Text>
        <Text variant="subhead" color="secondary" style={{ marginTop: 2 }}>
          Rate your meals — favorites come back and your weeks keep improving.
        </Text>
      </Card>

      <SecondaryButton
        title="Plan a new week"
        onPress={() => router.push('/plan')}
        style={{ marginTop: theme.spacing.lg }}
      />
    </Screen>
  );
}
