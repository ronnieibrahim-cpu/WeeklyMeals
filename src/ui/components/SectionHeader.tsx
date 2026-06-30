import { useTheme } from '@/ui/theme/useTheme';

import { Text } from './Text';

/** Uppercase group label, Apple-settings style. */
export function SectionHeader({ title }: { title: string }) {
  const theme = useTheme();
  return (
    <Text
      variant="footnote"
      color="secondary"
      style={{
        marginTop: theme.spacing.xl,
        marginBottom: theme.spacing.sm,
        marginLeft: theme.spacing.xs,
      }}
    >
      {title.toUpperCase()}
    </Text>
  );
}
