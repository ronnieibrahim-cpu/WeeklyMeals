import { ActivityIndicator, Pressable, View, ViewStyle } from 'react-native';

import { useTheme } from '@/ui/theme/useTheme';

import { Text } from './Text';

interface Props {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

/** The single, prominent call-to-action. One per screen. */
export function PrimaryButton({ title, onPress, loading, disabled, style }: Props) {
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
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: theme.spacing.xl,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.onAccent} />
      ) : (
        <View>
          <Text variant="headline" color="onAccent">
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
