import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { Recipe } from '@/domain/models';
import { formatServings } from '@/engine/portions';
import { useTheme } from '@/ui/theme/useTheme';

import { Card } from './Card';
import { RecipeImage } from './RecipeImage';
import { StarRating } from './StarRating';
import { Stepper } from './Stepper';
import { Text } from './Text';

interface Props {
  recipe: Recipe;
  dayLabel?: string;
  badge?: string;
  locked?: boolean;
  cooked?: boolean;
  /** Current star rating (1-5), if this meal has one. */
  rating?: number;
  /** Presence enables the star row (This Week / Schedule); omit elsewhere (e.g. draft review). */
  onRate?: (rating: 1 | 2 | 3 | 4 | 5) => void;
  /** Presence shows a "Re-roll" action (This Week, today/future + not-yet-cooked meals only, M2.2). */
  onReroll?: () => void;
  onPress?: () => void;
  onToggleLock?: () => void;
  onSwap?: () => void;
  onToggleCooked?: () => void;
  /** M3.2: whether this recipe is marked "Kids approved". Presence of
   * `onToggleKidApproved` shows a tappable badge next to the dish name. */
  kidApproved?: boolean;
  onToggleKidApproved?: () => void;
  /** M4.1: this meal's current planned servings. Presence of
   * `onServingsChange` shows a −/+ stepper (0.5 steps) plus a one-tap "Cook
   * extra for lunches (+2)" shortcut. Whether that change needs a follow-up
   * shopping-list confirmation is entirely the caller's concern (draft vs.
   * approved) — this card only reports the new value. */
  servings?: number;
  onServingsChange?: (servings: number) => void;
}

/** Compact meal card used on This Week and the Review screen. */
export function MealCard({
  recipe,
  dayLabel,
  badge,
  locked,
  cooked,
  rating,
  onRate,
  onReroll,
  onPress,
  onToggleLock,
  onSwap,
  onToggleCooked,
  kidApproved,
  onToggleKidApproved,
  servings,
  onServingsChange,
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text variant="headline" numberOfLines={1} style={{ flex: 1 }}>
              {recipe.name}
            </Text>
            {onToggleKidApproved ? (
              <Pressable
                accessibilityLabel={kidApproved ? 'Remove Kids approved' : 'Mark Kids approved'}
                hitSlop={6}
                onPress={onToggleKidApproved}
              >
                <Ionicons
                  name={kidApproved ? 'happy' : 'happy-outline'}
                  size={18}
                  color={kidApproved ? theme.colors.success : theme.colors.textTertiary}
                />
              </Pressable>
            ) : null}
          </View>
          <Text variant="footnote" color="secondary" style={{ marginTop: 2 }}>
            {recipe.cuisine} · {recipe.difficulty} · {recipe.prepMinutes + recipe.cookMinutes}m
          </Text>
          <Text variant="footnote" color="tertiary" style={{ marginTop: 1 }}>
            {recipe.nutrition.calories} cal · {recipe.nutrition.protein}g protein
            {badge ? `  ·  ${badge}` : ''}
          </Text>
          {onRate ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 4,
              }}
            >
              <StarRating value={rating ?? 0} onChange={(v) => onRate(v as 1 | 2 | 3 | 4 | 5)} size={16} />
              {onReroll ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Re-roll this meal"
                  hitSlop={6}
                  onPress={onReroll}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
                >
                  <Ionicons name="refresh" size={14} color={theme.colors.accent} />
                  <Text variant="caption" color="accent">
                    Re-roll
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {onServingsChange && servings !== undefined ? (
            <View style={{ marginTop: theme.spacing.sm, gap: 4 }}>
              <Stepper value={servings} min={1} step={0.5} format={formatServings} onChange={onServingsChange} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cook extra for lunches"
                hitSlop={6}
                onPress={() => onServingsChange(servings + 2)}
                style={{ alignSelf: 'flex-start' }}
              >
                <Text variant="caption" color="accent">
                  Cook extra for lunches (+2)
                </Text>
              </Pressable>
            </View>
          ) : null}
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
