import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { ViewStyle } from 'react-native';

import { useTheme } from '@/ui/theme/useTheme';

import { AnimatedPressable } from './AnimatedPressable';
import { Text } from './Text';

interface Props {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  /** Optional leading icon (Ionicons name). */
  icon?: ComponentProps<typeof Ionicons>['name'];
  style?: ViewStyle;
}

/** Lower-emphasis action: bordered, accent label, transparent fill. */
export function SecondaryButton({ title, onPress, disabled, icon, style }: Props) {
  const theme = useTheme();

  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          borderRadius: theme.radius.pill,
          height: 52,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.xl,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: pressed ? theme.colors.backgroundSecondary : 'transparent',
        },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={18} color={theme.colors.accent} /> : null}
      <Text variant="headline" color="accent">
        {title}
      </Text>
    </AnimatedPressable>
  );
}
