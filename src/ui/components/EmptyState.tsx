import { View } from 'react-native';

import { useTheme } from '@/ui/theme/useTheme';

import { PrimaryButton } from './PrimaryButton';
import { Text } from './Text';

interface Props {
  emoji?: string;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void; loading?: boolean };
  footnote?: string;
}

/** Friendly centered empty/zero state with one clear call-to-action. */
export function EmptyState({ emoji, title, body, action, footnote }: Props) {
  const theme = useTheme();

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.spacing.xxxl,
      }}
    >
      {emoji ? (
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.backgroundSecondary,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: theme.spacing.xl,
          }}
        >
          <Text style={{ fontSize: 44, lineHeight: 52 }}>{emoji}</Text>
        </View>
      ) : null}

      <Text variant="title2" center>
        {title}
      </Text>

      {body ? (
        <Text
          variant="body"
          color="secondary"
          center
          style={{ marginTop: theme.spacing.sm, maxWidth: 320 }}
        >
          {body}
        </Text>
      ) : null}

      {action ? (
        <PrimaryButton
          title={action.label}
          onPress={action.onPress}
          loading={action.loading}
          style={{ marginTop: theme.spacing.xl, alignSelf: 'stretch', maxWidth: 360 }}
        />
      ) : null}

      {footnote ? (
        <Text variant="footnote" color="tertiary" center style={{ marginTop: theme.spacing.md }}>
          {footnote}
        </Text>
      ) : null}
    </View>
  );
}
