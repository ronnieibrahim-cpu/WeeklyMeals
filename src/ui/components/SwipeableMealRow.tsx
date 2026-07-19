import { Ionicons } from '@expo/vector-icons';
import { ReactNode, useRef } from 'react';
import { Pressable } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import { useTheme } from '@/ui/theme/useTheme';

import { Text } from './Text';

interface Props {
  /** Whether the swipe action should be offered at all. False for a cooked
   * meal ("a cooked day is history") or when there's no not-yet-cooked day
   * left to move it onto — the caller computes this with
   * `eligibleMoveTargets` (`src/engine/rearrange.ts`) so this component
   * never has to guess. When false, `children` render with no gesture
   * wrapper at all (Product Law #3: never offer an action that opens an
   * empty picker). */
  enabled: boolean;
  onMoveTo: () => void;
  children: ReactNode;
}

/**
 * M4.6 part 2: swipe-to-reveal "Move to…" action on an approved-plan meal
 * card (This Week, Schedule). Deliberately mirrors
 * `app/(tabs)/shopping.tsx`'s `ManualRowView` swipe-to-delete idiom as
 * closely as possible — same `Swipeable` from `react-native-gesture-handler`
 * (already a dependency, already mounted app-wide via `GestureHandlerRootView`
 * in `app/_layout.tsx`), same `overshootRight={false}`, same
 * close-then-fire-callback sequencing on the action press. That component is
 * the app's one proven cross-platform swipe gesture (touch AND mouse-drag on
 * the web build this app actually ships as), so this reuses it rather than
 * inventing a second gesture handler.
 *
 * A small component, not a screen: screens stay thin and pass in the
 * `MealCard` (or anything else) as `children`.
 */
export function SwipeableMealRow({ enabled, onMoveTo, children }: Props) {
  const theme = useTheme();
  const swipeableRef = useRef<Swipeable>(null);

  if (!enabled) return <>{children}</>;

  return (
    <Swipeable
      ref={swipeableRef}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Move to another day"
          onPress={() => {
            swipeableRef.current?.close();
            onMoveTo();
          }}
          style={{
            width: 84,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.accent,
            borderRadius: theme.radius.xl,
            // Matches MealCard's own marginBottom so the accent panel lines
            // up with the visible card and doesn't bleed into the gap below it.
            marginBottom: theme.spacing.md,
          }}
        >
          <Ionicons name="calendar-outline" size={22} color={theme.colors.onAccent} />
          <Text variant="footnote" color="onAccent" style={{ marginTop: 2 }}>
            Move to…
          </Text>
        </Pressable>
      )}
    >
      {children}
    </Swipeable>
  );
}
