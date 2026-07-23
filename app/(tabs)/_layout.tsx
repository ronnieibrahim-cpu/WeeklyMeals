import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { ComponentProps } from 'react';
import { Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useManualItemsStore } from '@/stores/manualItemsStore';
import { usePlanStore } from '@/stores/planStore';
import { Text } from '@/ui/components';
import { useTheme } from '@/ui/theme/useTheme';

// Phase 4 G3 (IA consolidation): phone bottom tabs -> desktop left sidebar,
// web only. No existing responsive/breakpoint utility was found in the
// codebase (checked useWindowDimensions, Dimensions, Platform.OS, isWide,
// maxWidth usages, and src/ui/theme/tokens.ts, which only has spacing/radius
// scales, no breakpoints) — so this is a tiny, colocated check rather than a
// new shared utility. Below this width, and on native at any width, layout
// is unchanged: bottom tabs render exactly as before (G1).
const SIDEBAR_BREAKPOINT = 1024;
const SIDEBAR_WIDTH = 240;
const CONTENT_MAX_WIDTH = 840;

/** True only on web at/above the large breakpoint. Native always false. */
function useIsWebSidebar(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= SIDEBAR_BREAKPOINT;
}

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const ICONS: Record<string, { active: IoniconName; inactive: IoniconName }> = {
  index: { active: 'restaurant', inactive: 'restaurant-outline' },
  recipes: { active: 'search', inactive: 'search-outline' },
  shopping: { active: 'cart', inactive: 'cart-outline' },
  profile: { active: 'person', inactive: 'person-outline' },
};
const LABELS: Record<string, string> = {
  index: 'This Week',
  recipes: 'Recipes',
  shopping: 'Shopping',
  profile: 'Profile',
};
// Phase 4 G1: the Schedule tab was folded into This Week as a segment (see
// app/(tabs)/index.tsx's WeekViewSwitch). Its route file still exists
// (app/(tabs)/schedule.tsx, now a <Redirect>) purely to keep old /schedule
// deep links resolving — it must never render as a visible tab bar button.
const HIDDEN_ROUTE_NAMES = new Set(['schedule']);

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
 * Custom tab bar so spacing/height is fully controlled (the platform default
 * was clipping labels under the home indicator on iPhone). Uses the safe-area
 * inset with a sensible floor.
 *
 * Phase 4 G3: on web at/above SIDEBAR_BREAKPOINT this renders as a left
 * sidebar instead of a bottom bar (`isSidebar`, driven by TabsLayout below).
 * Native and narrow web are unaffected — same 4 destinations, same badge
 * counts, same active/focus color, same routes/params/deep links; only the
 * container layout and item orientation change.
 */
function TabBar({ state, navigation, isSidebar }: TabBarProps & { isSidebar: boolean }) {
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

  // Phase 4 G1: render a button for every route except the hidden
  // (redirect-only) ones. Focus is computed by route key against the
  // navigator's actual focused route, not by array index, since filtering
  // shifts positions relative to `state.index`.
  const visibleRoutes = state.routes.filter((route) => !HIDDEN_ROUTE_NAMES.has(route.name));
  const focusedRouteKey = state.routes[state.index]?.key;

  const handlePress = (route: { key: string; name: string }, focused: boolean) => {
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
  };

  if (isSidebar) {
    return (
      <View
        style={{
          width: SIDEBAR_WIDTH,
          backgroundColor: theme.colors.tabBar,
          borderRightWidth: 1,
          borderRightColor: theme.colors.border,
          paddingTop: Math.max(insets.top, theme.spacing.xl),
          paddingHorizontal: theme.spacing.md,
          gap: theme.spacing.xs,
        }}
      >
        {visibleRoutes.map((route) => {
          const focused = route.key === focusedRouteKey;
          const color = focused ? theme.colors.accent : theme.colors.tabBarInactive;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              onPress={() => handlePress(route, focused)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
                paddingVertical: theme.spacing.sm,
                paddingHorizontal: theme.spacing.sm,
                borderRadius: theme.radius.md,
                backgroundColor: focused ? theme.colors.accentMuted : 'transparent',
              }}
            >
              <View>
                <Ionicons
                  name={
                    (focused ? ICONS[route.name]?.active : ICONS[route.name]?.inactive) ??
                    'ellipse-outline'
                  }
                  size={24}
                  color={color}
                />
                <TabBadge count={BADGE_COUNTS[route.name] ?? 0} />
              </View>
              <Text variant="body" numberOfLines={1} style={{ color }}>
                {LABELS[route.name] ?? route.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

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
      {visibleRoutes.map((route) => {
        const focused = route.key === focusedRouteKey;
        const color = focused ? theme.colors.accent : theme.colors.tabBarInactive;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            onPress={() => handlePress(route, focused)}
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
  const isSidebar = useIsWebSidebar();

  return (
    <Tabs
      tabBar={(props) => <TabBar {...(props as unknown as TabBarProps)} isSidebar={isSidebar} />}
      screenOptions={{
        headerShown: false,
        // Phase 4 G3: expo-router's bottom-tabs navigator natively supports
        // 'left'/'right' tab bar positions — it switches the outer container
        // to flexDirection: 'row' and places our custom tabBar on that side,
        // so no manual row-wrapper is needed here.
        tabBarPosition: isSidebar ? 'left' : 'bottom',
        // On the sidebar layout, center a max-width content column so text
        // doesn't run edge-to-edge on wide screens; unchanged otherwise.
        sceneStyle: isSidebar
          ? {
              backgroundColor: theme.colors.background,
              width: '100%',
              maxWidth: CONTENT_MAX_WIDTH,
              alignSelf: 'center',
            }
          : { backgroundColor: theme.colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'This Week' }} />
      <Tabs.Screen name="recipes" options={{ title: 'Recipes' }} />
      {/* Phase 4 G1: kept registered (not declared as a visible tab) so the
          route still resolves for old /schedule deep links — the redirect
          itself lives in app/(tabs)/schedule.tsx. Default options are fine
          since it renders nothing but a <Redirect>. */}
      <Tabs.Screen name="schedule" options={{ href: null }} />
      <Tabs.Screen name="shopping" options={{ title: 'Shopping' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
