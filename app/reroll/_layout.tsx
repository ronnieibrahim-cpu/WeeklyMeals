import { Stack } from 'expo-router';

import { useTheme } from '@/ui/theme/useTheme';

/** The mid-week re-roll flow (M2.2). Presented as a modal. */
export default function RerollLayout() {
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
