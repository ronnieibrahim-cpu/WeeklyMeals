import { useRouter } from 'expo-router';
import { ReactNode, useState } from 'react';
import { View } from 'react-native';

import {
  ADVENTUROUS_OPTIONS,
  BUDGET_OPTIONS,
  COMMON_DIETS,
  COMMON_PANTRY,
  CUISINE_LABEL,
  CUISINES,
  HEALTHY_COMFORT_OPTIONS,
  MAX_COOK_OPTIONS,
  MAX_PREP_OPTIONS,
  SPECIAL_OCCASIONS,
} from '@/domain/constants';
import { createDefaultProfile, createIntakeFromProfile } from '@/domain/defaults';
import { Cuisine, IntakeAnswers } from '@/domain/models';
import { usePlanStore } from '@/stores/planStore';
import { useProfileStore } from '@/stores/profileStore';
import {
  ChipMultiSelect,
  ChipOption,
  ChipSingleSelect,
  QuestionScaffold,
  Stepper,
  Text,
} from '@/ui/components';
import { useTheme } from '@/ui/theme/useTheme';

function toggle<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
}
const toOptions = (values: string[]): ChipOption[] => values.map((v) => ({ value: v, label: v }));
const numOptions = (values: number[], suffix: string): ChipOption[] =>
  values.map((n) => ({ value: String(n), label: `${suffix === '$' ? '$' : ''}${n}${suffix === '$' ? '' : suffix}` }));

interface StepDef {
  title: string;
  subtitle?: string;
  control: ReactNode;
  continueLabel?: string;
  canSkip?: boolean;
}

