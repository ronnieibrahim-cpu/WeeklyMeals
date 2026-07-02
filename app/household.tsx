import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { useSyncStore } from '@/stores/syncStore';
import { Card, PrimaryButton, Screen, SecondaryButton, Text } from '@/ui/components';
import { useTheme } from '@/ui/theme/useTheme';

export default function HouseholdScreen() {
  const router = useRouter();
  const theme = useTheme();
  const code = useSyncStore((s) => s.code);
  const status = useSyncStore((s) => s.status);
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);
  const error = useSyncStore((s) => s.error);
  const createHousehold = useSyncStore((s) => s.createHousehold);
  const joinHousehold = useSyncStore((s) => s.joinHousehold);
  const createHouseholdWithCode = useSyncStore((s) => s.createHouseholdWithCode);
  const leave = useSyncStore((s) => s.leave);
  const syncNow = useSyncStore((s) => s.syncNow);

  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [notFoundCode, setNotFoundCode] = useState<string | null>(null);

  const statusLine =
    status === 'syncing'
      ? 'Syncing…'
      : status === 'error'
        ? `Couldn't sync: ${error ?? 'unknown error'}`
        : status === 'synced' && lastSyncedAt
          ? `Synced ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
          : 'Connected';

  const back = (
    <Pressable
      accessibilityLabel="Back"
      hitSlop={8}
      onPress={() => router.back()}
      style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.md }}
    >
      <Ionicons name="chevron-back" size={26} color={theme.colors.accent} />
      <Text variant="body" color="accent">
        Settings
      </Text>
    </Pressable>
  );

  return (
    <Screen>
      {back}
      <Text variant="largeTitle" style={{ marginBottom: theme.spacing.xs }}>
        Household Sync
      </Text>
      <Text variant="body" color="secondary" style={{ marginBottom: theme.spacing.xl }}>
        Share one code between phones to keep your plan, cooked meals, and shopping list in sync.
      </Text>

      {code ? (
        <>
          <Card>
            <Text variant="footnote" color="secondary">
              YOUR HOUSEHOLD CODE
            </Text>
            <Text variant="largeTitle" style={{ letterSpacing: 4, marginTop: theme.spacing.xs }}>
              {code}
            </Text>
            <Text variant="footnote" color="tertiary" style={{ marginTop: theme.spacing.sm }}>
              {statusLine}
            </Text>
          </Card>

          <Card style={{ marginTop: theme.spacing.lg }}>
            <Text variant="subhead" color="secondary">
              On your partner's phone, open Settings → Household Sync → Join a household, and enter
              this code.
            </Text>
          </Card>

          <PrimaryButton
            title="Sync now"
            loading={busy}
            onPress={async () => {
              setBusy(true);
              await syncNow();
              setBusy(false);
            }}
            style={{ marginTop: theme.spacing.xl }}
          />
          <SecondaryButton
            title="Leave household"
            onPress={leave}
            style={{ marginTop: theme.spacing.md }}
          />
        </>
      ) : (
        <>
          <PrimaryButton
            title="Create a household"
            loading={busy}
            onPress={async () => {
              setBusy(true);
              await createHousehold();
              setBusy(false);
            }}
          />

          <Text
            variant="footnote"
            color="tertiary"
            center
            style={{ marginVertical: theme.spacing.lg }}
          >
            — or —
          </Text>

          <Text variant="subhead" color="secondary" style={{ marginBottom: theme.spacing.sm }}>
            Join with a code
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.md,
              paddingHorizontal: theme.spacing.md,
              backgroundColor: theme.colors.card,
              marginBottom: theme.spacing.md,
            }}
          >
            <TextInput
              value={joinCode}
              onChangeText={(t) => {
                setJoinCode(t.toUpperCase());
                setNotFoundCode(null);
              }}
              placeholder="6-character code"
              placeholderTextColor={theme.colors.textTertiary}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              style={{
                flex: 1,
                paddingVertical: theme.spacing.md,
                fontSize: 20,
                letterSpacing: 3,
                color: theme.colors.text,
              }}
            />
          </View>
          <SecondaryButton
            title="Join household"
            disabled={joinCode.trim().length < 4 || busy}
            onPress={async () => {
              setBusy(true);
              const result = await joinHousehold(joinCode);
              setBusy(false);
              if (result === 'not_found') {
                setNotFoundCode(joinCode.trim().toUpperCase());
              } else {
                setJoinCode('');
              }
            }}
          />

          {notFoundCode ? (
            <Card style={{ marginTop: theme.spacing.md }}>
              <Text variant="subhead">No household found with code {notFoundCode}.</Text>
              <Text variant="footnote" color="secondary" style={{ marginTop: theme.spacing.xs }}>
                Create a new household using this code instead?
              </Text>
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
                <SecondaryButton
                  title="Cancel"
                  onPress={() => setNotFoundCode(null)}
                  style={{ flex: 1 }}
                />
                <PrimaryButton
                  title="Create household"
                  loading={busy}
                  onPress={async () => {
                    setBusy(true);
                    await createHouseholdWithCode(notFoundCode);
                    setBusy(false);
                    setNotFoundCode(null);
                    setJoinCode('');
                  }}
                  style={{ flex: 1 }}
                />
              </View>
            </Card>
          ) : null}
        </>
      )}

      <Text variant="footnote" color="tertiary" center style={{ marginTop: theme.spacing.xxl }}>
        Syncs your weekly plan and shopping list. Your saved tastes and pantry stay on each device.
      </Text>
    </Screen>
  );
}
