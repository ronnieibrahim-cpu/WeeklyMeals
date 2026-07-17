import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePlanStore } from '@/stores/planStore';
import { useRecipesById } from '@/stores/userRecipesStore';
import { Card, PrimaryButton, RecipeImage, SecondaryButton, Text } from '@/ui/components';
import { useTheme } from '@/ui/theme/useTheme';

export default function RerollScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { dayIndex: dayIndexParam } = useLocalSearchParams<{ dayIndex: string }>();
  const dayIndex = Number(dayIndexParam);

  const plan = usePlanStore((s) => s.plan);
  const previewReroll = usePlanStore((s) => s.previewReroll);
  const rerollMeal = usePlanStore((s) => s.rerollMeal);

  const recipesById = useRecipesById();
  const outgoingMeal = plan?.meals.find((m) => m.dayIndex === dayIndex);
  const outgoingRecipe = outgoingMeal ? recipesById[outgoingMeal.recipeId] : undefined;
  const outcome = useMemo(() => previewReroll(dayIndex), [dayIndex, previewReroll]);
  const [index, setIndex] = useState(0);

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

  const commit = (recipeId: string) => {
    rerollMeal(dayIndex, recipeId);
    router.back();
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

        {candidates.length > 0 ? (
          (() => {
            const candidate = candidates[index % candidates.length];
            return (
              <>
                <Card>
                  <View style={{ marginBottom: theme.spacing.md }}>
                    <RecipeImage recipe={candidate} height={140} radius={theme.radius.lg} />
                  </View>
                  <Text variant="title3">{candidate.name}</Text>
                  <Text variant="subhead" color="secondary" style={{ marginTop: 2 }}>
                    {candidate.cuisine} · {candidate.difficulty} · {candidate.prepMinutes + candidate.cookMinutes}m
                  </Text>
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
                  onPress={() => commit(candidate.id)}
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
            {nearMisses.map(({ recipe, missing }) => (
              <Card
                key={recipe.id}
                onPress={() => commit(recipe.id)}
                style={{ marginBottom: theme.spacing.md }}
              >
                <Text variant="headline">{recipe.name}</Text>
                <Text variant="subhead" color="secondary" style={{ marginTop: 2 }}>
                  {recipe.cuisine} · {recipe.difficulty}
                </Text>
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
