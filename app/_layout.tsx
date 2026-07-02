import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useLearningStore } from '@/stores/learningStore';
import { usePantryStore } from '@/stores/pantryStore';
import { usePlanStore } from '@/stores/planStore';
import { useProfileStore } from '@/stores/profileStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSyncStore } from '@/stores/syncStore';
import { AppThemeProvider } from '@/ui/theme/ThemeProvider';
import { useTheme } from '@/ui/theme/useTheme';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const theme = useTheme();

  useEffect(() => {
    void useSettingsStore.getState().init();
    void useProfileStore.getState().init();
    void usePlanStore.getState().init();
    void usePantryStore.getState().init();
    void useLearningStore.getState().init();
    void useSyncStore.getState().init();
    SplashScreen.hideAsync();
  }, []);

  return (
    <>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="plan" options={{ presentation: 'modal' }} />
        <Stack.Screen name="review" options={{ presentation: 'modal' }} />
        <Stack.Screen name="reroll" options={{ presentation: 'modal' }} />
        <Stack.Screen name="meal/[id]" />
        <Stack.Screen name="household" />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppThemeProvider>
          <RootNavigator />
        </AppThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
