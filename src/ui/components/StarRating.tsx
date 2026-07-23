import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { useHaptics } from '@/ui/hooks/useHaptics';
import { usePrefersReducedMotion } from '@/ui/hooks/usePrefersReducedMotion';
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
  const haptics = useHaptics();
  const reduceMotion = usePrefersReducedMotion();

  // Group 4c: a quick fill sweep across the filled stars whenever the
  // rating increases (skipped on first mount and on a decrease).
  const sweep = useSharedValue(1);
  const mountedRef = useRef(false);
  const prevValueRef = useRef(value);
  useEffect(() => {
    const prev = prevValueRef.current;
    prevValueRef.current = value;
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (value > prev && !reduceMotion) {
      sweep.value = withSequence(withTiming(1.25, { duration: 90 }), withTiming(1, { duration: 130 }));
    }
  }, [value, reduceMotion, sweep]);
  const sweepStyle = useAnimatedStyle(() => ({ transform: [{ scale: sweep.value }] }));

  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
      {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
        <Pressable
          key={star}
          accessibilityRole="button"
          accessibilityLabel={`${star} star${star === 1 ? '' : 's'}`}
          hitSlop={4}
          onPress={() => {
            haptics.light();
            onChange(star);
          }}
        >
          <Animated.View style={star <= value ? sweepStyle : undefined}>
            <Ionicons
              name={star <= value ? 'star' : 'star-outline'}
              size={size}
              color={star <= value ? theme.colors.star : theme.colors.textTertiary}
            />
          </Animated.View>
        </Pressable>
      ))}
    </View>
  );
}
