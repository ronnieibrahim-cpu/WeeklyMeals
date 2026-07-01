import { Pressable, View } from 'react-native';

import { useTheme } from '@/ui/theme/useTheme';

import { Text } from './Text';

interface Props {
  value: boolean | null | undefined;
  onChange: (value: boolean) => void;
}

/** Segmented Yes / No control. */
export function YesNoToggle({ value, onChange }: Props) {
  const theme = useTheme();

  const option = (label: string, isYes: boolean) => {
    const selected = value === isYes;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={() => onChange(isYes)}
        style={{
          flex: 1,
          alignItems: 'center',
          paddingVertical: theme.spacing.md,
          borderRadius: theme.radius.md,
          backgroundColor: selected ? theme.colors.accent : theme.colors.backgroundSecondary,
        }}
      >
        <Text variant="headline" color={selected ? 'onAccent' : 'primary'}>
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
      {option('Yes', true)}
      {option('No', false)}
    </View>
  );
}
