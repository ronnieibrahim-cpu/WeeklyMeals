import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { ComponentProps } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/ui/components';
import { useTheme } from '@/ui/theme/useTheme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const ICONS: Record<string, IoniconName> = {
  index: 'restaurant',
  recipes: 'search',
  schedule: 'calendar',
  shopping: 'cart',
  profile: 'person',
};
const LABELS: Record<string, string> = {
  index: 'This Week',
  recipes: 'Recipes',
  schedule: 'Schedule',
  shopping: 'Shopping',
  profile: 'Profile',
};

interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (event: {
      type: 'tabPress';
      target: string;
      canPreventDefault: boolean;
    }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
}

/**
 * Custom bottom tab bar so spacing/height is fully controlled (the platform
 * default was clipping labels under the home indicator on iPhone). Uses the
 * safe-area inset with a sensible floor.
 */
function TabBar({ state, navigation }: TabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: theme.colors.tabBar,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 12),
      }}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const color = focused ? theme.colors.accent : theme.colors.tabBarInactive;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 }}
          >
            <Ionicons name={ICONS[route.name] ?? 'ellipse'} size={24} color={color} />
            <Text variant="caption" numberOfLines={1} style={{ color, fontSize: 11 }}>
              {LABELS[route.name] ?? route.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      tabBar={(props) => <TabBar {...(props as unknown as TabBarProps)} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'This Week' }} />
      <Tabs.Screen name="recipes" options={{ title: 'Recipes' }} />
      <Tabs.Screen name="schedule" options={{ title: 'Schedule' }} />
      <Tabs.Screen name="shopping" options={{ title: 'Shopping' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
