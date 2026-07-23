import { ReactNode } from 'react';
import { Pressable, PressableProps, PressableStateCallbackType, StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { usePrefersReducedMotion } from '@/ui/hooks/usePrefersReducedMotion';

const EASING = Easing.bezier(0.2, 0.8, 0.2, 1);
const PRESS_DURATION_MS = 140; // taps/toggles band (120-160ms)

interface Props extends Omit<PressableProps, 'style' | 'children' | 'disabled'> {
  disabled?: boolean;
  children: ReactNode | ((state: PressableStateCallbackType) => ReactNode);
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
}

/**
 * Shared press feedback for buttons/cards/chips: a slight scale-down (0.97)
 * and opacity dip on press-in, eased back out on release — replaces each
 * component's own flat opacity dim. Disabled dimming is folded into the same
 * animated style (rather than a separate static `opacity`) so the two never
 * fight over the same property. Falls back to an instant, non-animated dim
 * when the user has reduce-motion on.
 */
export function AnimatedPressable({ children, style, disabled, onPressIn, onPressOut, ...rest }: Props) {
  const pressProgress = useSharedValue(0);
  const reduceMotion = usePrefersReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressProgress.value * 0.03 }],
    opacity: (disabled ? 0.5 : 1) - pressProgress.value * 0.08,
  }));

  return (
    <Pressable
      disabled={disabled}
      onPressIn={(e) => {
        pressProgress.value = reduceMotion ? 1 : withTiming(1, { duration: PRESS_DURATION_MS, easing: EASING });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressProgress.value = reduceMotion ? 0 : withTiming(0, { duration: PRESS_DURATION_MS, easing: EASING });
        onPressOut?.(e);
      }}
      {...rest}
    >
      {(state) => (
        <Animated.View style={[typeof style === 'function' ? style(state) : style, animatedStyle]}>
          {typeof children === 'function' ? children(state) : children}
        </Animated.View>
      )}
    </Pressable>
  );
}
