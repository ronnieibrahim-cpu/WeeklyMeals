import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Profile, Recipe } from '@/domain/models';
import { createDefaultProfile } from '@/domain/defaults';
import { passesAllergySafety } from '@/engine/recommendation';
import { PinBlockReason } from '@/engine/reroll';
import { dayLabel } from '@/engine/schedule';
import { usePlanStore } from '@/stores/planStore';
import { useProfileStore } from '@/stores/profileStore';
import { useRecipesById } from '@/stores/userRecipesStore';
import { Card, PrimaryButton, RecipeImage, SecondaryButton, Text } from '@/ui/components';
import { useTheme } from '@/ui/theme/useTheme';

/** M3.1 addition 3: plain-English reason a pin is blocked on allergy safety
 * grounds, or null if it's safe. Mirrors exactly what `passesAllergySafety`
 * checks — this only turns the same boolean into copy for the screen. */
function safetyBlockReason(recipe: Recipe, profile: Profile): string | null {
  if (passesAllergySafety(recipe, profile)) return null;
  const allergies = profile.allergies.map((a) => a.toLowerCase());
  const matched = recipe.allergens.filter((a) => allergies.includes(a.toLowerCase()));
  if (matched.length > 0) {
    return `Contains ${matched.join(', ')} — you've flagged that as an allergy, so this can't be pinned.`;
  }
  return "This is an imported recipe with estimated allergen info, and you have an allergy set — its ingredient data isn't reliable enough to trust automatically, so it can't be pinned.";
}

/**
 * Plain-English copy for each reason a pin has nowhere to go. This screen
 * used to print the "already in this week's plan" line for EVERY empty day
 * list, which was flatly wrong (and confusing) when the real cause was a
 * week whose days had run out — the case you hit while reviewing a new week,
 * because the active plan is still last week's. A draft has no dates and no
 * cooked days, so its only possible reason is `already-in-plan`.
 */
function blockedMessage(recipeName: string, reason: PinBlockReason | null): string {
  switch (reason) {
    case 'week-elapsed':
      return "This week's days have all passed, so there's no upcoming night to pin into. Use “Pick up from today” on This Week to re-date the rest of the week, or plan a new week.";
    case 'remaining-days-cooked':
      return "Every night left this week is already cooked — a cooked day is history, so there's nothing to replace.";
    case 'already-in-plan':
      return `${recipeName} is already in this week's plan — a recipe can't be pinned to two days at once.`;
    default:
      // Defensive: days.length === 0 always has one of the reasons above.
      return "There's no night available to pin into right now.";
  }
}

