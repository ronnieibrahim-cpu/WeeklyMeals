import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { PlannedMeal, Recipe, WeeklyPlan } from '@/domain/models';
import { eligibleMoveTargets } from '@/engine/rearrange';
import { allMealsRated } from '@/engine/rating';
import { dateForDayIndex, dayLabel, todayOffset } from '@/engine/schedule';
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
  SectionHeader,
  ServingsShoppingListPrompt,
  SwipeableMealRow,
  Text,
} from '@/ui/components';
import { useTheme } from '@/ui/theme/useTheme';

type WeekView = 'today' | 'schedule';

/**
 * Phase 4 G1: segmented control that switches This Week between the
 * day-focused "Today" view and the "Full week" view — the day-by-day list,
 * leftovers callout, and Past weeks archive that used to be the standalone
 * Schedule tab, folded in here since This Week already carries per-meal day
 * assignment. Styled the same token-driven way as the existing
 * `YesNoToggle` (src/ui/components/YesNoToggle.tsx) — no new component was
 * added to the shared library since this is a one-off, screen-local switch.
 */
function WeekViewSwitch({ value, onChange }: { value: WeekView; onChange: (v: WeekView) => void }) {
  const theme = useTheme();

  const option = (label: string, view: WeekView) => {
    const selected = value === view;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={label}
        onPress={() => onChange(view)}
        style={{
          flex: 1,
          alignItems: 'center',
          paddingVertical: theme.spacing.sm,
          borderRadius: theme.radius.md,
          backgroundColor: selected ? theme.colors.accent : theme.colors.backgroundSecondary,
        }}
      >
        <Text variant="subhead" color={selected ? 'onAccent' : 'primary'}>
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.lg }}>
      {option('Today', 'today')}
      {option('Full week', 'schedule')}
    </View>
  );
}

