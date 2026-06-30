import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/ui/theme/useTheme';

import { PrimaryButton } from './PrimaryButton';
import { ProgressBar } from './ProgressBar';
import { Text } from './Text';

interface Props {
  step: number; // 1-based
  total: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onContinue: () => void;
  onClose: () => void;
  onBack?: () => void;
  onSkip?: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
}

/**
 * Shared frame for one-question-at-a-time flows (intake + weekly review):
 * close button, progress, title, a scrolling control area, and a pinned footer.
 */
export function QuestionScaffold({
  step,
  total,
  title,
  subtitle,
  children,
  onContinue,
  onClose,
  onBack,
  onSkip,
  continueLabel = 'Continue',
  continueDisabled,
}: Props) {
  const theme = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ flex: 1, paddingHorizontal: theme.spacing.xl }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.lg,
            paddingTop: theme.spacing.sm,
          }}
        >
          <Pressable accessibilityLabel="Close" accessibilityRole="button" hitSlop={8} onPress={onClose}>
            <Ionicons name="close" size={26} color={theme.colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <ProgressBar progress={step / total} />
          </View>
        </View>

        <View style={{ flex: 1, marginTop: theme.spacing.xl }}>
          <Text variant="footnote" color="tertiary">
            Step {step} of {total}
          </Text>
          <Text variant="title1" style={{ marginTop: theme.spacing.xs }}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="body" color="secondary" style={{ marginTop: theme.spacing.sm }}>
              {subtitle}
            </Text>
          ) : null}

          <ScrollView
            style={{ marginTop: theme.spacing.xl }}
            contentContainerStyle={{ paddingBottom: theme.spacing.xl }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </View>

        <View style={{ paddingBottom: theme.spacing.md, gap: theme.spacing.md }}>
          <PrimaryButton title={continueLabel} onPress={onContinue} disabled={continueDisabled} />
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.xxl }}>
            {onBack ? (
              <Pressable accessibilityRole="button" onPress={onBack}>
                <Text variant="subhead" color="secondary">
                  Back
                </Text>
              </Pressable>
            ) : null}
            {onSkip ? (
              <Pressable accessibilityRole="button" onPress={onSkip}>
                <Text variant="subhead" color="secondary">
                  Skip
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
