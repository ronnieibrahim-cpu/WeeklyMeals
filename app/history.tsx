import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { getRecipe } from '@/data/seed/recipes';
import { WeeklyPlan } from '@/domain/models';
import { useLearningStore } from '@/stores/learningStore';
import { usePlanStore } from '@/stores/planStore';
import { Card, EmptyState, RecipeImage, Screen, Text } from '@/ui/components';
import { useTheme } from '@/ui/theme/useTheme';

/** Past weeks, newest first — what you ate and how you rated it. */
export default function HistoryScreen() {
  const router = useRouter();
  const theme = useTheme();
  const history = usePlanStore((s) => s.history);
  const ratings = useLearningStore((s) => s.ratings);

  const header = (
    <Pressable
      accessibilityLabel="Back"
      hitSlop={8}
      onPress={() => router.back()}
      style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.md }}
    >
      <Ionicons name="chevron-back" size={26} color={theme.colors.accent} />
      <Text variant="body" color="accent">
        Back
      </Text>
    </Pressable>
  );

  if (history.length === 0) {
    return (
      <Screen title="Meal History">
        {header}
        <EmptyState
          emoji="📜"
          title="No past weeks yet"
          body="When you plan a new week, the finished one lands here — so favorites are easy to find again and repeats stay spaced out."
        />
      </Screen>
    );
  }

  const weekLabel = (plan: WeeklyPlan) => {
    const start = new Date(plan.weekStartISO);
    const end = new Date(start);
    end.setDate(end.getDate() + Math.max(0, plan.meals.length - 1));
    const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${fmt(start)} – ${fmt(end)}`;
  };

  return (
    <Screen title="Meal History" subtitle={`${history.length} past week${history.length === 1 ? '' : 's'}`}>
      {header}
      {history.map((plan) => {
        const meals = [...plan.meals].sort((a, b) => a.dayIndex - b.dayIndex);
        const cooked = meals.filter((m) => m.cooked).length;
        return (
          <View key={plan.id} style={{ marginBottom: theme.spacing.lg }}>
            <Text
              variant="footnote"
              color="secondary"
              style={{ marginBottom: theme.spacing.sm, marginLeft: theme.spacing.xs }}
            >
              {weekLabel(plan).toUpperCase()} · {cooked}/{meals.length} COOKED
            </Text>
            <Card padded={false}>
              {meals.map((meal, i) => {
                const recipe = getRecipe(meal.recipeId);
                if (!recipe) return null;
                const rating = ratings.find(
                  (r) => r.planId === plan.id && r.recipeId === meal.recipeId,
                )?.enjoyment;
                return (
                  <Pressable
                    key={`${meal.dayIndex}-${meal.recipeId}`}
                    onPress={() =>
                      router.push({ pathname: '/meal/[id]', params: { id: recipe.id } })
                    }
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: theme.spacing.md,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: theme.colors.separator,
                    }}
                  >
                    <RecipeImage
                      recipe={recipe}
                      width={40}
                      height={40}
                      emojiSize={20}
                      radius={theme.radius.sm}
                    />
                    <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                      <Text variant="body" numberOfLines={1}>
                        {recipe.name}
                      </Text>
                      <Text variant="footnote" color="tertiary">
                        {recipe.cuisine}
                        {meal.cooked ? ' · cooked' : ' · skipped'}
                      </Text>
                    </View>
                    {rating ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        <Ionicons name="star" size={14} color={theme.colors.star} />
                        <Text variant="subhead" color="secondary">
                          {rating}
                        </Text>
                      </View>
                    ) : null}
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={theme.colors.textTertiary}
                      style={{ marginLeft: theme.spacing.sm }}
                    />
                  </Pressable>
                );
              })}
            </Card>
          </View>
        );
      })}
    </Screen>
  );
}
