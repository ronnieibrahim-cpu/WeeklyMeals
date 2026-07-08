import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { Recipe } from '@/domain/models';
import { isUserRecipe } from '@/engine/userRecipes';
import { useTheme } from '@/ui/theme/useTheme';

import { Card } from './Card';
import { RecipeImage } from './RecipeImage';
import { Text } from './Text';

interface Props {
  recipe: Recipe;
  favorite: boolean;
  onToggleFavorite: () => void;
  onPress: () => void;
  /**
   * Presence shows a "📌 Pin" quick-action on the card itself — a shortcut
   * straight to the day picker without opening the detail screen first
   * (M3.1, to keep favorite → pinned within a few taps). It's a shortcut to
   * the day picker, not a shortcut past it: the missing-ingredients confirm
   * still applies exactly as it would from the detail screen.
   */
  onQuickPin?: () => void;
  /** M3.2 "Kids approved" badge. */
  kidApproved: boolean;
  onToggleKidApproved: () => void;
}

/** Result card for the Recipes tab (search results and the Favorites section). */
export function RecipeResultCard({
  recipe,
  favorite,
  onToggleFavorite,
  onPress,
  onQuickPin,
  kidApproved,
  onToggleKidApproved,
}: Props) {
  const theme = useTheme();

  return (
    <Card onPress={onPress} padded={false} style={{ marginBottom: theme.spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md }}>
        <View style={{ marginRight: theme.spacing.md }}>
          <RecipeImage recipe={recipe} width={56} height={56} emojiSize={28} radius={theme.radius.md} />
        </View>

        <View style={{ flex: 1 }}>
          <Text variant="headline" numberOfLines={1}>
            {recipe.name}
          </Text>
          <Text variant="footnote" color="secondary" style={{ marginTop: 2 }}>
            {recipe.cuisine} · {recipe.difficulty} · {recipe.prepMinutes + recipe.cookMinutes}m
          </Text>
          {recipe.estimated ? (
            <Text variant="caption" color="tertiary" style={{ marginTop: 1 }}>
              ⚠️ Allergen info estimated
            </Text>
          ) : null}
          {isUserRecipe(recipe.id) ? (
            <Text variant="caption" color="tertiary" style={{ marginTop: 1 }}>
              🏠 Your recipe
            </Text>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, marginLeft: theme.spacing.sm }}>
          {onQuickPin ? (
            <Pressable accessibilityLabel="Pin to this week" hitSlop={8} onPress={onQuickPin}>
              <Ionicons name="pin-outline" size={22} color={theme.colors.accent} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityLabel={kidApproved ? 'Remove Kids approved' : 'Mark Kids approved'}
            hitSlop={8}
            onPress={onToggleKidApproved}
          >
            <Ionicons
              name={kidApproved ? 'happy' : 'happy-outline'}
              size={22}
              color={kidApproved ? theme.colors.success : theme.colors.textTertiary}
            />
          </Pressable>
          <Pressable
            accessibilityLabel={favorite ? 'Remove favorite' : 'Add favorite'}
            hitSlop={8}
            onPress={onToggleFavorite}
          >
            <Ionicons
              name={favorite ? 'heart' : 'heart-outline'}
              size={22}
              color={favorite ? theme.colors.danger : theme.colors.textTertiary}
            />
          </Pressable>
        </View>
      </View>
    </Card>
  );
}
