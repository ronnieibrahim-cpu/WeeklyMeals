import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Card, Screen, Text } from '@/ui/components';
import { ThemePreference, useSettingsStore } from '@/stores/settingsStore';
import { useTheme } from '@/ui/theme/useTheme';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const COMING_SOON = [
  'Other stores (Costco, Kroger…)',
  'Grocery delivery (Instacart, HEB Curbside)',
  'Apple Health · Calendar',
  'Notifications · Widgets',
];

export default function SettingsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const themePreference = useSettingsStore((s) => s.themePreference);
  const setThemePreference = useSettingsStore((s) => s.setThemePreference);

  return (
    <Screen scroll>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: theme.spacing.lg,
          marginLeft: -theme.spacing.xs,
        }}
      >
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.back()}
          style={{ flexDirection: 'row', alignItems: 'center' }}
        >
          <Ionicons name="chevron-back" size={26} color={theme.colors.accent} />
          <Text variant="body" color="accent">
            Profile
          </Text>
        </Pressable>
      </View>

      <Text variant="largeTitle" style={{ marginBottom: theme.spacing.xl }}>
        Settings
      </Text>

      <Text
        variant="footnote"
        color="secondary"
        style={{ marginBottom: theme.spacing.sm, marginLeft: theme.spacing.xs }}
      >
        APPEARANCE
      </Text>
      <Card padded={false} style={{ marginBottom: theme.spacing.xl }}>
        {THEME_OPTIONS.map((option, i) => (
          <Pressable
            key={option.value}
            onPress={() => setThemePreference(option.value)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: theme.spacing.md,
              paddingHorizontal: theme.spacing.lg,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: theme.colors.separator,
            }}
          >
            <Text variant="body">{option.label}</Text>
            {themePreference === option.value ? (
              <Ionicons name="checkmark" size={22} color={theme.colors.accent} />
            ) : null}
          </Pressable>
        ))}
      </Card>

      <Text
        variant="footnote"
        color="secondary"
        style={{ marginBottom: theme.spacing.sm, marginLeft: theme.spacing.xs }}
      >
        SYNC
      </Text>
      <Card padded={false} style={{ marginBottom: theme.spacing.xl }}>
        <Pressable
          onPress={() => router.push('/household')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: theme.spacing.md,
            paddingHorizontal: theme.spacing.lg,
          }}
        >
          <Text variant="body">Household sync</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
        </Pressable>
      </Card>

      <Text
        variant="footnote"
        color="secondary"
        style={{ marginBottom: theme.spacing.sm, marginLeft: theme.spacing.xs }}
      >
        COMING SOON
      </Text>
      <Card padded={false} style={{ marginBottom: theme.spacing.xl }}>
        {COMING_SOON.map((label, i) => (
          <View
            key={label}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: theme.spacing.md,
              paddingHorizontal: theme.spacing.lg,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: theme.colors.separator,
            }}
          >
            <Text variant="body" color="tertiary">
              {label}
            </Text>
            <Text variant="footnote" color="tertiary">
              soon
            </Text>
          </View>
        ))}
      </Card>

      <Text variant="footnote" color="tertiary" center>
        Weekly Meals · Version 1.0.0
      </Text>
      <Text
        variant="footnote"
        color="tertiary"
        center
        style={{ marginTop: theme.spacing.xs }}
      >
        Some recipe photos courtesy of TheMealDB.com
      </Text>
    </Screen>
  );
}
