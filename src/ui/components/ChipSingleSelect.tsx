import { View } from 'react-native';

import { useTheme } from '@/ui/theme/useTheme';

import { Chip } from './Chip';
import { ChipOption } from './ChipMultiSelect';

interface Props {
  options: ChipOption[];
  value: string | null;
  onChange: (value: string) => void;
}

/** Single-select group of pill chips. */
export function ChipSingleSelect({ options, value, onChange }: Props) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
      {options.map((option) => (
        <Chip
          key={option.value}
          label={option.label}
          selected={value === option.value}
          onPress={() => onChange(option.value)}
        />
      ))}
    </View>
  );
}
