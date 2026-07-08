import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isUserRecipe, UserRecipeInput } from '@/engine/userRecipes';
import { useUserRecipesStore } from '@/stores/userRecipesStore';
import { RecipeForm, SecondaryButton, Text } from '@/ui/components';
import { useTheme } from '@/ui/theme/useTheme';

export default function EditRecipeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipe = useUserRecipesStore((s) => (id ? s.recipesMap[id] : undefined));
  const updateRecipe = useUserRecipesStore((s) => s.updateRecipe);
  const deleteRecipe = useUserRecipesStore((s) => s.deleteRecipe);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const close = () => router.back();

  if (!id || !isUserRecipe(id) || !recipe) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'left', 'right']}>
        <View style={{ padding: theme.spacing.xl }}>
          <Text variant="body" color="secondary">
            Couldn't find that recipe to edit.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const initial: UserRecipeInput = {
    name: recipe.name,
    cuisine: recipe.cuisine,
    primaryProtein: recipe.primaryProtein,
    baseServings: recipe.baseServings,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    description: recipe.description,
    tips: recipe.tips,
    allergens: recipe.allergens,
  };

  const handleSubmit = (input: UserRecipeInput) => {
    updateRecipe(recipe.id, input);
    router.back();
  };

  const handleDelete = () => {
    deleteRecipe(recipe.id);
    // Closes this modal back to the meal detail screen underneath, which
    // gracefully shows "Recipe not found" for the now-deleted recipe — same
    // fallback it already shows for any bad/missing id.
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'left', 'right']}>
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
        <Text variant="headline">Edit recipe</Text>
        <Pressable accessibilityLabel="Close" accessibilityRole="button" hitSlop={8} onPress={close}>
          <Ionicons name="close" size={26} color={theme.colors.text} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.xl, paddingTop: 0 }} showsVerticalScrollIndicator={false}>
        <RecipeForm initial={initial} submitLabel="Save changes" onSubmit={handleSubmit} />

        <View style={{ marginTop: theme.spacing.xl }}>
          {confirmingDelete ? (
            <>
              <Text variant="body" color="secondary" style={{ marginBottom: theme.spacing.md }}>
                Delete {recipe.name} for good? This can't be undone.
              </Text>
              <SecondaryButton title="Yes, delete this recipe" onPress={handleDelete} />
              <Pressable onPress={() => setConfirmingDelete(false)} style={{ marginTop: theme.spacing.md, alignSelf: 'center' }}>
                <Text variant="footnote" color="secondary">
                  Cancel
                </Text>
              </Pressable>
            </>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => setConfirmingDelete(true)} style={{ alignSelf: 'center' }}>
              <Text variant="footnote" color="danger">
                Delete recipe
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
