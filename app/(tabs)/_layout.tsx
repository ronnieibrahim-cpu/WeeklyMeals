import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { ComponentProps } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useManualItemsStore } from '@/stores/manualItemsStore';
import { usePlanStore } from '@/stores/planStore';
import { Text } from '@/ui/components';
import { useTheme } from '@/ui/theme/useTheme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const ICONS: Record<string, { active: IoniconName; inactive: IoniconName }> = {
  index: { active: 'restaurant', inactive: 'restaurant-outline' },
  recipes: { active: 'search', inactive: 'search-outline' },
  schedule: { active: 'calendar', inactive: 'calendar-outline' },
  shopping: { active: 'cart', inactive: 'cart-outline' },
  profile: { active: 'person', inactive: 'person-outline' },
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

/** Small accent pill shown top-right of a tab icon; hidden at count 0. */
function TabBadge({ count }: { count: number }) {
  const theme = useTheme();
  if (count <= 0) return null;

  return (
    <View
      style={{
        position: 'absolute',
        top: -3,
        right: -10,
        minWidth: 18,
        height: 18,
        paddingHorizontal: 4,
        borderRadius: 9,
        backgroundColor: theme.colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant="caption" color="onAccent" numberOfLines={1}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}

/**
 * Custom bottom tab bar so spacing/height is fully controlled (the platform
 * default was clipping labels under the home indicator on iPhone). Uses the
 * safe-area inset with a sensible floor.
 */
function TabBar({ state, navigation }: TabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // Group 3: read the existing plan/manual-item state directly — these
  // counts already exist on the store, this just displays them.
  const plan = usePlanStore((s) => s.plan);
  const shoppingList = usePlanStore((s) => s.shoppingList);
  const manualItems = useManualItemsStore((s) => s.items);

  const mealsRemaining = plan ? plan.meals.filter((m) => !m.cooked).length : 0;
  const hasCurrentShoppingList = !!shoppingList && (!plan || shoppingList.planId === plan.id);
  const uncheckedShoppingCount =
    (hasCurrentShoppingList ? shoppingList!.items.filter((i) => !i.checked).length : 0) +
    manualItems.filter((i) => !i.checked).length;

  const BADGE_COUNTS: Record<string, number> = {
    index: mealsRemaining,
    shopping: uncheckedShoppingCount,
  };

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
            <View>
              <Ionicons
                name={
                  (focused ? ICONS[route.name]?.active : ICONS[route.name]?.inactive) ?? 'ellipse-outline'
                }
                size={24}
                color={color}
              />
              <TabBadge count={BADGE_COUNTS[route.name] ?? 0} />
            </View>
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
