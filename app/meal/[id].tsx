import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Pressable, View } from 'react-native';

import { RECIPE_IMAGE_ATTRIBUTION } from '@/data/recipeImages';
import { getRecipe } from '@/data/seed/recipes';
import { useLearningStore } from '@/stores/learningStore';
import { usePlanStore } from '@/stores/planStore';
import { Card, EmptyState, PrimaryButton, RecipeImage, Screen, SecondaryButton, StarRating, Text } from '@/ui/components';
import { useTheme } from '@/ui/theme/useTheme';

export default function MealDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { id, pinTarget: pinTargetParam } = useLocalSearchParams<{ id: string; pinTarget?: string }>();
  const pinTarget = pinTargetParam === 'draft' ? 'draft' : 'plan';
  const recipe = id ? getRecipe(id) : undefined;
  const favorites = useLearningStore((s) => s.favorites);
  const toggleFavorite = useLearningStore((s) => s.toggleFavorite);
  const kidApproved = useLearningStore((s) => s.kidApproved);
  const toggleKidApproved = useLearningStore((s) => s.toggleKidApproved);
  const plan = usePlanStore((s) => s.plan);
  const draftPlan = usePlanStore((s) => s.draftPlan);
  const toggleCooked = usePlanStore((s) => s.toggleCooked);
  const rateMeal = usePlanStore((s) => s.rateMeal);
  const canPin = !!(pinTarget === 'draft' ? draftPlan : plan);

  const photoAttribution = recipe ? RECIPE_IMAGE_ATTRIBUTION[recipe.id] : undefined;
  const isFavorite = recipe ? favorites.includes(recipe.id) : false;
  const isKidApproved = recipe ? kidApproved.includes(recipe.id) : false;
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.lg }}>
          <Pressable
            accessibilityLabel={isKidApproved ? 'Remove Kids approved' : 'Mark Kids approved'}
            hitSlop={8}
            onPress={() => toggleKidApproved(recipe.id)}
          >
            <Ionicons
              name={isKidApproved ? 'happy' : 'happy-outline'}
              size={26}
              color={isKidApproved ? theme.colors.success : theme.colors.textTertiary}
            />
          </Pressable>
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
        </View>
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

      <View style={{ marginBottom: theme.spacing.lg }}>
        <RecipeImage recipe={recipe} height={180} emojiSize={64} radius={theme.radius.xl} />
        {photoAttribution ? (
          <Pressable
            disabled={!photoAttribution.attributionUrl}
            onPress={() => photoAttribution.attributionUrl && Linking.openURL(photoAttribution.attributionUrl)}
          >
            <Text
              variant="caption"
              color="tertiary"
              style={{ marginTop: theme.spacing.xs }}
            >
              Photo: {photoAttribution.attribution}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Text variant="largeTitle">{recipe.name}</Text>
      <Text variant="subhead" color="secondary" style={{ marginTop: theme.spacing.xs }}>
        {recipe.cuisine} · {recipe.difficulty}
        {recipe.spiceLevel !== 'None' ? ` · ${recipe.spiceLevel} spice` : ''}
      </Text>
      {isKidApproved ? (
        <Text variant="footnote" color="success" style={{ marginTop: theme.spacing.xs }}>
          😊 Kids approved
        </Text>
      ) : null}
      {recipe.description ? (
        <Text variant="body" color="secondary" style={{ marginTop: theme.spacing.md }}>
          {recipe.description}
        </Text>
      ) : null}

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
        <PrimaryButton
          title="🍳 Start cooking"
          onPress={() => router.push({ pathname: '/cook/[dayIndex]', params: { dayIndex: String(plannedMeal.dayIndex) } })}
          style={{ marginTop: theme.spacing.lg }}
        />
      ) : null}

      {plannedMeal ? (
        <SecondaryButton
          title={plannedMeal.cooked ? '✓ Cooked' : 'Mark as cooked'}
          onPress={() => toggleCooked(plannedMeal.dayIndex)}
          style={{ marginTop: theme.spacing.md }}
        />
      ) : null}

      {canPin ? (
        <PrimaryButton
          title={pinTarget === 'draft' ? 'Pin to this draft' : 'Pin to this week'}
          onPress={() => router.push({ pathname: '/pin/[recipeId]', params: { recipeId: recipe.id, target: pinTarget } })}
          style={{ marginTop: theme.spacing.lg }}
        />
      ) : null}

      {plannedMeal ? (
        <Card style={{ marginTop: theme.spacing.lg }}>
          <Text variant="headline">How was it?</Text>
          <View style={{ marginTop: theme.spacing.sm }}>
            <StarRating
              value={plannedMeal.rating ?? 0}
              onChange={(rating) => rateMeal(plannedMeal.dayIndex, rating as 1 | 2 | 3 | 4 | 5)}
            />
          </View>
        </Card>
      ) : null}

      <Text variant="title3" style={{ marginTop: theme.spacing.xl, marginBottom: theme.spacing.sm }}>
        Ingredients
      </Text>
      <Text variant="footnote" color="tertiary" style={{ marginBottom: theme.spacing.sm }}>
        For {recipe.baseServings} servings
      </Text>
      {recipe.estimated ? (
        <Text variant="footnote" color="tertiary" style={{ marginBottom: theme.spacing.sm }}>
          ⚠️ Imported recipe — allergen info estimated, check labels.
        </Text>
      ) : null}
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

      {recipe.tips && recipe.tips.length > 0 ? (
        <Card style={{ marginTop: theme.spacing.md }}>
          <Text variant="headline">💡 Tips</Text>
          {recipe.tips.map((tip, i) => (
            <Text
              key={i}
              variant="body"
              color="secondary"
              style={{ marginTop: i === 0 ? theme.spacing.xs : theme.spacing.sm }}
            >
              {tip}
            </Text>
          ))}
        </Card>
      ) : null}

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

      {recipe.sourceName ? (
        <View style={{ marginTop: theme.spacing.lg }}>
          {recipe.estimated ? (
            <Text variant="footnote" color="tertiary" style={{ marginBottom: 2 }}>
              Times and nutrition are estimated.
            </Text>
          ) : null}
          <Pressable
            disabled={!recipe.sourceUrl}
            onPress={() => recipe.sourceUrl && Linking.openURL(recipe.sourceUrl)}
          >
            <Text variant="footnote" color={recipe.sourceUrl ? 'accent' : 'tertiary'}>
              Recipe from {recipe.sourceName}
              {recipe.origin ? ` · ${recipe.origin}` : ''}
              {recipe.sourceUrl ? ' ↗' : ''}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}
