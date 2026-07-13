import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { PlannedMeal } from '@/domain/models';
import { allMealsRated } from '@/engine/rating';
import { dayLabel, todayOffset } from '@/engine/schedule';
import { useLearningStore } from '@/stores/learningStore';
import { usePlanStore } from '@/stores/planStore';
import { Card, EmptyState, MealCard, Screen, SecondaryButton, Text } from '@/ui/components';
import { useTheme } from '@/ui/theme/useTheme';

export default function ThisWeekScreen() {
  const router = useRouter();
  const theme = useTheme();
  const plan = usePlanStore((s) => s.plan);
  const draftPlan = usePlanStore((s) => s.draftPlan);
  const hydrated = usePlanStore((s) => s.hydrated);
  const recipeFor = usePlanStore((s) => s.recipeFor);
  const shoppingList = usePlanStore((s) => s.shoppingList);
  const previewShoppingList = usePlanStore((s) => s.previewShoppingList);
  const toggleCooked = usePlanStore((s) => s.toggleCooked);
  const rateMeal = usePlanStore((s) => s.rateMeal);
  const kidApprovedMap = useLearningStore((s) => s.kidApprovedMap);
  const toggleKidApproved = useLearningStore((s) => s.toggleKidApproved);
  const [showPast, setShowPast] = useState(false);

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

  // A freshly generated draft always takes priority to nudge toward review,
  // regardless of whether an already-approved week still exists underneath
  // (it does, untouched, until the draft is approved or discarded — P0-3).
  if (draftPlan) {
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

  const meals = [...plan.meals].sort((a, b) => a.dayIndex - b.dayIndex);
  const hasList = !!shoppingList && shoppingList.planId === plan.id;
  const list = hasList ? shoppingList! : previewShoppingList(plan);
  const totalCost = list.estimatedTotal;
  const cookedCount = meals.filter((m) => m.cooked).length;

  const reviewCard = (
    <Card
      onPress={() => router.push('/review')}
      style={{ marginTop: theme.spacing.lg, backgroundColor: theme.colors.accentMuted }}
    >
      {allMealsRated(plan.meals) ? (
        <>
          <Text variant="headline">⭐ Week rated ✓</Text>
          <Text variant="subhead" color="secondary" style={{ marginTop: 2 }}>
            Thanks for the feedback — tap to see what you said.
          </Text>
        </>
      ) : (
        <>
          <Text variant="headline">⭐ How did this week go?</Text>
          <Text variant="subhead" color="secondary" style={{ marginTop: 2 }}>
            Rate your meals — favorites come back and your weeks keep improving.
          </Text>
        </>
      )}
    </Card>
  );

  const offset = todayOffset(plan.weekStartISO);

  // Today is past the last planned day → the week is done.
  if (offset >= meals.length) {
    return (
      <Screen title="This Week" subtitle={today}>
        <EmptyState
          emoji="🎉"
          title="Week complete!"
          body="You've made it through this week's dinners. Ready to plan the next one?"
          action={{ label: 'Plan next week', onPress: () => router.push('/plan') }}
        />
        {reviewCard}
      </Screen>
    );
  }

  const todayIndex = Math.max(0, offset);
  const tonight = meals.find((m) => m.dayIndex === todayIndex);
  const tonightRecipe = tonight ? recipeFor(tonight) : undefined;
  const past = meals.filter((m) => m.dayIndex < todayIndex);
  const future = meals.filter((m) => m.dayIndex > todayIndex);

  const renderMeal = (meal: PlannedMeal, label: string) => {
    const recipe = recipeFor(meal);
    if (!recipe) return null;
    const canReroll = meal.dayIndex >= todayIndex && !meal.cooked;
    return (
      <MealCard
        key={meal.dayIndex}
        recipe={recipe}
        dayLabel={label}
        badge={recipe.makesLeftovers ? 'leftovers' : undefined}
        cooked={meal.cooked}
        rating={meal.rating}
        onRate={(rating) => rateMeal(meal.dayIndex, rating)}
        onReroll={
          canReroll
            ? () => router.push({ pathname: '/reroll/[dayIndex]', params: { dayIndex: String(meal.dayIndex) } })
            : undefined
        }
        onToggleCooked={() => toggleCooked(meal.dayIndex)}
        onPress={() => router.push({ pathname: '/meal/[id]', params: { id: recipe.id } })}
        kidApproved={!!kidApprovedMap[recipe.id]?.flag}
        onToggleKidApproved={() => toggleKidApproved(recipe.id)}
      />
    );
  };

  return (
    <Screen
      title="This Week"
      subtitle={`${meals.length} dinners · $${totalCost.toFixed(0)} · ${cookedCount}/${meals.length} cooked`}
    >
      {past.length > 0 ? (
        <>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowPast((v) => !v)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: theme.spacing.sm,
              marginLeft: theme.spacing.xs,
            }}
          >
            <Text variant="footnote" color="secondary">
              EARLIER THIS WEEK ({past.length})
            </Text>
            <Ionicons
              name={showPast ? 'chevron-down' : 'chevron-forward'}
              size={16}
              color={theme.colors.textTertiary}
            />
          </Pressable>
          {showPast ? past.map((meal) => renderMeal(meal, dayLabel(plan.weekStartISO, meal.dayIndex))) : null}
        </>
      ) : null}

      {tonight && tonightRecipe ? (
        <MealCard
          recipe={tonightRecipe}
          dayLabel="Tonight"
          badge={tonightRecipe.makesLeftovers ? 'leftovers' : undefined}
          cooked={tonight.cooked}
          rating={tonight.rating}
          onRate={(rating) => rateMeal(tonight.dayIndex, rating)}
          onReroll={
            !tonight.cooked
              ? () =>
                  router.push({ pathname: '/reroll/[dayIndex]', params: { dayIndex: String(tonight.dayIndex) } })
              : undefined
          }
          onToggleCooked={() => toggleCooked(tonight.dayIndex)}
          onPress={() =>
            router.push({ pathname: '/meal/[id]', params: { id: tonightRecipe.id } })
          }
          kidApproved={!!kidApprovedMap[tonightRecipe.id]?.flag}
          onToggleKidApproved={() => toggleKidApproved(tonightRecipe.id)}
        />
      ) : null}

      {future.length > 0 ? (
        <Text
          variant="footnote"
          color="secondary"
          style={{ marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm, marginLeft: theme.spacing.xs }}
        >
          LATER THIS WEEK
        </Text>
      ) : null}

      {future.map((meal) => renderMeal(meal, dayLabel(plan.weekStartISO, meal.dayIndex)))}

      {reviewCard}

      <SecondaryButton
        title="Plan a new week"
        onPress={() => router.push('/plan')}
        style={{ marginTop: theme.spacing.lg }}
      />
    </Screen>
  );
}
