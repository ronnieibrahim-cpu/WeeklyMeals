import { Pressable, ViewStyle } from 'react-native';

import { useTheme } from '@/ui/theme/useTheme';

import { Text } from './Text';

interface Props {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}

/** Lower-emphasis action: bordered, accent label, transparent fill. */
export function SecondaryButton({ title, onPress, disabled, style }: Props) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          borderRadius: theme.radius.pill,
          height: 52,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: theme.spacing.xl,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: pressed ? theme.colors.backgroundSecondary : 'transparent',
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <Text variant="headline" color="accent">
        {title}
      </Text>
    </Pressable>
  );
}
