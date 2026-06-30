import { View } from 'react-native';

import { useTheme } from '@/ui/theme/useTheme';

import { Chip } from './Chip';

export interface ChipOption {
  value: string;
  label: string;
}

interface Props {
  options: ChipOption[];
  values: string[];
  onToggle: (value: string) => void;
}

/** Multi-select group of pill chips. */
export function ChipMultiSelect({ options, values, onToggle }: Props) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
      {options.map((option) => (
        <Chip
          key={option.value}
          label={option.label}
          selected={values.includes(option.value)}
          onPress={() => onToggle(option.value)}
        />
      ))}
    </View>
  );
}
