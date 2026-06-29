import { Text as RNText, TextProps, TextStyle } from 'react-native';

import { useTheme } from '@/ui/theme/useTheme';
import { TypographyVariant } from '@/ui/theme/typography';

type TextColor =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'accent'
  | 'onAccent'
  | 'danger'
  | 'success';

interface Props extends TextProps {
  variant?: TypographyVariant;
  color?: TextColor;
  center?: boolean;
  weight?: TextStyle['fontWeight'];
}

/** Themed text. Pick a typography variant + semantic color; never hardcode either. */
export function Text({
  variant = 'body',
  color = 'primary',
  center,
  weight,
  style,
  ...rest
}: Props) {
  const theme = useTheme();

  const colorValue: Record<TextColor, string> = {
    primary: theme.colors.text,
    secondary: theme.colors.textSecondary,
    tertiary: theme.colors.textTertiary,
    accent: theme.colors.accent,
    onAccent: theme.colors.onAccent,
    danger: theme.colors.danger,
    success: theme.colors.success,
  };

  return (
    <RNText
      style={[
        theme.typography[variant],
        { color: colorValue[color] },
        center && { textAlign: 'center' },
        weight ? { fontWeight: weight } : null,
        style,
      ]}
      {...rest}
    />
  );
}
