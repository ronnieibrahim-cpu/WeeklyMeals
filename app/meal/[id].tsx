import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { getRecipe } from '@/data/seed/recipes';
import { useLearningStore } from '@/stores/learningStore';
import { usePlanStore } from '@/stores/planStore';
import { Card, EmptyState, Screen, SecondaryButton, Text } from '@/ui/components';
import { useTheme } from '@/ui/theme/useTheme';

export default function MealDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipe = id ? getRecipe(id) : undefined;
  const favorites = useLearningStore((s) => s.favorites);
  const toggleFavorite = useLearningStore((s) => s.toggleFavorite);
  const plan = usePlanStore((s) => s.plan);
  const toggleCooked = usePlanStore((s) => s.toggleCooked);

  const isFavorite = recipe ? favorites.includes(recipe.id) : false;
  const plannedMeal =
    recipe && plan?.status === 'approved'
      ? plan.meals.find((m) => m.recipeId === recipe.id)
      : undefined;

  const header = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: theme.spacing.md,
      }}
    >
      <Pressable
        accessibilityLabel="Back"
        hitSlop={8}
        onPress={() => router.back()}
        style={{ flexDirection: 'row', alignItems: 'center' }}
      >
        <Ionicons name="chevron-back" size={26} color={theme.colors.accent} />
        <Text variant="body" color="accent">
          Back
        </Text>
      </Pressable>
      {recipe ? (
        <Pressable
          accessibilityLabel={isFavorite ? 'Remove favorite' : 'Add favorite'}
          hitSlop={8}
          onPress={() => toggleFavorite(recipe.id)}
        >
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={26}
            color={isFavorite ? theme.colors.danger : theme.colors.textTertiary}
          />
        </Pressable>
      ) : null}
    </View>
  );

  if (!recipe) {
    return (
      <Screen>
        {header}
        <EmptyState emoji="🍽️" title="Recipe not found" />
      </Screen>
    );
  }

  const stats: [string, string][] = [
    [`${recipe.prepMinutes}m`, 'prep'],
    [`${recipe.cookMinutes}m`, 'cook'],
    [`${recipe.nutrition.calories}`, 'cal'],
    [`${recipe.nutrition.protein}g`, 'protein'],
  ];

  return (
    <Screen>
      {header}

      <View
        style={{
          height: 120,
          borderRadius: theme.radius.xl,
          backgroundColor: theme.colors.accentMuted,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: theme.spacing.lg,
        }}
      >
        <Text style={{ fontSize: 56, lineHeight: 64 }}>🍽️</Text>
      </View>

      <Text variant="largeTitle">{recipe.name}</Text>
      <Text variant="subhead" color="secondary" style={{ marginTop: theme.spacing.xs }}>
        {recipe.cuisine} · {recipe.difficulty}
        {recipe.spiceLevel !== 'None' ? ` · ${recipe.spiceLevel} spice` : ''}
      </Text>

      <Card padded={false} style={{ marginTop: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row' }}>
          {stats.map(([value, label], i) => (
            <View
              key={label}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: theme.spacing.md,
                borderLeftWidth: i === 0 ? 0 : 1,
                borderLeftColor: theme.colors.separator,
              }}
            >
              <Text variant="headline">{value}</Text>
              <Text variant="caption" color="tertiary">
                {label}
              </Text>
            </View>
          ))}
        </View>
      </Card>
      <Text variant="footnote" color="tertiary" style={{ marginTop: theme.spacing.sm }}>
        Carbs {recipe.nutrition.carbs}g · Fat {recipe.nutrition.fat}g · per serving
      </Text>

      {plannedMeal ? (
        <SecondaryButton
          title={plannedMeal.cooked ? '✓ Cooked' : 'Mark as cooked'}
          onPress={() => toggleCooked(plannedMeal.dayIndex)}
          style={{ marginTop: theme.spacing.lg }}
        />
      ) : null}

      <Text variant="title3" style={{ marginTop: theme.spacing.xl, marginBottom: theme.spacing.sm }}>
        Ingredients
      </Text>
      <Text variant="footnote" color="tertiary" style={{ marginBottom: theme.spacing.sm }}>
        For {recipe.baseServings} servings
      </Text>
      <Card>
        {recipe.ingredients.map((ing, i) => (
          <View
            key={`${ing.name}-${i}`}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingVertical: theme.spacing.sm,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: theme.colors.separator,
            }}
          >
            <Text variant="body" style={{ flex: 1 }}>
              {ing.name}
              {ing.optional ? ' (optional)' : ''}
            </Text>
            <Text variant="body" color="secondary">
              {ing.quantity} {ing.unit}
            </Text>
          </View>
        ))}
      </Card>

      <Text variant="title3" style={{ marginTop: theme.spacing.xl, marginBottom: theme.spacing.sm }}>
        Steps
      </Text>
      {recipe.steps.map((step, i) => (
        <View key={i} style={{ flexDirection: 'row', marginBottom: theme.spacing.md }}>
          <Text variant="headline" color="accent" style={{ width: 28 }}>
            {i + 1}
          </Text>
          <Text variant="body" style={{ flex: 1 }}>
            {step}
          </Text>
        </View>
      ))}

      {recipe.leftoverNotes ? (
        <Card style={{ marginTop: theme.spacing.md }}>
          <Text variant="headline">🥡 Leftovers</Text>
          <Text variant="body" color="secondary" style={{ marginTop: theme.spacing.xs }}>
            {recipe.leftoverNotes}
          </Text>
        </Card>
      ) : null}
      {recipe.freezingNotes ? (
        <Card style={{ marginTop: theme.spacing.md }}>
          <Text variant="headline">❄️ Freezing</Text>
          <Text variant="body" color="secondary" style={{ marginTop: theme.spacing.xs }}>
            {recipe.freezingNotes}
          </Text>
        </Card>
      ) : null}
    </Screen>
  );
}
