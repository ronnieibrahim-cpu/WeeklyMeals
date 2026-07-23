import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Pressable, View, ViewStyle } from 'react-native';

import { useTheme } from '@/ui/theme/useTheme';

import { Text } from './Text';

interface Props {
  title?: string;
  onBack?: () => void;
  onClose?: () => void;
  /** Override the leading action's accessibilityLabel when it isn't a plain "Back"/"Close" (e.g. "Exit cook mode"). */
  backAccessibilityLabel?: string;
  closeAccessibilityLabel?: string;
  trailing?: ReactNode;
  style?: ViewStyle;
}

/**
 * Shared back/close bar: a leading chevron-back or close action, an optional
 * centered title, and an optional trailing slot. Replaces each screen's
 * previously bespoke header row (Phase 3 chrome unification). Callers using
 * `Screen` (which already applies horizontal padding) should override this
 * component's own horizontal padding via `style` to avoid doubling it.
 */
export function NavHeader({
  title,
  onBack,
  onClose,
  backAccessibilityLabel = 'Back',
  closeAccessibilityLabel = 'Close',
  trailing,
  style,
}: Props) {
  const theme = useTheme();

  const leading = onBack ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={backAccessibilityLabel}
      hitSlop={8}
      onPress={onBack}
    >
      <Ionicons name="chevron-back" size={26} color={theme.colors.accent} />
    </Pressable>
  ) : onClose ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={closeAccessibilityLabel}
      hitSlop={8}
      onPress={onClose}
    >
      <Ionicons name="close" size={26} color={theme.colors.text} />
    </Pressable>
  ) : null;

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: theme.spacing.xl,
          paddingTop: theme.spacing.sm,
          paddingBottom: theme.spacing.md,
        },
        style,
      ]}
    >
      <View style={{ minWidth: 32, alignItems: 'flex-start' }}>{leading}</View>
      <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: theme.spacing.sm }}>
        {title ? (
          <Text variant="headline" numberOfLines={1}>
            {title}
          </Text>
        ) : null}
      </View>
      <View style={{ minWidth: 32, alignItems: 'flex-end' }}>{trailing}</View>
    </View>
  );
}