export default function ThisWeekScreen() {
  const router = useRouter();
  const theme = useTheme();
  // Phase 4 G1: the old standalone /schedule route now redirects here with
  // ?view=schedule so existing links land straight on the "Full week"
  // segment instead of the default "Today" one.
  const params = useLocalSearchParams<{ view?: string }>();
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

  const [view, setView] = useState<WeekView>(params.view === 'schedule' ? 'schedule' : 'today');

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
  const [pendingServingsToday, setPendingServingsToday] = useState<{ dayIndex: number; recipeId: string; oldServings: number } | null>(null);
  // M4.6 part 2: which day's meal (if any) is being moved — drives the
  // "Move to…" bottom sheet. Local-only, same reasoning as pendingServings
  // above: navigating away just drops it, nothing to persist.
  const [moveFromDayToday, setMoveFromDayToday] = useState<number | null>(null);

  // Phase 4 G1: the "Full week" segment (formerly the standalone Schedule
  // tab) keeps its own copies of this same local, never-persisted UI state
  // for the same reasons as above — this preserves the isolation the two
  // screens had when they were separate tabs (e.g. a pending servings
  // prompt opened in one segment never bleeds into the other).
  const [pendingServingsSchedule, setPendingServingsSchedule] = useState<{ dayIndex: number; recipeId: string; oldServings: number } | null>(null);
  const [moveFromDaySchedule, setMoveFromDaySchedule] = useState<number | null>(null);

  // M5.0: rolling per-device archive of the last 6 cooked weeks — read-only
  // reflection, browsable below the current week in the "Full week"
  // segment. Which cards are expanded is local-only UI state (multiple may
  // be open at once), not persisted.
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

  const switcher = <WeekViewSwitch value={view} onChange={setView} />;

  // ---------------------------------------------------------------------
  // "Full week" segment — formerly app/(tabs)/schedule.tsx. Deliberately
  // independent of `draftPlan`, exactly as the standalone Schedule tab was:
  // while a freshly generated draft awaits review in the "Today" segment,
  // this segment keeps showing the still-untouched approved `plan` day by
  // day, so switching over here never loses that view.
  // ---------------------------------------------------------------------
  if (view === 'schedule') {
    if (!plan || plan.status !== 'approved') {
      return (
        <Screen title="This Week" subtitle={today}>
          {switcher}
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
        <Screen title="This Week" subtitle={`${fmt(rangeStart)} – ${fmt(rangeEnd)} · ${cooked}/${meals.length} cooked`}>
          {switcher}
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
                <SwipeableMealRow enabled={canMove} onMoveTo={() => setMoveFromDaySchedule(meal.dayIndex)}>
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
                      setPendingServingsSchedule({ dayIndex: meal.dayIndex, recipeId: meal.recipeId, oldServings: meal.servings });
                      setApprovedMealServings(meal.dayIndex, servings);
                    }}
                    sideNames={(meal.sideRecipeIds ?? []).map((id) => recipesById[id]?.name).filter((n): n is string => !!n)}
                    hasNote={!!notesMap[recipe.id]?.text}
                  />
                </SwipeableMealRow>
                {pendingServingsSchedule?.dayIndex === meal.dayIndex && pendingServingsSchedule?.recipeId === meal.recipeId ? (
                  <ServingsShoppingListPrompt
                    dayIndex={meal.dayIndex}
                    oldServings={pendingServingsSchedule.oldServings}
                    onResolved={() => setPendingServingsSchedule(null)}
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
        {moveFromDaySchedule !== null ? (
          <MoveMealSheet plan={plan} fromDay={moveFromDaySchedule} onClose={() => setMoveFromDaySchedule(null)} />
        ) : null}
      </>
    );
  }

  // ---------------------------------------------------------------------
  // "Today" segment — the original This Week screen, unchanged.
  // ---------------------------------------------------------------------

  // A freshly generated draft always takes priority to nudge toward review,
  // regardless of whether an already-approved week still exists underneath
  // (it does, untouched, until the draft is approved or discarded — P0-3).
  if (draftPlan) {
    return (
      <Screen title="This Week" subtitle={today}>
        {switcher}
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
        {switcher}
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
  );

  const offset = todayOffset(plan.weekStartISO);

  // Today is past the last planned day → the week is done.
  if (offset >= meals.length) {
    return (
      <Screen title="This Week" subtitle={today}>
        {switcher}
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

  const renderMeal = (meal: PlannedMeal, label: string, featured = false) => {
    const recipe = recipeFor(meal);
    if (!recipe) return null;
    const canReroll = meal.dayIndex >= todayIndex && !meal.cooked;
    // M4.6 part 2: only offer "Move to…" when this meal isn't cooked AND
    // there's at least one not-yet-cooked other day to move it onto — never
    // an action that opens an empty picker (Law #3).
    const canMove = eligibleMoveTargets(plan, meal.dayIndex).length > 0;
    return (
      <View key={meal.dayIndex}>
        <SwipeableMealRow enabled={canMove} onMoveTo={() => setMoveFromDayToday(meal.dayIndex)}>
          <MealCard
            recipe={recipe}
            dayLabel={label}
            featured={featured}
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
              setPendingServingsToday({ dayIndex: meal.dayIndex, recipeId: meal.recipeId, oldServings: meal.servings });
              setApprovedMealServings(meal.dayIndex, servings);
            }}
            sideNames={(meal.sideRecipeIds ?? []).map((id) => recipesById[id]?.name).filter((n): n is string => !!n)}
            hasNote={!!notesMap[recipe.id]?.text}
          />
        </SwipeableMealRow>
        {pendingServingsToday?.dayIndex === meal.dayIndex && pendingServingsToday?.recipeId === meal.recipeId ? (
          <ServingsShoppingListPrompt
            dayIndex={meal.dayIndex}
            oldServings={pendingServingsToday.oldServings}
            onResolved={() => setPendingServingsToday(null)}
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
      {switcher}
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

      {tonight && tonightRecipe ? renderMeal(tonight, 'Tonight', true) : null}

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

      <PrimaryButton
        title="Plan a new week"
        onPress={() => router.push('/plan')}
        style={{ marginTop: theme.spacing.lg }}
      />
    </Screen>
    {moveFromDayToday !== null ? (
      <MoveMealSheet plan={plan} fromDay={moveFromDayToday} onClose={() => setMoveFromDayToday(null)} />
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