export default function PinScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { recipeId, target } = useLocalSearchParams<{ recipeId: string; target?: string }>();
  const isDraft = target === 'draft';

  const recipesById = useRecipesById();
  const recipe = recipeId ? recipesById[recipeId] : undefined;
  const profile = useProfileStore((s) => s.profile) ?? createDefaultProfile();
  const plan = usePlanStore((s) => s.plan);
  const draftPlan = usePlanStore((s) => s.draftPlan);
  const pinnableDaysFor = usePlanStore((s) => s.pinnableDaysFor);
  const pinBlockReasonFor = usePlanStore((s) => s.pinBlockReasonFor);
  const pinnableDraftDaysFor = usePlanStore((s) => s.pinnableDraftDaysFor);
  const missingIngredientsForPin = usePlanStore((s) => s.missingIngredientsForPin);
  const pinRecipeToWeek = usePlanStore((s) => s.pinRecipeToWeek);
  const pinRecipeToDraft = usePlanStore((s) => s.pinRecipeToDraft);
  const addMissingIngredients = usePlanStore((s) => s.addMissingIngredients);

  const targetPlan = isDraft ? draftPlan : plan;
  const days = useMemo(
    () => (recipeId ? (isDraft ? pinnableDraftDaysFor(recipeId) : pinnableDaysFor(recipeId)) : []),
    [recipeId, isDraft, pinnableDraftDaysFor, pinnableDaysFor, targetPlan],
  );

  const pinBlock = useMemo(
    () => (recipeId && !isDraft ? pinBlockReasonFor(recipeId) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- targetPlan is the state this reads through the store selector
    [recipeId, isDraft, pinBlockReasonFor, targetPlan],
  );

  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const close = () => router.back();

  const header = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.sm,
        paddingBottom: theme.spacing.md,
      }}
    >
      {/* Matches the button that opened this screen (meal detail uses the
          same wording), so it's always clear WHICH week is being pinned into
          — the draft under review, or the active week. */}
      <Text variant="headline">{isDraft ? 'Pin to this draft' : 'Pin to this week'}</Text>
      <Pressable accessibilityLabel="Close" accessibilityRole="button" hitSlop={8} onPress={close}>
        <Ionicons name="close" size={26} color={theme.colors.text} />
      </Pressable>
    </View>
  );

  if (!recipe || !targetPlan) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'left', 'right']}>
        {header}
        <View style={{ padding: theme.spacing.xl }}>
          <Text variant="body" color="secondary">
            {!recipe ? "Couldn't find that recipe." : "There's no week to pin into right now."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const blockReason = safetyBlockReason(recipe, profile);
  if (blockReason) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'left', 'right']}>
        {header}
        <View style={{ padding: theme.spacing.xl }}>
          <Text variant="body" color="secondary">
            {blockReason}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (days.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'left', 'right']}>
        {header}
        <View style={{ padding: theme.spacing.xl }}>
          <Text variant="body" color="secondary">
            {blockedMessage(recipe.name, isDraft ? 'already-in-plan' : pinBlock)}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const finishPin = (dayIndex: number, alsoAddMissing: boolean) => {
    if (isDraft) {
      pinRecipeToDraft(dayIndex, recipe.id);
    } else {
      pinRecipeToWeek(dayIndex, recipe.id);
      if (alsoAddMissing) addMissingIngredients(dayIndex, recipe.id);
    }
    router.back();
  };

  const onPickDay = (dayIndex: number) => {
    // Drafts have no shopping list yet — missing ingredients flow in
    // automatically once the week is approved, so no confirm step needed.
    if (isDraft) {
      finishPin(dayIndex, false);
      return;
    }
    const missing = missingIngredientsForPin(dayIndex, recipe.id);
    if (missing.length === 0) {
      finishPin(dayIndex, false);
      return;
    }
    setSelectedDay(dayIndex);
  };

  const missingForSelected = selectedDay !== null ? missingIngredientsForPin(selectedDay, recipe.id) : [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'left', 'right']}>
      {header}
      <ScrollView contentContainerStyle={{ padding: theme.spacing.xl, paddingTop: 0 }} showsVerticalScrollIndicator={false}>
        <Card style={{ marginBottom: theme.spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ marginRight: theme.spacing.md }}>
              <RecipeImage recipe={recipe} width={52} height={52} emojiSize={26} radius={theme.radius.md} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="headline" numberOfLines={1}>
                {recipe.name}
              </Text>
              <Text variant="footnote" color="secondary">
                {recipe.cuisine} · {recipe.difficulty}
              </Text>
            </View>
          </View>
        </Card>

        {selectedDay === null ? (
          <>
            <Text variant="body" color="secondary" style={{ marginBottom: theme.spacing.md }}>
              Pick a day to replace:
            </Text>
            {days.map((dayIndex) => {
              const outgoing = targetPlan.meals.find((m) => m.dayIndex === dayIndex);
              const outgoingRecipe = outgoing ? recipesById[outgoing.recipeId] : undefined;
              return (
                <Card key={dayIndex} onPress={() => onPickDay(dayIndex)} style={{ marginBottom: theme.spacing.md }}>
                  <Text variant="headline">{dayLabel(targetPlan.weekStartISO, dayIndex)}</Text>
                  {outgoingRecipe ? (
                    <Text variant="footnote" color="secondary" style={{ marginTop: 2 }}>
                      Currently: {outgoingRecipe.name}
                    </Text>
                  ) : null}
                </Card>
              );
            })}
          </>
        ) : (
          <>
            <Text variant="body" color="secondary" style={{ marginBottom: theme.spacing.sm }}>
              Pinning {recipe.name} to {dayLabel(targetPlan.weekStartISO, selectedDay)}.
            </Text>
            <Text variant="footnote" color="accent" style={{ marginBottom: theme.spacing.lg }}>
              You'll need: {missingForSelected.join(', ')}
            </Text>
            <PrimaryButton title="Pin" onPress={() => finishPin(selectedDay, false)} />
            <SecondaryButton
              title="Pin + add these to shopping list"
              onPress={() => finishPin(selectedDay, true)}
              style={{ marginTop: theme.spacing.md }}
            />
            <SecondaryButton
              title="Choose a different day"
              onPress={() => setSelectedDay(null)}
              style={{ marginTop: theme.spacing.md }}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
