import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/ui/theme/useTheme';

interface Props {
  value: number; // 0 = unset
  onChange: (value: number) => void;
  max?: number;
  size?: number;
}

/** 1–5 star input. */
export function StarRating({ value, onChange, max = 5, size = 38 }: Props) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
      {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
        <Pressable
          key={star}
          accessibilityRole="button"
          accessibilityLabel={`${star} star${star === 1 ? '' : 's'}`}
          hitSlop={4}
          onPress={() => onChange(star)}
        >
          <Ionicons
            name={star <= value ? 'star' : 'star-outline'}
            size={size}
            color={star <= value ? theme.colors.star : theme.colors.textTertiary}
          />
        </Pressable>
      ))}
    </View>
  );
}
