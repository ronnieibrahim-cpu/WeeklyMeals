import { Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WeeklyPlan } from '@/domain/models';
import { eligibleMoveTargets } from '@/engine/rearrange';
import { dateForDayIndex } from '@/engine/schedule';
import { usePlanStore } from '@/stores/planStore';
import { useTheme } from '@/ui/theme/useTheme';

import { Text } from './Text';

interface Props {
  plan: WeeklyPlan;
  /** The day being moved — the meal card that was swiped. */
  fromDay: number;
  onClose: () => void;
}

/**
 * M4.6 part 2: the "Move to…" day picker. Same overlay/bottom-sheet
 * structure as `app/plan/review.tsx`'s "Swap in…" sheet (full-screen scrim
 * that closes on tap, sheet slides up from the bottom, a row's press IS the
 * confirmation — no second dialog, no Cancel-then-confirm).
 *
 * Lists every OTHER not-yet-cooked day via `eligibleMoveTargets` — the exact
 * same guard `usePlanStore.moveMeal` (and, under it, `moveMeal` in
 * `src/engine/rearrange.ts`) enforces, so this sheet can never offer a day
 * the store would reject. The caller is expected to only render this sheet
 * when that list is non-empty (Law #3), but an empty state is included here
 * too as defense in depth.
 *
 * Each row shows the real day name/date, derived exactly the way
 * `app/(tabs)/index.tsx` (This Week) derives its own day labels
 * (`dateForDayIndex` + the same `toLocaleDateString` format), plus what's
 * currently on that day —
 * since every day of an approved week is occupied, choosing one always
 * swaps two whole meal bodies (recipe, sides, servings, rating, cooked
 * flag), never just an insert.
 */
export function MoveMealSheet({ plan, fromDay, onClose }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const recipeFor = usePlanStore((s) => s.recipeFor);
  const moveMeal = usePlanStore((s) => s.moveMeal);

  const targets = eligibleMoveTargets(plan, fromDay);

  const dateLabel = (dayIndex: number) =>
    dateForDayIndex(plan.weekStartISO, dayIndex).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });

  return (
    <Pressable
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
      }}
      onPress={onClose}
    >
      <Pressable
        onPress={() => {}}
        style={{
          backgroundColor: theme.colors.card,
          borderTopLeftRadius: theme.radius.xl,
          borderTopRightRadius: theme.radius.xl,
          padding: theme.spacing.xl,
          paddingBottom: theme.spacing.xl + insets.bottom,
          maxHeight: '70%',
        }}
      >
        <Text variant="title3" style={{ marginBottom: theme.spacing.md }}>
          Move to…
        </Text>
        {targets.length === 0 ? (
          <Text variant="body" color="secondary">
            No other day is open to move this to right now.
          </Text>
        ) : (
          <ScrollView>
            {targets.map((m, i) => {
              const recipe = recipeFor(m);
              return (
                <Pressable
                  key={m.dayIndex}
                  onPress={() => {
                    moveMeal(fromDay, m.dayIndex);
                    onClose();
                  }}
                  style={{
                    paddingVertical: theme.spacing.md,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: theme.colors.separator,
                  }}
                >
                  <Text variant="body">{dateLabel(m.dayIndex)}</Text>
                  {recipe ? (
                    <Text variant="footnote" color="tertiary">
                      Swap with: {recipe.name}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        )}
        <Pressable onPress={onClose} style={{ marginTop: theme.spacing.md, alignItems: 'center' }}>
          <Text variant="body" color="secondary">
            Cancel
          </Text>
        </Pressable>
      </Pressable>
    </Pressable>
  );
}
