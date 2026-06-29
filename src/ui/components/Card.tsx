import { ReactNode } from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';

import { useTheme } from '@/ui/theme/useTheme';

interface Props {
  children: ReactNode;
  onPress?: () => void;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Rounded surface: soft shadow in light mode, hairline border in dark mode. */
export function Card({ children, onPress, padded = true, style }: Props) {
  const theme = useTheme();

  const surface: ViewStyle = {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: padded ? theme.spacing.lg : 0,
    ...(theme.mode === 'light'
      ? {
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        }
      : {
          borderWidth: 1,
          borderColor: theme.colors.border,
        }),
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [surface, pressed && { opacity: 0.7 }, style]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[surface, style]}>{children}</View>;
}
