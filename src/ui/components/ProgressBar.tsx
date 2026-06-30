import { View } from 'react-native';

import { useTheme } from '@/ui/theme/useTheme';

/** Thin progress bar (0…1). */
export function ProgressBar({ progress }: { progress: number }) {
  const theme = useTheme();
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <View
      style={{
        height: 6,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.colors.backgroundSecondary,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${pct * 100}%`,
          height: '100%',
          backgroundColor: theme.colors.accent,
          borderRadius: theme.radius.pill,
        }}
      />
    </View>
  );
}
