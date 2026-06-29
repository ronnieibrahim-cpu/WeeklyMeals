import { useRouter } from 'expo-router';

import { EmptyState, Screen } from '@/ui/components';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <Screen title=" ">
      <EmptyState
        emoji="🧭"
        title="This screen doesn't exist"
        body="Let's get you back to your week."
        action={{ label: 'Go to This Week', onPress: () => router.replace('/') }}
      />
    </Screen>
  );
}
