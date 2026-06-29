import { Stack } from 'expo-router';

import { useTheme } from '@/ui/theme/useTheme';

/** The "Plan This Week" flow. Its own stack so intake steps + review can push later. */
export default function PlanLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}
