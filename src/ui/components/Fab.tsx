import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '@/ui/theme/useTheme';

import { AnimatedPressable } from './AnimatedPressable';

interface Props {
  icon: ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

/** Floating circular action button: accent-filled disc with a centered icon. */
export function Fab({ icon, onPress, accessibilityLabel, style }: Props) {
  const theme = useTheme();

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[
        {
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: theme.colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={26} color={theme.colors.onAccent} />
    </AnimatedPressable>
  );
}
