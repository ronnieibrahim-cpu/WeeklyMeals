import { Pressable } from 'react-native';

import { useTheme } from '@/ui/theme/useTheme';

import { Text } from './Text';

interface Props {
  label: string;
  selected: boolean;
  onPress: () => void;
}

/** Pill toggle used for cuisine/diet/protein selection. */
export function Chip({ label, selected, onPress }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.radius.pill,
        backgroundColor: selected ? theme.colors.accent : theme.colors.backgroundSecondary,
        borderWidth: 1,
        borderColor: selected ? theme.colors.accent : theme.colors.border,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Text variant="subhead" color={selected ? 'onAccent' : 'primary'}>
        {label}
      </Text>
    </Pressable>
  );
}
