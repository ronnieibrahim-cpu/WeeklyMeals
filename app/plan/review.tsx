import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { roughCostPerServing } from '@/engine/cost';
import { usePlanStore } from '@/stores/planStore';
import { Card, MealCard, PrimaryButton, SecondaryButton, Text } from '@/ui/components';
import { useTheme } from '@/ui/theme/useTheme';

export default function ReviewPlanScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const plan = usePlanStore((s) => s.plan);
  const recipeFor = usePlanStore((s) => s.recipeFor);
  const regenerate = usePlanStore((s) => s.regenerate);
  const toggleLock = usePlanStore((s) => s.toggleLock);
  const swapMeal = usePlanStore((s) => s.swapMeal);
  const approve = usePlanStore((s) => s.approve);

  const close = () => router.dismissAll();

  if (!plan) {
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

  const meals = [...plan.meals].sort((a, b) => a.dayIndex - b.dayIndex);
  const totalCost = meals.reduce((sum, m) => {
    const r = recipeFor(m);
    return r ? sum + roughCostPerServing(r) * m.servings : sum;
  }, 0);
  const totalServings = meals.reduce((s, m) => s + m.servings, 0);
  const perServing = totalServings ? totalCost / totalServings : 0;
  const shortfall = plan.intake.dinners - meals.length;

  const onApprove = () => {
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
              tight combinations will fill all {plan.intake.dinners}.
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
              onSwap={() => swapMeal(meal.dayIndex)}
            />
          );
        })}

        <SecondaryButton
          title="↻  Regenerate unlocked"
          onPress={regenerate}
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
    </SafeAreaView>
  );
}
