import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { Recipe } from '@/domain/models';
import { useTheme } from '@/ui/theme/useTheme';

import { Card } from './Card';
import { RecipeImage } from './RecipeImage';
import { Text } from './Text';

interface Props {
  recipe: Recipe;
  dayLabel?: string;
  badge?: string;
  locked?: boolean;
  cooked?: boolean;
  onPress?: () => void;
  onToggleLock?: () => void;
  onSwap?: () => void;
  onToggleCooked?: () => void;
}

/** Compact meal card used on This Week and the Review screen. */
export function MealCard({
  recipe,
  dayLabel,
  badge,
  locked,
  cooked,
  onPress,
  onToggleLock,
  onSwap,
  onToggleCooked,
}: Props) {
  const theme = useTheme();
  const showActions = !!(onToggleLock || onSwap);

  return (
    <Card onPress={onPress} padded={false} style={{ marginBottom: theme.spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md }}>
        <View style={{ marginRight: theme.spacing.md }}>
          <RecipeImage recipe={recipe} width={52} height={52} emojiSize={26} radius={theme.radius.md} />
        </View>

        <View style={{ flex: 1 }}>
          {dayLabel ? (
            <Text variant="caption" color="tertiary" style={{ marginBottom: 1 }}>
              {dayLabel.toUpperCase()}
            </Text>
          ) : null}
          <Text variant="headline" numberOfLines={1}>
            {recipe.name}
          </Text>
          <Text variant="footnote" color="secondary" style={{ marginTop: 2 }}>
            {recipe.cuisine} · {recipe.difficulty} · {recipe.prepMinutes + recipe.cookMinutes}m
          </Text>
          <Text variant="footnote" color="tertiary" style={{ marginTop: 1 }}>
            {recipe.nutrition.calories} cal · {recipe.nutrition.protein}g protein
            {badge ? `  ·  ${badge}` : ''}
          </Text>
        </View>

        {onToggleCooked ? (
          <Pressable
            accessibilityLabel={cooked ? 'Mark not cooked' : 'Mark cooked'}
            hitSlop={8}
            onPress={onToggleCooked}
            style={{ marginLeft: theme.spacing.sm }}
          >
            <Ionicons
              name={cooked ? 'checkmark-circle' : 'ellipse-outline'}
              size={26}
              color={cooked ? theme.colors.success : theme.colors.textTertiary}
            />
          </Pressable>
        ) : showActions ? (
          <View style={{ gap: theme.spacing.md, marginLeft: theme.spacing.sm }}>
            {onToggleLock ? (
              <Pressable accessibilityLabel={locked ? 'Unlock' : 'Lock'} hitSlop={6} onPress={onToggleLock}>
                <Ionicons
                  name={locked ? 'lock-closed' : 'lock-open-outline'}
                  size={22}
                  color={locked ? theme.colors.accent : theme.colors.textTertiary}
                />
              </Pressable>
            ) : null}
            {onSwap ? (
              <Pressable accessibilityLabel="Swap" hitSlop={6} onPress={onSwap}>
                <Ionicons name="swap-horizontal" size={22} color={theme.colors.textTertiary} />
              </Pressable>
            ) : null}
          </View>
        ) : onPress ? (
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
        ) : null}
      </View>
    </Card>
  );
}
