import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { isPlausibleEmail } from '@/engine/listEmail';
import { Card, NavHeader, Screen, Text } from '@/ui/components';
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
  const hebListEmail = useSettingsStore((s) => s.hebListEmail);
  const setHebListEmail = useSettingsStore((s) => s.setHebListEmail);
  // Edited locally and saved on blur/done, so a half-typed address is never
  // stored. An address that doesn't look like one is not saved.
  const [emailDraft, setEmailDraft] = useState(hebListEmail);
  useEffect(() => setEmailDraft(hebListEmail), [hebListEmail]);
  const emailLooksWrong = emailDraft.trim() !== '' && !isPlausibleEmail(emailDraft);
  const saveEmail = () => {
    if (emailDraft.trim() === '' || isPlausibleEmail(emailDraft)) setHebListEmail(emailDraft);
  };

  return (
    <Screen scroll>
      <NavHeader
        onBack={() => router.back()}
        style={{
          paddingHorizontal: 0,
          paddingTop: 0,
          paddingBottom: theme.spacing.lg,
          marginLeft: -theme.spacing.xs,
        }}
      />

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
        H-E-B LIST
      </Text>
      <Card style={{ marginBottom: theme.spacing.xl }}>
        <Text variant="body">Email my list after I approve a week</Text>
        <TextInput
          value={emailDraft}
          onChangeText={setEmailDraft}
          onBlur={saveEmail}
          onSubmitEditing={saveEmail}
          placeholder="you@example.com"
          placeholderTextColor={theme.colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          inputMode="email"
          returnKeyType="done"
          style={{
            marginTop: theme.spacing.sm,
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.md,
            paddingVertical: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            fontSize: 17,
            color: theme.colors.text,
          }}
        />
        <Text variant="footnote" color="tertiary" style={{ marginTop: theme.spacing.xs }}>
          {emailLooksWrong
            ? "That doesn't look like an email address, so it isn't saved."
            : 'Saved on this phone only. Leave blank to turn off. Approving a week then opens a ready email of what to buy; you tap Send.'}
        </Text>
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
        Some recipe photos courtesy of TheMealDB.com. Others from Wikimedia
        Commons contributors, credited on the recipe's page.
      </Text>
    </Screen>
  );
}
