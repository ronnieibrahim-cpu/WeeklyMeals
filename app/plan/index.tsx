import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { EmptyState, Screen } from '@/ui/components';
import { useTheme } from '@/ui/theme/useTheme';

export default function PlanIntakeScreen() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <Screen
      scroll={false}
      headerRight={
        <Pressable
          accessibilityLabel="Close"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={28} color={theme.colors.text} />
        </Pressable>
      }
      title=" "
    >
      <View style={{ flex: 1 }}>
        <EmptyState
          emoji="📝"
          title="Let's plan this week's dinners"
          body="The Sunday questionnaire lands in the next step — one quick question at a time, then I'll generate your week."
        />
      </View>
    </Screen>
  );
}
