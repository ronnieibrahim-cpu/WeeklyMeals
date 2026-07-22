import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, View, ViewStyle } from 'react-native';

import { useTheme } from '@/ui/theme/useTheme';

import { Text } from './Text';

interface Props {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Optional leading icon (Ionicons name). Retires emoji from CTA labels. */
  icon?: ComponentProps<typeof Ionicons>['name'];
  style?: ViewStyle;
}

/** The single, prominent call-to-action. One per screen. */
export function PrimaryButton({ title, onPress, loading, disabled, icon, style }: Props) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: theme.colors.accent,
          borderRadius: theme.radius.pill,
          height: 52,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.xl,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.onAccent} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          {icon ? <Ionicons name={icon} size={18} color={theme.colors.onAccent} /> : null}
          <Text variant="headline" color="onAccent">
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
