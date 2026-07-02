import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { INGREDIENT_SUGGESTIONS } from '@/data/ingredientSuggestions';
import { RECIPES } from '@/data/seed/recipes';
import { createDefaultProfile } from '@/domain/defaults';
import { Recipe } from '@/domain/models';
import {
  GenerateContext,
  ingredientsUsed,
  rankRerollCandidates,
} from '@/engine/recommendation';
import { seasonForDate } from '@/engine/season';
import { useLearningStore } from '@/stores/learningStore';
import { usePantryStore } from '@/stores/pantryStore';
import { usePlanStore } from '@/stores/planStore';
import { useProfileStore } from '@/stores/profileStore';
import {
  AutocompleteTagInput,
  Chip,
  MealCard,
  PrimaryButton,
  SecondaryButton,
  Text,
} from '@/ui/components';
import { useTheme } from '@/ui/theme/useTheme';

/**
 * Reroll one dinner after the week is finalized. Optionally biased toward
 * ingredients to use up (on hand, or already on this week's H-E-B list).
 */
export default function RerollMealScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { day } = useLocalSearchParams<{ day: string }>();
  const dayIndex = Number(day);

  const plan = usePlanStore((s) => s.plan);
  const history = usePlanStore((s) => s.history);
  const shoppingList = usePlanStore((s) => s.shoppingList);
  const recipeFor = usePlanStore((s) => s.recipeFor);
  const applyReroll = usePlanStore((s) => s.applyReroll);
  const profile = useProfileStore((s) => s.profile);
  const pantry = usePantryStore((s) => s.items);
  const preferences = useLearningStore((s) => s.preferences);
  const favorites = useLearningStore((s) => s.favorites);

  const [useUp, setUseUp] = useState<string[]>([]);
  const [declinedIds, setDeclinedIds] = useState<string[]>([]);

  const close = () => router.back();

  const meal = plan?.meals.find((m) => m.dayIndex === dayIndex);
  const current = meal ? recipeFor(meal) : undefined;

  const weekIngredients = useMemo(
    () =>
      plan && shoppingList && shoppingList.planId === plan.id
        ? shoppingList.items.map((i) => i.ingredientName)
        : [],
    [plan, shoppingList],
  );

  const candidates = useMemo(() => {
    if (!plan || !meal) return [];
    const ctx: GenerateContext = {
      intake: plan.intake,
      profile: profile ?? createDefaultProfile(),
      preferences,
      favoriteRecipeIds: favorites,
      recentRecipeIds: history.slice(0, 2).flatMap((p) => p.meals.map((m) => m.recipeId)),
      pantry: [...plan.intake.ingredientsAtHome, ...useUp],
      season: seasonForDate(new Date()),
    };
    const kept = plan.meals
      .filter((m) => m.dayIndex !== dayIndex)
      .map((m) => recipeFor(m))
      .filter((r): r is Recipe => !!r);
    return rankRerollCandidates(RECIPES, ctx, kept, {
      excludeIds: [...plan.meals.map((m) => m.recipeId), ...declinedIds],
      useUpIngredients: useUp,
      weekIngredients,
    });
  }, [plan, meal, dayIndex, profile, preferences, favorites, history, useUp, declinedIds, weekIngredients, recipeFor]);

  if (!plan || !meal || !current) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl }}>
          <Text variant="title2" center>
            Nothing to reroll
          </Text>
          <SecondaryButton title="Close" onPress={close} style={{ marginTop: theme.spacing.xl }} />
        </View>
      </SafeAreaView>
    );
  }

  const pick = candidates[0];
  const usedFromInput = pick ? ingredientsUsed(pick, useUp) : [];
  const usedFromWeek = pick ? ingredientsUsed(pick, weekIngredients) : [];

  // One-tap sources for "use up": persistent pantry + this week's list.
  const quickAdds = [...pantry, ...weekIngredients]
    .filter((item, i, all) => all.findIndex((x) => x.toLowerCase() === item.toLowerCase()) === i)
    .filter((item) => !useUp.some((u) => u.toLowerCase() === item.toLowerCase()))
    .slice(0, 12);

  const suggestions = Array.from(
    new Set([...INGREDIENT_SUGGESTIONS, ...pantry.map((p) => p.toLowerCase())]),
  );

  const dayName = (() => {
    const d = new Date(plan.weekStartISO);
    d.setDate(d.getDate() + dayIndex);
    return d.toLocaleDateString(undefined, { weekday: 'long' });
  })();

  const onKeep = () => {
    if (!pick) return;
    applyReroll(dayIndex, pick.id);
    close();
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={['top', 'left', 'right']}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingHorizontal: theme.spacing.xl,
          paddingTop: theme.spacing.sm,
        }}
      >
        <Pressable accessibilityLabel="Close" hitSlop={8} onPress={close}>
          <Ionicons name="close" size={26} color={theme.colors.text} />
        </Pressable>
        <Text variant="headline">Reroll {dayName}&apos;s dinner</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: theme.spacing.xl, paddingTop: theme.spacing.md }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="footnote" color="secondary" style={{ marginBottom: theme.spacing.sm }}>
          SWAPPING OUT
        </Text>
        <MealCard recipe={current} />

        <Text variant="subhead" style={{ marginTop: theme.spacing.md }}>
          Ingredients to use up? (optional)
        </Text>
        <Text variant="footnote" color="tertiary" style={{ marginTop: 2, marginBottom: theme.spacing.md }}>
          I&apos;ll favor dinners that use what you have on hand or what&apos;s already on this
          week&apos;s list.
        </Text>
        <AutocompleteTagInput
          values={useUp}
          suggestions={suggestions}
          onAdd={(item) => setUseUp((v) => [...v, item])}
          onRemove={(item) => setUseUp((v) => v.filter((x) => x !== item))}
          placeholder="e.g. chicken thighs, spinach…"
        />

        {quickAdds.length > 0 ? (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: theme.spacing.sm,
              marginTop: theme.spacing.md,
            }}
          >
            {quickAdds.map((item) => (
              <Chip
                key={item}
                label={`+ ${item}`}
                selected={false}
                onPress={() => setUseUp((v) => [...v, item])}
              />
            ))}
          </View>
        ) : null}

        <Text
          variant="footnote"
          color="secondary"
          style={{ marginTop: theme.spacing.xl, marginBottom: theme.spacing.sm }}
        >
          NEW PICK
        </Text>
        {pick ? (
          <>
            <MealCard
              recipe={pick}
              onPress={() => router.push({ pathname: '/meal/[id]', params: { id: pick.id } })}
            />
            {usedFromInput.length > 0 || usedFromWeek.length > 0 ? (
              <Text variant="footnote" color="secondary" style={{ marginTop: -theme.spacing.xs }}>
                {usedFromInput.length > 0 ? `Uses ${usedFromInput.join(', ')}` : ''}
                {usedFromInput.length > 0 && usedFromWeek.length > 0 ? ' · ' : ''}
                {usedFromWeek.length > 0
                  ? `${usedFromWeek.length} ingredient${usedFromWeek.length === 1 ? '' : 's'} already on your list`
                  : ''}
              </Text>
            ) : null}
            <SecondaryButton
              title="🎲 Try another"
              onPress={() => setDeclinedIds((ids) => [...ids, pick.id])}
              style={{ marginTop: theme.spacing.md }}
            />
          </>
        ) : (
          <>
            <Text variant="body" color="secondary">
              No more dinners fit this week&apos;s filters. Loosen the ingredients above or start
              over.
            </Text>
            {declinedIds.length > 0 ? (
              <SecondaryButton
                title="Show earlier picks again"
                onPress={() => setDeclinedIds([])}
                style={{ marginTop: theme.spacing.md }}
              />
            ) : null}
          </>
        )}
      </ScrollView>

      <View
        style={{
          paddingHorizontal: theme.spacing.xl,
          paddingTop: theme.spacing.md,
          paddingBottom: theme.spacing.lg + insets.bottom,
          borderTopWidth: 1,
          borderTopColor: theme.colors.separator,
        }}
      >
        <PrimaryButton title="Swap it in" onPress={onKeep} disabled={!pick} />
        <Text variant="footnote" color="tertiary" center style={{ marginTop: theme.spacing.sm }}>
          Your H-E-B list updates automatically — checked items stay checked.
        </Text>
      </View>
    </SafeAreaView>
  );
}
