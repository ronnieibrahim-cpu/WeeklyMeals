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
  /** M4.2 part 2: names of this meal's composed sides/sauces, resolved by
   * the caller. Undefined/empty renders nothing extra — "no sides tonight"
   * is a normal, explicit state, not a gap in the card. */
  sideNames?: string[];
  /** M4.4: whether this recipe has a (non-empty) family note. Display only —
   * a quiet glyph next to the name, not tappable here; editing happens on
   * the recipe detail screen. */
  hasNote?: boolean;
  /** Taller hero photo for the "Tonight" card on This Week. Purely visual;
   * omit everywhere else and the card renders at standard height. */
  featured?: boolean;
}

/** Photo-forward meal card: full-width recipe photo on top, details beneath.
 * Used on This Week (stacked in day order) and the Review screen. */
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
  sideNames,
  hasNote,
  featured,
}: Props) {
  const theme = useTheme();
  const showActions = !!(onToggleLock || onSwap);
  const photoHeight = featured ? 200 : 150;
  const totalMinutes = recipe.prepMinutes + recipe.cookMinutes;

  return (
    <Card onPress={onPress} padded={false} style={{ marginBottom: theme.spacing.md, overflow: 'hidden' }}>
      {/* PHOTO with overlays */}
      <View style={{ width: '100%', height: photoHeight }}>
        <RecipeImage recipe={recipe} width="100%" height={photoHeight} emojiSize={featured ? 52 : 40} radius={0} />

        {/* day label pill, top-left */}
        {dayLabel ? (
          <View
            style={{
              position: 'absolute',
              top: theme.spacing.md,
              left: theme.spacing.md,
              backgroundColor: featured ? theme.colors.accent : 'rgba(20,23,20,0.55)',
              borderRadius: theme.radius.pill,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <Text variant="caption" color="onAccent" style={{ fontWeight: '700', letterSpacing: 0.5 }}>
              {dayLabel.toUpperCase()}
            </Text>
          </View>
        ) : null}

        {/* time · cal chip, bottom-left */}
        <View
          style={{
            position: 'absolute',
            bottom: theme.spacing.md,
            left: theme.spacing.md,
            backgroundColor: 'rgba(20,23,20,0.55)',
            borderRadius: theme.radius.pill,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <Text variant="caption" color="onAccent" style={{ fontWeight: '600' }}>
            {totalMinutes}m · {recipe.nutrition.calories} cal
          </Text>
        </View>

        {/* cooked toggle disc, top-right (This Week/Schedule) */}
        {onToggleCooked ? (
          <Pressable
            accessibilityLabel={cooked ? 'Mark not cooked' : 'Mark cooked'}
            hitSlop={8}
            onPress={onToggleCooked}
            style={{
              position: 'absolute',
              top: theme.spacing.md,
              right: theme.spacing.md,
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: cooked ? theme.colors.accent : 'rgba(255,255,255,0.92)',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOpacity: 0.18,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 1 },
              elevation: 2,
            }}
          >
            <Ionicons
              name={cooked ? 'checkmark' : 'ellipse-outline'}
              size={cooked ? 20 : 22}
              color={cooked ? theme.colors.onAccent : theme.colors.textTertiary}
            />
          </Pressable>
        ) : showActions ? (
          // Review screen: lock/swap as floating discs, top-right
          <View style={{ position: 'absolute', top: theme.spacing.md, right: theme.spacing.md, flexDirection: 'row', gap: theme.spacing.sm }}>
            {onToggleLock ? (
              <Pressable
                accessibilityLabel={locked ? 'Unlock' : 'Lock'}
                hitSlop={6}
                onPress={onToggleLock}
                style={discStyle(theme)}
              >
                <Ionicons
                  name={locked ? 'lock-closed' : 'lock-open-outline'}
                  size={18}
                  color={locked ? theme.colors.accent : theme.colors.textSecondary}
                />
              </Pressable>
            ) : null}
            {onSwap ? (
              <Pressable accessibilityLabel="Swap" hitSlop={6} onPress={onSwap} style={discStyle(theme)}>
                <Ionicons name="swap-horizontal" size={18} color={theme.colors.textSecondary} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* CONTENT */}
      <View style={{ padding: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text variant="title3" numberOfLines={2} style={{ flex: 1 }}>
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
                size={20}
                color={kidApproved ? theme.colors.success : theme.colors.textTertiary}
              />
            </Pressable>
          ) : null}
          {hasNote ? (
            <Ionicons accessibilityLabel="Has a family note" name="document-text-outline" size={16} color={theme.colors.textTertiary} />
          ) : null}
        </View>

        <Text variant="footnote" color="secondary" style={{ marginTop: 3 }}>
          {recipe.cuisine} · {recipe.difficulty}
          {badge ? `  ·  ${badge}` : ''}
        </Text>

        {sideNames && sideNames.length > 0 ? (
          <Text variant="footnote" color="secondary" numberOfLines={1} style={{ marginTop: 1 }}>
            + {sideNames.join(', ')}
          </Text>
        ) : null}

        {onRate ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing.sm }}>
            <StarRating value={rating ?? 0} onChange={(v) => onRate(v as 1 | 2 | 3 | 4 | 5)} size={18} />
            {onReroll ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Re-roll this meal"
                hitSlop={6}
                onPress={onReroll}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
              >
                <Ionicons name="refresh" size={15} color={theme.colors.accent} />
                <Text variant="footnote" color="accent">Re-roll</Text>
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
              <Text variant="caption" color="accent">Cook extra for lunches (+2)</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function discStyle(theme: ReturnType<typeof useTheme>) {
  return {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  };
}
