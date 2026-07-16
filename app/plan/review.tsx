import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLearningStore } from '@/stores/learningStore';
import { usePlanStore } from '@/stores/planStore';
import { useSyncStore } from '@/stores/syncStore';
import { Card, MealCard, PrimaryButton, SecondaryButton, Text } from '@/ui/components';
import { useTheme } from '@/ui/theme/useTheme';

export default function ReviewPlanScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const draftPlan = usePlanStore((s) => s.draftPlan);
  const recipeFor = usePlanStore((s) => s.recipeFor);
  const regenerate = usePlanStore((s) => s.regenerate);
  const toggleLock = usePlanStore((s) => s.toggleLock);
  const swapCandidates = usePlanStore((s) => s.swapCandidates);
  const swapMealTo = usePlanStore((s) => s.swapMealTo);
  const setDraftMealServings = usePlanStore((s) => s.setDraftMealServings);
  const approve = usePlanStore((s) => s.approve);
  const discardDraft = usePlanStore((s) => s.discardDraft);
  const previewShoppingList = usePlanStore((s) => s.previewShoppingList);
  const isKidApproved = useLearningStore((s) => s.isKidApproved);
  const toggleKidApproved = useLearningStore((s) => s.toggleKidApproved);

  // Swap now offers a choice instead of silently committing to the
  // algorithm's single top pick — see swapCandidates (up to 3, diversified
  // by cuisine so it isn't just 3 near-identical dishes).
  const [swapDayIndex, setSwapDayIndex] = useState<number | null>(null);
  const candidates = swapDayIndex !== null ? swapCandidates(swapDayIndex) : [];

  // Closing without approving discards the draft rather than leaving it
  // sitting around half-reviewed — whatever plan was already active (if
  // any) is untouched either way (P0-3).
  const close = () => {
    discardDraft();
    router.dismissAll();
  };

  if (!draftPlan) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl }}>
          <Text variant="title2" center>
            No plan to review
          </Text>
          <SecondaryButton title="Close" onPress={close} style={{ marginTop: theme.spacing.xl }} />
        </View>
      </SafeAreaView>
    );
  }

  const meals = [...draftPlan.meals].sort((a, b) => a.dayIndex - b.dayIndex);
  const preview = previewShoppingList(draftPlan);
  const totalCost = preview.estimatedTotal;
  const perServing = preview.costPerServing;
  const shortfall = draftPlan.intake.dinners - meals.length;

  const onApprove = async () => {
    // Reconcile with the household sync partner first, so approve()'s
    // "clear checked manual items" step (M3.3) sees the merged checked
    // state — otherwise an item checked only on the other phone since our
    // last poll would survive the clear by mistake. syncNow() no-ops
    // harmlessly if sync isn't set up or the request fails.
    await useSyncStore.getState().syncNow();
    approve();
    router.dismissAll();
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
        <Text variant="headline">Your Week</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: theme.spacing.xl, paddingTop: theme.spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        <Card style={{ marginBottom: theme.spacing.lg }}>
          <Text variant="title3">{meals.length} dinners</Text>
          <Text variant="subhead" color="secondary" style={{ marginTop: 2 }}>
            Est. ${totalCost.toFixed(0)} · ~${perServing.toFixed(2)} / serving
          </Text>
          <Text variant="footnote" color="tertiary" style={{ marginTop: theme.spacing.xs }}>
            Lock the ones you love, swap or regenerate the rest.
          </Text>
        </Card>

        {shortfall > 0 ? (
          <Card style={{ marginBottom: theme.spacing.lg, backgroundColor: theme.colors.accentMuted }}>
            <Text variant="subhead">
              Only {meals.length} meals fit your filters this week. As the recipe library grows,
              tight combinations will fill all {draftPlan.intake.dinners}.
            </Text>
          </Card>
        ) : null}

        {meals.map((meal) => {
          const recipe = recipeFor(meal);
          if (!recipe) return null;
          return (
            <MealCard
              key={meal.dayIndex}
              recipe={recipe}
              locked={meal.locked}
              badge={recipe.makesLeftovers ? 'leftovers' : undefined}
              onPress={() => router.push({ pathname: '/meal/[id]', params: { id: recipe.id } })}
              onToggleLock={() => toggleLock(meal.recipeId)}
              onSwap={() => setSwapDayIndex(meal.dayIndex)}
              kidApproved={isKidApproved(recipe.id)}
              onToggleKidApproved={() => toggleKidApproved(recipe.id)}
              servings={meal.servings}
              onServingsChange={(servings) => setDraftMealServings(meal.dayIndex, servings)}
            />
          );
        })}

        <SecondaryButton
          title="↻  Regenerate unlocked"
          onPress={regenerate}
          style={{ marginTop: theme.spacing.sm }}
        />
        <SecondaryButton
          title="★  Swap in a favorite"
          onPress={() =>
            router.push({ pathname: '/(tabs)/recipes', params: { favoritesOnly: '1', pinTarget: 'draft' } })
          }
          style={{ marginTop: theme.spacing.sm }}
        />
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
        <PrimaryButton title="Approve this week" onPress={onApprove} />
      </View>

      {swapDayIndex !== null ? (
        <Pressable
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            justifyContent: 'flex-end',
          }}
          onPress={() => setSwapDayIndex(null)}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: theme.colors.card,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              padding: theme.spacing.xl,
              paddingBottom: theme.spacing.xl + insets.bottom,
              maxHeight: '70%',
            }}
          >
            <Text variant="title3" style={{ marginBottom: theme.spacing.md }}>
              Swap in…
            </Text>
            {candidates.length === 0 ? (
              <Text variant="body" color="secondary">
                Nothing else fits your filters for this day right now.
              </Text>
            ) : (
              <ScrollView>
                {candidates.map((r, i) => (
                  <Pressable
                    key={r.id}
                    onPress={() => {
                      swapMealTo(swapDayIndex, r.id);
                      setSwapDayIndex(null);
                    }}
                    style={{
                      paddingVertical: theme.spacing.md,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: theme.colors.separator,
                    }}
                  >
                    <Text variant="body">{r.name}</Text>
                    <Text variant="footnote" color="tertiary">
                      {r.cuisine} · {r.primaryProtein} · {r.prepMinutes + r.cookMinutes}m
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <Pressable
              onPress={() => setSwapDayIndex(null)}
              style={{ marginTop: theme.spacing.md, alignItems: 'center' }}
            >
              <Text variant="body" color="secondary">
                Cancel
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}
