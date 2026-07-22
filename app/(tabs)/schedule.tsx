import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { PlannedMeal, Recipe, WeeklyPlan } from '@/domain/models';
import { eligibleMoveTargets } from '@/engine/rearrange';
import { dateForDayIndex } from '@/engine/schedule';
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
  Screen,
  SectionHeader,
  ServingsShoppingListPrompt,
  SwipeableMealRow,
  Text,
} from '@/ui/components';
import { useTheme } from '@/ui/theme/useTheme';

export default function ScheduleScreen() {
  const router = useRouter();
  const theme = useTheme();
  const plan = usePlanStore((s) => s.plan);
  const hydrated = usePlanStore((s) => s.hydrated);
  const recipeFor = usePlanStore((s) => s.recipeFor);
  const toggleCooked = usePlanStore((s) => s.toggleCooked);
  const rateMeal = usePlanStore((s) => s.rateMeal);
  const setApprovedMealServings = usePlanStore((s) => s.setApprovedMealServings);
  const kidApprovedMap = useLearningStore((s) => s.kidApprovedMap);
  const toggleKidApproved = useLearningStore((s) => s.toggleKidApproved);
  const recipesById = useRecipesById();
  // M4.4: subscribe to the data (notesMap), not a lookup function — the
  // M4.0a lesson (see recipeNotesStore's doc comment).
  const notesMap = useRecipeNotesStore((s) => s.notesMap);
  // M4.1: see app/(tabs)/index.tsx for why this is local-only, not persisted.
  // F6 (July 2026 sweep): keyed by recipeId too, so a move/swap that changes
  // which dish sits on this day drops the prompt instead of applying a
  // phantom delta to the shopping list — see the fuller note in index.tsx.
  const [pendingServings, setPendingServings] = useState<{ dayIndex: number; recipeId: string; oldServings: number } | null>(null);
  // M4.6 part 2: which day's meal (if any) is being moved — drives the
  // "Move to…" bottom sheet. Local-only, same reasoning as above.
  const [moveFromDay, setMoveFromDay] = useState<number | null>(null);

  // M5.0: rolling per-device archive of the last 6 cooked weeks — read-only
  // reflection, browsable below the current week. Which cards are expanded
  // is local-only UI state (multiple may be open at once), not persisted.
  const history = usePlanHistoryStore((s) => s.history);
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
  const pastWeeksSection =
    history.length > 0 ? (
      <View style={{ marginTop: theme.spacing.md }}>
        <SectionHeader title="Past weeks" />
        {history.map((week) => (
          <ArchivedWeekCard
            key={week.id}
            plan={week}
            expanded={expandedHistoryIds.has(week.id)}
            onToggle={() => toggleHistoryExpanded(week.id)}
            recipeFor={recipeFor}
            recipesById={recipesById}
            onOpenRecipe={openArchivedRecipe}
          />
        ))}
      </View>
    ) : null;

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

  return (
    <>
    <Screen title="Schedule" subtitle={`${fmt(rangeStart)} – ${fmt(rangeEnd)} · ${cooked}/${meals.length} cooked`}>
      {meals.map((meal) => {
        const recipe = recipeFor(meal);
        if (!recipe) return null;
        // M4.6 part 2: only offer "Move to…" when this meal isn't cooked
        // AND there's at least one not-yet-cooked other day to move it onto
        // — never an action that opens an empty picker (Law #3).
        const canMove = eligibleMoveTargets(plan, meal.dayIndex).length > 0;
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
                badge={recipe.makesLeftovers ? 'makes leftovers' : undefined}
                cooked={meal.cooked}
                rating={meal.rating}
                onRate={(rating) => rateMeal(meal.dayIndex, rating)}
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

      {pastWeeksSection}
      {history.length === 0 ? (
        <Text variant="footnote" color="tertiary" style={{ marginTop: theme.spacing.md }}>
          Past weeks will appear here once your next week is approved.
        </Text>
      ) : null}
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
