import { Stack } from 'expo-router';

import { useTheme } from '@/ui/theme/useTheme';

/** The weekly review flow (meal-by-meal ratings). Presented as a modal. */
export default function ReviewLayout() {
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
