import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { UserRecipeInput } from '@/engine/userRecipes';
import { useUserRecipesStore } from '@/stores/userRecipesStore';
import { RecipeForm, Text } from '@/ui/components';
import { useTheme } from '@/ui/theme/useTheme';

export default function NewRecipeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const addRecipe = useUserRecipesStore((s) => s.addRecipe);

  const close = () => router.back();

  const handleSubmit = (input: UserRecipeInput) => {
    const id = addRecipe(input);
    router.replace({ pathname: '/meal/[id]', params: { id } });
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
        <Text variant="headline">Add a family recipe</Text>
        <Pressable accessibilityLabel="Close" accessibilityRole="button" hitSlop={8} onPress={close}>
          <Ionicons name="close" size={26} color={theme.colors.text} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.xl, paddingTop: 0 }} showsVerticalScrollIndicator={false}>
        <Text variant="footnote" color="tertiary" style={{ marginBottom: theme.spacing.md }}>
          🏠 Saved on this device only — not shared between phones yet.
        </Text>
        <RecipeForm submitLabel="Save recipe" onSubmit={handleSubmit} />
      </ScrollView>
    </SafeAreaView>
  );
}
