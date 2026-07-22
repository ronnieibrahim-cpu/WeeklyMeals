import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Recipe } from '@/domain/models';
import { RerollCandidate } from '@/engine/reroll';
import { usePlanStore } from '@/stores/planStore';
import { useRecipesById } from '@/stores/userRecipesStore';
import { Card, PrimaryButton, RecipeImage, SecondaryButton, Text } from '@/ui/components';
import { useTheme } from '@/ui/theme/useTheme';

/**
 * M4.5: one row of the outgoing plate (the main, or one side/sauce) with a
 * Keep toggle — same lock glyph/color idiom as the review screen's
 * lock-to-keep (`MealCard`'s `onToggleLock`: `lock-closed`/accent when on,
 * `lock-open-outline`/tertiary when off), plus a short label since this
 * isn't sitting inside a card that already gives the row context.
 */
function KeepRow({
  theme,
  label,
  kept,
  onToggle,
}: {
  theme: ReturnType<typeof useTheme>;
  label: string;
  kept: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={kept ? `Unlock ${label}` : `Keep ${label}`}
      hitSlop={6}
      onPress={onToggle}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing.xs,
      }}
    >
      <Text variant="subhead" style={{ flexShrink: 1 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: theme.spacing.sm }}>
        <Ionicons
          name={kept ? 'lock-closed' : 'lock-open-outline'}
          size={18}
          color={kept ? theme.colors.accent : theme.colors.textTertiary}
        />
        <Text variant="footnote" color={kept ? 'accent' : 'tertiary'}>
          {kept ? 'Kept' : 'Keep'}
        </Text>
      </View>
    </Pressable>
  );
}

