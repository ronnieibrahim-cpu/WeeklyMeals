import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { PlannedMeal, Recipe, WeeklyPlan } from '@/domain/models';
import { eligibleMoveTargets } from '@/engine/rearrange';
import { allMealsRated } from '@/engine/rating';
import { dateForDayIndex, todayOffset } from '@/engine/schedule';
import { useLearningStore } from '@/stores/learningStore';
import { usePlanHistoryStore } from '@/stores/planHistoryStore';
import { usePlanStore } from '@/stores/planStore';
import { useRecipeNotesStore } from '@/stores/recipeNotesStore';
import { useRecipesById } from '@/stores/userRecipesStore';
import {
  Card,
  EmptyState,
  MealCard,
  MoveMealSheet,
  PrimaryButton,
  Screen,
  SecondaryButton,
  SectionHeader,
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
  const pickUpFromToday = usePlanStore((s) => s.pickUpFromToday);
  const kidApprovedMap = useLearningStore((s) => s.kidApprovedMap);
  const toggleKidApproved = useLearningStore((s) => s.toggleKidApproved);
  const recipesById = useRecipesById();
  // M4.4: subscribe to the data (notesMap), not a lookup function — the
  // M4.0a lesson (see recipeNotesStore's doc comment).
  const notesMap = useRecipeNotesStore((s) => s.notesMap);

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

  // M5.0: rolling per-device archive of the last 6 cooked weeks — read-only
  // reflection. Phase 4 follow-up: collapsed by default behind a single
  // "Past weeks" toggle at the bottom of the page, rather than always
  // expanded — which cards inside it are expanded is separate, still
  // local-only UI state (multiple may be open at once), not persisted.
  const history = usePlanHistoryStore((s) => s.history);
  const [showPastWeeks, setShowPastWeeks] = useState(false);
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(new Set());
  const toggleHistoryExpanded = (id: string) =>
    setExpandedHistoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const openArchivedRecipe = (recipeId: string) =>
    router.push({ pathname: '/meal/[id]', params: { id: recipeId } });
  const pastWeeksSection = (
    <View style={{ marginTop: theme.spacing.md }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={showPastWeeks ? 'Collapse past weeks' : 'Expand past weeks'}
        accessibilityState={{ expanded: showPastWeeks }}
        onPress={() => setShowPastWeeks((v) => !v)}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <SectionHeader title="Past weeks" />
        <Ionicons name={showPastWeeks ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.textTertiary} />
      </Pressable>
      {showPastWeeks ? (
        history.length > 0 ? (
          history.map((week) => (
            <ArchivedWeekCard
              key={week.id}
              plan={week}
              expanded={expandedHistoryIds.has(week.id)}
              onToggle={() => toggleHistoryExpanded(week.id)}
              recipeFor={recipeFor}
              recipesById={recipesById}
              onOpenRecipe={openArchivedRecipe}
            />
          ))
        ) : (
          <Text variant="footnote" color="tertiary" style={{ marginTop: theme.spacing.sm }}>
            Past weeks will appear here once your next week is approved.
          </Text>
        )
      ) : null}
    </View>
  );

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

  // Nothing approved and nothing drafted yet → invite to plan.
  if (!plan && !draftPlan) {
    return (
      <Screen title="This Week" subtitle={today}>
        <EmptyState
          emoji="📅"
          title="No schedule yet"
          body="Once you approve a week, your dinners land here day by day, with a heads-up on any meals that make leftovers."
          action={{ label: "Let's plan this week", onPress: () => router.push('/plan') }}
          footnote="Takes about 3 minutes · 7 dinners"
        />
        {pastWeeksSection}
      </Screen>
    );
  }

  // A freshly generated draft awaiting review is surfaced as a banner —
  // whole-card tap, same idiom as `reviewCard` below — rather than taking
  // over the whole screen (P0-3): the still-approved plan underneath (if
  // any) keeps showing beneath it, exactly as it did when this lived on its
  // own "Schedule" tab and stayed reachable while a draft was pending.
  const draftBanner = draftPlan ? (
    <Card
      onPress={() => router.push('/plan/review')}
      style={{ marginBottom: theme.spacing.lg, backgroundColor: theme.colors.accentMuted }}
    >
      <Text variant="headline">Your week is ready to review</Text>
      <Text variant="subhead" color="secondary" style={{ marginTop: 2 }}>
        I've drafted your dinners. Take a look, lock your favorites, and approve.
      </Text>
    </Card>
  ) : null;

  // A draft exists but there's no approved plan underneath it yet (e.g.
  // first plan ever) — nothing to schedule below the banner.
  if (!plan) {
    return (
      <Screen title="This Week" subtitle={today}>
        {draftBanner}
        {pastWeeksSection}
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
  const hasList = !!shoppingList && shoppingList.planId === plan.id;
  const list = hasList ? shoppingList! : previewShoppingList(plan);
  const totalCost = list.estimatedTotal;

  const offset = todayOffset(plan.weekStartISO);
  const todayIndex = Math.max(0, offset);
  // "Stale week" fix: completion is now about PROGRESS, not the calendar —
  // a week generated ahead of schedule and left with uncooked days must
  // never read as "complete" just because today's date has run past it
  // (Product Law #3: never claim something's done when it isn't). Only
  // evaluated when there's no draft pending, matching the original behavior
  // where a pending draft always took priority over this state.
  const allCooked = meals.length > 0 && meals.every((m) => m.cooked);
  const datesPassed = offset >= meals.length;
  const weekComplete = !draftPlan && allCooked;
  // The calendar ran out but there's still uncooked food — distinct from
  // "done": offer to re-date the remaining meals to today (`pickUpFromToday`)
  // or start over, but never silently pick one (Law #1/#3).
  const staleWeek = !draftPlan && datesPassed && !allCooked;
  const uncookedCount = meals.filter((m) => !m.cooked).length;

  const reviewCard = !draftPlan ? (
    <Card
      onPress={() => router.push('/review')}
      style={{ marginTop: theme.spacing.lg, backgroundColor: theme.colors.accentMuted }}
    >
      {allMealsRated(plan.meals) ? (
        <>
          <Text variant="headline">Week rated</Text>
          <Text variant="subhead" color="secondary" style={{ marginTop: 2 }}>
            Thanks for the feedback — tap to see what you said.
          </Text>
        </>
      ) : (
        <>
          <Text variant="headline">How did this week go?</Text>
          <Text variant="subhead" color="secondary" style={{ marginTop: 2 }}>
            Rate your meals — favorites come back and your weeks keep improving.
          </Text>
        </>
      )}
    </Card>
  ) : null;

  return (
    <>
      <Screen
        title="This Week"
        subtitle={`${fmt(rangeStart)} – ${fmt(rangeEnd)} · $${totalCost.toFixed(0)} · ${cooked}/${meals.length} cooked`}
      >
        {draftBanner}

        {weekComplete ? (
          <Card style={{ marginBottom: theme.spacing.lg, backgroundColor: theme.colors.accentMuted }}>
            <Text variant="headline">🎉 Week complete!</Text>
            <Text variant="subhead" color="secondary" style={{ marginTop: 2 }}>
              You've made it through this week's dinners. Ready to plan the next one?
            </Text>
          </Card>
        ) : null}

        {staleWeek ? (
          <Card style={{ marginBottom: theme.spacing.lg, backgroundColor: theme.colors.accentMuted }}>
            <Text variant="headline">This week's dates have passed</Text>
            <Text variant="subhead" color="secondary" style={{ marginTop: 2 }}>
              {uncookedCount} meal{uncookedCount === 1 ? '' : 's'} still to cook.
            </Text>
            <PrimaryButton
              title="Pick up from today"
              onPress={pickUpFromToday}
              style={{ marginTop: theme.spacing.md }}
            />
            <SecondaryButton
              title="Plan a new week"
              onPress={() => router.push('/plan')}
              style={{ marginTop: theme.spacing.sm }}
            />
          </Card>
        ) : null}

        {meals.map((meal) => {
          const recipe = recipeFor(meal);
          if (!recipe) return null;
          // M4.6 part 2: only offer "Move to…" when this meal isn't cooked
          // AND there's at least one not-yet-cooked other day to move it onto
          // — never an action that opens an empty picker (Law #3).
          const canMove = eligibleMoveTargets(plan, meal.dayIndex).length > 0;
          // M2.2: re-roll is only offered for today/future, not-yet-cooked
          // meals, and — same conservative rule as `weekComplete` above —
          // never while a draft is pending, matching the fact that this
          // whole day-by-day list wasn't reachable at all during a pending
          // draft before Phase 4 (so re-roll was never offered then either).
          const canReroll = !draftPlan && meal.dayIndex >= todayIndex && !meal.cooked;
          return (
            <View key={meal.dayIndex} style={{ marginBottom: theme.spacing.sm }}>
              <Text
                variant="footnote"
                color="secondary"
                style={{ marginBottom: 4, marginLeft: theme.spacing.xs }}
              >
                {dateLabel(meal.dayIndex).toUpperCase()}
              </Text>
              <SwipeableMealRow enabled={canMove} onMoveTo={() => setMoveFromDay(meal.dayIndex)}>
                <MealCard
                  recipe={recipe}
                  badge={
                    recipe.equipment?.includes('Instant Pot')
                      ? 'Instant Pot'
                      : recipe.makesLeftovers
                        ? 'makes leftovers'
                        : undefined
                  }
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
        })}

        {leftovers > 0 ? (
          <Card style={{ marginTop: theme.spacing.md, backgroundColor: theme.colors.accentMuted }}>
            <Text variant="subhead">
              🥡 {leftovers} meal{leftovers === 1 ? '' : 's'} make leftovers — a great excuse for a
              lighter or no-cook night to reuse them.
            </Text>
          </Card>
        ) : null}

        {reviewCard}

        {!draftPlan ? (
          <PrimaryButton
            title="Plan a new week"
            onPress={() => router.push('/plan')}
            style={{ marginTop: theme.spacing.lg }}
          />
        ) : null}

        {pastWeeksSection}
      </Screen>
      {moveFromDay !== null ? (
        <MoveMealSheet plan={plan} fromDay={moveFromDay} onClose={() => setMoveFromDay(null)} />
      ) : null}
    </>
  );
}

/**
 * M5.0: one row in the "Past weeks" archive — collapsed by default (a
 * chevron header, "Week of {date} · {n} dinners"); expanding shows one
 * read-only row per day. Pure reflection: no re-roll, no pin, no servings,
 * no shopping-list affordance anywhere in here — tapping a day only pushes
 * `/meal/[id]` for the RECIPE id, same read-only detail screen the Recipes
 * tab opens.
 */
function ArchivedWeekCard({
  plan,
  expanded,
  onToggle,
  recipeFor,
  recipesById,
  onOpenRecipe,
}: {
  plan: WeeklyPlan;
  expanded: boolean;
  onToggle: () => void;
  recipeFor: (meal: PlannedMeal) => Recipe | undefined;
  recipesById: Record<string, Recipe>;
  onOpenRecipe: (recipeId: string) => void;
}) {
  const theme = useTheme();
  const meals = [...plan.meals].sort((a, b) => a.dayIndex - b.dayIndex);
  const weekOfLabel = dateForDayIndex(plan.weekStartISO, 0).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  return (
    <Card padded={false} style={{ marginBottom: theme.spacing.sm, overflow: 'hidden' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} week of ${weekOfLabel}`}
        onPress={onToggle}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: theme.spacing.md,
        }}
      >
        <Text variant="subhead">
          Week of {weekOfLabel} · {meals.length} dinner{meals.length === 1 ? '' : 's'}
        </Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.textTertiary} />
      </Pressable>
      {expanded ? (
        <View style={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.sm }}>
          {meals.map((meal, i) => {
            const recipe = recipeFor(meal);
            if (!recipe) return null; // a recipe id that no longer resolves — skip gracefully, nothing crashes
            const sideNames = (meal.sideRecipeIds ?? [])
              .map((id) => recipesById[id]?.name)
              .filter((n): n is string => !!n);
            return (
              <Pressable
                key={meal.dayIndex}
                accessibilityRole="button"
                onPress={() => onOpenRecipe(recipe.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: theme.spacing.sm,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: theme.colors.separator,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text variant="caption" color="tertiary">
                    {dateForDayIndex(plan.weekStartISO, meal.dayIndex).toLocaleDateString(undefined, {
                      weekday: 'long',
                    })}
                  </Text>
                  <Text variant="body">{recipe.name}</Text>
                  {sideNames.length > 0 ? (
                    <Text variant="footnote" color="secondary" numberOfLines={1}>
                      + {sideNames.join(', ')}
                    </Text>
                  ) : null}
                  {meal.rating ? (
                    <View style={{ flexDirection: 'row', gap: 1, marginTop: 2 }}>
                      {Array.from({ length: 5 }, (_, s) => s + 1).map((s) => (
                        <Ionicons
                          key={s}
                          name={s <= meal.rating! ? 'star' : 'star-outline'}
                          size={12}
                          color={s <= meal.rating! ? theme.colors.star : theme.colors.textTertiary}
                        />
                      ))}
                    </View>
                  ) : null}
                </View>
                {meal.cooked ? (
                  <Ionicons
                    accessibilityLabel="Cooked"
                    name="checkmark-circle-outline"
                    size={16}
                    color={theme.colors.textTertiary}
                  />
                ) : null}
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} style={{ marginLeft: theme.spacing.xs }} />
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </Card>
  );
}
