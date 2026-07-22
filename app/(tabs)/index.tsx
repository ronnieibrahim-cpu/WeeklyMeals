import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { PlannedMeal } from '@/domain/models';
import { eligibleMoveTargets } from '@/engine/rearrange';
import { allMealsRated } from '@/engine/rating';
import { dayLabel, todayOffset } from '@/engine/schedule';
import { useLearningStore } from '@/stores/learningStore';
import { usePlanStore } from '@/stores/planStore';
import { useRecipeNotesStore } from '@/stores/recipeNotesStore';
import { useRecipesById } from '@/stores/userRecipesStore';
import {
  Card,
  EmptyState,
  MealCard,
  MoveMealSheet,
  Screen,
  SecondaryButton,
  ServingsShoppingListPrompt,
  SwipeableMealRow,
  Text,
} from '@/ui/components';
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
  const setApprovedMealServings = usePlanStore((s) => s.setApprovedMealServings);
  const kidApprovedMap = useLearningStore((s) => s.kidApprovedMap);
  const toggleKidApproved = useLearningStore((s) => s.toggleKidApproved);
  const recipesById = useRecipesById();
  // M4.4: subscribe to the data (notesMap), not a lookup function — the
  // M4.0a lesson (see recipeNotesStore's doc comment).
  const notesMap = useRecipeNotesStore((s) => s.notesMap);
  const [showPast, setShowPast] = useState(false);
  // M4.1: which meal (if any) just had its servings changed on the
  // approved plan, and what it was before — drives the inline "Update
  // shopping list" confirmation. Local-only, never persisted: navigating
  // away drops the offer rather than nagging later (see planStore's doc
  // comment on why "old servings" isn't a synced field).
  // F6 (July 2026 sweep): key the pending servings prompt by recipeId too,
  // not dayIndex alone — a swipe-move or a partner's synced swap/re-roll can
  // change which dish sits on this dayIndex between the tap and the render,
  // and a prompt left pointing at the new dish computes a phantom delta and
  // would apply quantities nobody asked for (Law #1). The render gate below
  // drops the prompt the moment the meal's recipeId no longer matches.
  const [pendingServings, setPendingServings] = useState<{ dayIndex: number; recipeId: string; oldServings: number } | null>(null);
  // M4.6 part 2: which day's meal (if any) is being moved — drives the
  // "Move to…" bottom sheet. Local-only, same reasoning as pendingServings
  // above: navigating away just drops it, nothing to persist.
  const [moveFromDay, setMoveFromDay] = useState<number | null>(null);

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
    // M4.6 part 2: only offer "Move to…" when this meal isn't cooked AND
    // there's at least one not-yet-cooked other day to move it onto — never
    // an action that opens an empty picker (Law #3).
    const canMove = eligibleMoveTargets(plan, meal.dayIndex).length > 0;
    return (
      <View key={meal.dayIndex}>
        <SwipeableMealRow enabled={canMove} onMoveTo={() => setMoveFromDay(meal.dayIndex)}>
          <MealCard
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
            servings={meal.servings}
            onServingsChange={(servings) => {
              setPendingServings({ dayIndex: meal.dayIndex, recipeId: meal.recipeId, oldServings: meal.servings });
              setApprovedMealServings(meal.dayIndex, servings);
            }}
            sideNames={(meal.sideRecipeIds ?? []).map((id) => recipesById[id]?.name).filter((n): n is string => !!n)}
            hasNote={!!notesMap[recipe.id]?.text}
          />
        </SwipeableMealRow>
        {pendingServings?.dayIndex === meal.dayIndex && pendingServings?.recipeId === meal.recipeId ? (
          <ServingsShoppingListPrompt
            dayIndex={meal.dayIndex}
            oldServings={pendingServings.oldServings}
            onResolved={() => setPendingServings(null)}
          />
        ) : null}
      </View>

    );
  };

  return (
    <>
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

      {tonight && tonightRecipe ? renderMeal(tonight, 'Tonight') : null}

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
    {moveFromDay !== null ? (
      <MoveMealSheet plan={plan} fromDay={moveFromDay} onClose={() => setMoveFromDay(null)} />
    ) : null}
    </>
  );
}