export default function RerollScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { dayIndex: dayIndexParam } = useLocalSearchParams<{ dayIndex: string }>();
  const dayIndex = Number(dayIndexParam);

  const plan = usePlanStore((s) => s.plan);
  const previewReroll = usePlanStore((s) => s.previewReroll);
  const previewComponentReroll = usePlanStore((s) => s.previewComponentReroll);
  const rerollSidesOnly = usePlanStore((s) => s.rerollSidesOnly);
  const commitComponentReroll = usePlanStore((s) => s.commitComponentReroll);

  const recipesById = useRecipesById();
  const outgoingMeal = plan?.meals.find((m) => m.dayIndex === dayIndex);
  const outgoingRecipe = outgoingMeal ? recipesById[outgoingMeal.recipeId] : undefined;
  const outgoingSides = (outgoingMeal?.sideRecipeIds ?? [])
    .map((id) => recipesById[id])
    .filter((r): r is Recipe => !!r);

  // M4.5: which plate part(s) the user has locked before re-rolling.
  // Default: nothing kept (today's whole-plate behavior, unchanged).
  const [keepMain, setKeepMain] = useState(false);
  const [keptSideIds, setKeptSideIds] = useState<string[]>([]);
  const [index, setIndex] = useState(0);

  const toggleKeepMain = () => {
    setKeepMain((v) => !v);
    setIndex(0);
  };
  const toggleKeptSide = (id: string) => {
    setKeptSideIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
    setIndex(0);
  };

  // Mirrors `rerollKeepMain`'s own guard in src/engine/reroll.ts: the plate
  // caps at 2 sides total, so keeping the main plus both of the outgoing
  // plate's sides leaves no room to add anything and nothing droppable
  // either — there is no possible alternative plate to offer. Checked here
  // so the screen can show a plain one-line explanation instead of running
  // a search that's guaranteed to come back empty (Law #3: no spinner
  // pretending to search).
  const nothingToReroll = keepMain && keptSideIds.length >= 2;
  const hasKeep = keepMain || keptSideIds.length > 0;

  const outcome = useMemo(() => {
    if (!outgoingMeal || nothingToReroll) return { candidates: [], nearMisses: [] };
    return hasKeep
      ? previewComponentReroll(dayIndex, { keepMain, keptSideIds })
      : previewReroll(dayIndex);
  }, [dayIndex, outgoingMeal, nothingToReroll, hasKeep, keepMain, keptSideIds, previewReroll, previewComponentReroll]);

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
      <Text variant="headline">Re-roll</Text>
      <Pressable accessibilityLabel="Close" accessibilityRole="button" hitSlop={8} onPress={close}>
        <Ionicons name="close" size={26} color={theme.colors.text} />
      </Pressable>
    </View>
  );

  if (!plan || !outgoingMeal || !outgoingRecipe) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'left', 'right']}>
        {header}
        <View style={{ padding: theme.spacing.xl }}>
          <Text variant="body" color="secondary">
            This meal isn't available to re-roll anymore.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Commit wiring (Law #5 — the store re-applies the allergy guard itself
  // at the point of replacement; this screen's job is only to route to the
  // right commit action, never to decide safety): keeping the main means
  // only the sides are changing, so `rerollSidesOnly` is the commit path
  // (sides + sidesChangedAtISO only — cooked/rating untouched, the dish
  // didn't change). Keeping the sides (or no keep at all) means the main is
  // changing — a new dish — so `commitComponentReroll` is the commit path
  // (full body stamp via `rerollMeal`, cooked/rating cleared).
  const commit = (recipeId: string, sideRecipeIds: string[]) => {
    // F5: pass the outgoing main id the preview was computed against, so a
    // commit no-ops if a synced change swapped this day's dish out from
    // under the preview between render and tap.
    const expectedRecipeId = outgoingMeal.recipeId;
    if (keepMain) rerollSidesOnly(dayIndex, sideRecipeIds, expectedRecipeId);
    else commitComponentReroll(dayIndex, { recipeId, sideRecipeIds }, expectedRecipeId);
    router.back();
  };

  const keptSideIdSet = new Set(keptSideIds);

  const renderSides = (ids: string[]) => {
    const sides = ids.map((id) => recipesById[id]).filter((r): r is Recipe => !!r);
    if (sides.length === 0) return null;
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
        {sides.map((side) => {
          const kept = keptSideIdSet.has(side.id);
          return (
            <View key={side.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              {kept ? <Ionicons name="lock-closed" size={12} color={theme.colors.accent} /> : null}
              <Text variant="footnote" color="secondary">
                {side.name}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  const { candidates, nearMisses } = outcome;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'left', 'right']}>
      {header}
      <ScrollView contentContainerStyle={{ padding: theme.spacing.xl, paddingTop: 0 }} showsVerticalScrollIndicator={false}>
        <Text variant="body" color="secondary" style={{ marginBottom: theme.spacing.lg }}>
          Swapping out <Text variant="body" style={{ fontWeight: '600' }}>{outgoingRecipe.name}</Text> — only
          meals fully covered by your pantry and this week's shopping list are offered, so this never adds a
          store trip.
        </Text>

        <Card style={{ marginBottom: theme.spacing.lg }}>
          <Text variant="footnote" color="tertiary" style={{ marginBottom: theme.spacing.xs }}>
            Keep a part of tonight's plate, and I'll build a new one around it.
          </Text>
          <KeepRow theme={theme} label={outgoingRecipe.name} kept={keepMain} onToggle={toggleKeepMain} />
          {outgoingSides.map((side) => (
            <KeepRow
              key={side.id}
              theme={theme}
              label={side.name}
              kept={keptSideIds.includes(side.id)}
              onToggle={() => toggleKeptSide(side.id)}
            />
          ))}
        </Card>

        {nothingToReroll ? (
          <Text variant="body" color="secondary">
            Keeping the main and every side leaves nothing to re-roll — unlock something first.
          </Text>
        ) : candidates.length > 0 ? (
          (() => {
            const { recipe: candidate, sideRecipeIds }: RerollCandidate = candidates[index % candidates.length];
            return (
              <>
                <Card>
                  <View style={{ marginBottom: theme.spacing.md }}>
                    <RecipeImage recipe={candidate} height={140} radius={theme.radius.lg} />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {keepMain ? <Ionicons name="lock-closed" size={14} color={theme.colors.accent} /> : null}
                    <Text variant="title3">{candidate.name}</Text>
                  </View>
                  <Text variant="subhead" color="secondary" style={{ marginTop: 2 }}>
                    {candidate.cuisine} · {candidate.difficulty} · {candidate.prepMinutes + candidate.cookMinutes}m
                  </Text>
                  {renderSides(sideRecipeIds)}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="View recipe"
                    onPress={() => router.push({ pathname: '/meal/[id]', params: { id: candidate.id } })}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      marginTop: theme.spacing.sm,
                    }}
                  >
                    <Ionicons name="book-outline" size={16} color={theme.colors.accent} />
                    <Text variant="footnote" color="accent">
                      View recipe
                    </Text>
                  </Pressable>
                </Card>

                <PrimaryButton
                  title="Swap it in"
                  onPress={() => commit(candidate.id, sideRecipeIds)}
                  style={{ marginTop: theme.spacing.lg }}
                />
                {candidates.length > 1 ? (
                  <SecondaryButton
                    title="Try another"
                    onPress={() => setIndex((i) => i + 1)}
                    style={{ marginTop: theme.spacing.md }}
                  />
                ) : null}
              </>
            );
          })()
        ) : nearMisses.length > 0 ? (
          <>
            <Text variant="headline" style={{ marginBottom: theme.spacing.sm }}>
              Nothing can be made entirely from what you have
            </Text>
            <Text variant="body" color="secondary" style={{ marginBottom: theme.spacing.lg }}>
              These are close — pick one and I'll tell you exactly what to grab (it won't touch your shopping
              list automatically).
            </Text>
            {nearMisses.map(({ recipe, sideRecipeIds, missing }) => (
              <Card
                key={recipe.id}
                onPress={() => commit(recipe.id, sideRecipeIds)}
                style={{ marginBottom: theme.spacing.md }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  {keepMain ? <Ionicons name="lock-closed" size={14} color={theme.colors.accent} /> : null}
                  <Text variant="headline">{recipe.name}</Text>
                </View>
                <Text variant="subhead" color="secondary" style={{ marginTop: 2 }}>
                  {recipe.cuisine} · {recipe.difficulty}
                </Text>
                {renderSides(sideRecipeIds)}
                <Text variant="footnote" color="accent" style={{ marginTop: theme.spacing.xs }}>
                  You'll need: {missing.join(', ')}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="View recipe"
                  onPress={() => router.push({ pathname: '/meal/[id]', params: { id: recipe.id } })}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    marginTop: theme.spacing.sm,
                  }}
                >
                  <Ionicons name="book-outline" size={16} color={theme.colors.accent} />
                  <Text variant="footnote" color="accent">
                    View recipe
                  </Text>
                </Pressable>
              </Card>
            ))}
          </>
        ) : (
          <Text variant="body" color="secondary">
            Nothing fits what you already have on hand this week, even loosely. Try adding a few pantry items,
            or keep tonight's plan as-is.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
