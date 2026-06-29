import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { EmptyState, Screen } from '@/ui/components';
import { useTheme } from '@/ui/theme/useTheme';

export default function ProfileScreen() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <Screen
      title="Profile"
      headerRight={
        <Pressable
          accessibilityLabel="Settings"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.push('/settings')}
        >
          <Ionicons name="settings-outline" size={24} color={theme.colors.text} />
        </Pressable>
      }
    >
      <EmptyState
        emoji="👤"
        title="Tell me about your household"
        body="Family size, favorite cuisines, budget, allergies and more. The more I know, the better your weekly plans get."
      />
    </Screen>
  );
}
