import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/ui/theme/useTheme';

import { Text } from './Text';

interface Props {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}

/** Compact – value + control. The screen provides the label alongside it. */
export function Stepper({ value, min = 0, max = 99, step = 1, onChange }: Props) {
  const theme = useTheme();

  const button = (icon: 'remove' | 'add', onPress: () => void, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={{
        width: 32,
        height: 32,
        borderRadius: theme.radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.backgroundSecondary,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Ionicons name={icon} size={18} color={theme.colors.text} />
    </Pressable>
  );

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
      {button('remove', () => onChange(Math.max(min, value - step)), value <= min)}
      <Text variant="headline" style={{ minWidth: 28, textAlign: 'center' }}>
        {value}
      </Text>
      {button('add', () => onChange(Math.min(max, value + step)), value >= max)}
    </View>
  );
}