export default function PlanIntakeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const profile = useProfileStore((s) => s.profile);

  const [answers, setAnswers] = useState<IntakeAnswers>(() =>
    createIntakeFromProfile(profile ?? createDefaultProfile()),
  );
  const [index, setIndex] = useState(0);

  const patch = (p: Partial<IntakeAnswers>) => setAnswers((a) => ({ ...a, ...p }));

  const centeredStepper = (
    value: number,
    unit: string,
    onChange: (v: number) => void,
    min: number,
    max: number,
  ) => (
    <View style={{ alignItems: 'center', marginTop: theme.spacing.lg }}>
      <Stepper value={value} min={min} max={max} onChange={onChange} />
      <Text variant="subhead" color="secondary" style={{ marginTop: theme.spacing.md }}>
        {unit}
      </Text>
    </View>
  );

  const steps: StepDef[] = [
    {
      title: 'How many dinners this week?',
      control: centeredStepper(answers.dinners, 'dinners', (dinners) => patch({ dinners }), 1, 7),
    },
    {
      title: 'How many people are you cooking for?',
      control: centeredStepper(answers.people, 'people', (people) => patch({ people }), 1, 12),
    },
    {
      title: "What's your budget this week?",
      subtitle: "I'll keep the shopping list under this.",
      control: (
        <ChipSingleSelect
          options={numOptions(BUDGET_OPTIONS, '$')}
          value={String(answers.budget)}
          onChange={(v) => patch({ budget: Number(v) })}
        />
      ),
    },
    {
      title: 'Max hands-on prep time?',
      subtitle: 'Per dinner.',
      control: (
        <ChipSingleSelect
          options={numOptions(MAX_PREP_OPTIONS, ' min')}
          value={String(answers.maxPrepMinutes)}
          onChange={(v) => patch({ maxPrepMinutes: Number(v) })}
        />
      ),
    },
    {
      title: 'Max cook time?',
      subtitle: 'Per dinner.',
      control: (
        <ChipSingleSelect
          options={numOptions(MAX_COOK_OPTIONS, ' min')}
          value={String(answers.maxCookMinutes)}
          onChange={(v) => patch({ maxCookMinutes: Number(v) })}
        />
      ),
    },
    {
      title: 'Any cuisines you’re craving?',
      subtitle: 'Leave all unselected for no preference — I’ll rotate for variety.',
      control: (
        <ChipMultiSelect
          options={CUISINES}
          values={answers.cuisines}
          onToggle={(v) => patch({ cuisines: toggle(answers.cuisines, v as Cuisine) })}
        />
      ),
      canSkip: true,
    },
    {
      title: 'Healthy or comfort food?',
      control: (
        <ChipSingleSelect
          options={HEALTHY_COMFORT_OPTIONS}
          value={String(answers.healthyVsComfort)}
          onChange={(v) => patch({ healthyVsComfort: Number(v) })}
        />
      ),
    },
    {
      title: 'How adventurous this week?',
      control: (
        <ChipSingleSelect
          options={ADVENTUROUS_OPTIONS}
          value={String(answers.adventurousness)}
          onChange={(v) => patch({ adventurousness: Number(v) })}
        />
      ),
    },
    {
      title: 'Any dietary restrictions?',
      subtitle: 'Pre-filled from your profile — adjust just for this week if you like.',
      control: (
        <ChipMultiSelect
          options={toOptions(COMMON_DIETS)}
          values={answers.dietaryRestrictions}
          onToggle={(v) => patch({ dietaryRestrictions: toggle(answers.dietaryRestrictions, v) })}
        />
      ),
      canSkip: true,
    },
    {
      title: 'Anything already at home?',
      subtitle: "I'll plan around it to cut waste and cost.",
      control: (
        <ChipMultiSelect
          options={toOptions(COMMON_PANTRY)}
          values={answers.ingredientsAtHome}
          onToggle={(v) => patch({ ingredientsAtHome: toggle(answers.ingredientsAtHome, v) })}
        />
      ),
      canSkip: true,
    },
    {
      title: 'Any special occasions?',
      control: (
        <ChipMultiSelect
          options={toOptions(SPECIAL_OCCASIONS)}
          values={answers.specialOccasions}
          onToggle={(v) => patch({ specialOccasions: toggle(answers.specialOccasions, v) })}
        />
      ),
      canSkip: true,
    },
    {
      title: 'How many meals should make leftovers?',
      subtitle: 'Great for lunches or a no-cook night.',
      control: centeredStepper(
        answers.desiredLeftovers,
        'meals with leftovers',
        (desiredLeftovers) => patch({ desiredLeftovers }),
        0,
        answers.dinners,
      ),
    },
    {
      title: 'You’re all set 🎉',
      subtitle: 'Here’s what I’ll plan around this week.',
      continueLabel: 'Build my week 🍳',
      control: <IntakeSummary answers={answers} />,
    },
  ];

  const current = steps[index];
  const isLast = index === steps.length - 1;

  const finish = () => {
    usePlanStore.getState().setIntake(answers);
    usePlanStore.getState().generate();
    router.replace('/plan/review');
  };

  return (
    <QuestionScaffold
      step={index + 1}
      total={steps.length}
      title={current.title}
      subtitle={current.subtitle}
      continueLabel={current.continueLabel ?? 'Continue'}
      onContinue={() => (isLast ? finish() : setIndex(index + 1))}
      onClose={() => router.back()}
      onBack={index > 0 ? () => setIndex(index - 1) : undefined}
      onSkip={current.canSkip && !isLast ? () => setIndex(index + 1) : undefined}
    >
      {current.control}
    </QuestionScaffold>
  );
}

function IntakeSummary({ answers }: { answers: IntakeAnswers }) {
  const theme = useTheme();
  const cuisines =
    answers.cuisines.length > 0
      ? answers.cuisines.map((c) => CUISINE_LABEL[c]).join(', ')
      : 'No preference (I’ll rotate)';
  const vibe = ['Healthy', 'Balanced', 'Comfort'][Math.round(answers.healthyVsComfort * 2)] ?? 'Balanced';

  const rows: [string, string][] = [
    ['Dinners', `${answers.dinners} for ${answers.people}`],
    ['Budget', `$${answers.budget}`],
    ['Time limit', `${answers.maxPrepMinutes}m prep · ${answers.maxCookMinutes}m cook`],
    ['Cuisines', cuisines],
    ['Style', vibe],
    ['Leftovers', `${answers.desiredLeftovers} meal${answers.desiredLeftovers === 1 ? '' : 's'}`],
  ];

  return (
    <View style={{ gap: theme.spacing.md }}>
      {rows.map(([label, value]) => (
        <View
          key={label}
          style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.lg }}
        >
          <Text variant="body" color="secondary">
            {label}
          </Text>
          <Text variant="body" style={{ flexShrink: 1, textAlign: 'right' }}>
            {value}
          </Text>
        </View>
      ))}
      <Text variant="footnote" color="tertiary" style={{ marginTop: theme.spacing.md }}>
        Next, I’ll turn this into 7 dinners with recipes and one H-E-B shopping list.
      </Text>
    </View>
  );
}
