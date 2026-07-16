import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { INGREDIENT_SUGGESTIONS } from '@/data/ingredientSuggestions';
import {
  ADVENTUROUS_OPTIONS,
  BUDGET_OPTIONS,
  COMMON_DIETS,
  CUISINE_LABEL,
  CUISINES,
  HEALTHY_COMFORT_OPTIONS,
  MAX_COOK_OPTIONS,
  MAX_PREP_OPTIONS,
  PROTEINS,
} from '@/domain/constants';
import { createDefaultProfile, createIntakeFromProfile } from '@/domain/defaults';
import { Cuisine, IntakeAnswers, Profile, Protein } from '@/domain/models';
import { describeHouseholdServings, formatServings } from '@/engine/portions';
import { usePantryStore } from '@/stores/pantryStore';
import { usePlanStore } from '@/stores/planStore';
import { useProfileStore } from '@/stores/profileStore';
import {
  AutocompleteTagInput,
  Card,
  ChipMultiSelect,
  ChipOption,
  ChipSingleSelect,
  PrimaryButton,
  QuestionScaffold,
  SecondaryButton,
  Stepper,
  Text,
} from '@/ui/components';
import { useTheme } from '@/ui/theme/useTheme';

/** One-line recap shown on the fast-intake choice screen (M2.3). Reads what
 * was actually used to generate last week's plan — not the live household —
 * since this is a factual recap of the past, not a preview of what's next. */
function lastWeekSummary(intake: IntakeAnswers): string {
  return `Last week: ${intake.dinners} dinner${intake.dinners === 1 ? '' : 's'} for ${formatServings(intake.servingsPerMeal)} portions, ~$${intake.budget}, ${intake.maxPrepMinutes}+${intake.maxCookMinutes} min prep+cook.`;
}

function toggle<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
}
const toOptions = (values: string[]): ChipOption[] => values.map((v) => ({ value: v, label: v }));
const numOptions = (values: number[], suffix: string): ChipOption[] =>
  values.map((n) => ({ value: String(n), label: `${suffix === '$' ? '$' : ''}${n}${suffix === '$' ? '' : suffix}` }));

interface StepDef {
  key: string;
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
  const pantryItems = usePantryStore((s) => s.items);
  const addPantry = usePantryStore((s) => s.add);
  const removePantry = usePantryStore((s) => s.remove);
  const planHydrated = usePlanStore((s) => s.hydrated);
  const previousIntake = usePlanStore((s) => s.plan)?.intake ?? null;

  // M2.3: whether a previous week's intake exists isn't known until
  // planStore finishes hydrating from storage, so picking the starting
  // mode/answers can't happen in a useState initializer (that runs before
  // hydration and would race it, locking onto "no previous intake"
  // whenever this screen is the first thing mounted — e.g. a cold app
  // launch straight into /plan). `initialized` flips once, right after
  // hydration, to make that pick exactly once.
  const [initialized, setInitialized] = useState(false);
  const [mode, setMode] = useState<'choice' | 'fast' | 'full'>('full');
  const [answers, setAnswers] = useState<IntakeAnswers>(() =>
    createIntakeFromProfile(profile ?? createDefaultProfile()),
  );
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!planHydrated || initialized) return;
    setMode(previousIntake ? 'choice' : 'full');
    if (previousIntake) setAnswers(previousIntake);
    setInitialized(true);
  }, [planHydrated, initialized, previousIntake]);

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
      key: 'dinners',
      title: 'How many dinners this week?',
      control: (
        <View>
          {centeredStepper(answers.dinners, 'dinners', (dinners) => patch({ dinners }), 1, 7)}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/(tabs)/profile')}
            style={{ alignItems: 'center', marginTop: theme.spacing.xl }}
          >
            <Text variant="subhead" color="secondary">
              Cooking for: {describeHouseholdServings(profile ?? createDefaultProfile())}{' '}
              <Text variant="subhead" color="accent">
                (edit)
              </Text>
            </Text>
          </Pressable>
        </View>
      ),
    },
    {
      key: 'budget',
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
      key: 'maxPrep',
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
      key: 'maxCook',
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
      key: 'proteins',
      title: 'Which proteins this week?',
      subtitle:
        'This is often the biggest week-to-week change — pick any that sound good (or none for “anything”). Just for this week; your saved profile stays as-is.',
      control: (
        <ChipMultiSelect
          options={PROTEINS}
          values={answers.proteins}
          onToggle={(v) => patch({ proteins: toggle(answers.proteins, v as Protein) })}
        />
      ),
      canSkip: true,
    },
    {
      key: 'cuisines',
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
      key: 'healthyVsComfort',
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
      key: 'adventurousness',
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
      key: 'diets',
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
      key: 'pantry',
      title: 'Anything already at home?',
      subtitle: "I'll strongly build the week around these. Saved to your pantry for next time.",
      control: (
        <AutocompleteTagInput
          values={pantryItems}
          suggestions={INGREDIENT_SUGGESTIONS}
          onAdd={addPantry}
          onRemove={removePantry}
          placeholder="e.g. ground beef, spinach…"
        />
      ),
      canSkip: true,
    },
    {
      key: 'summary',
      title: 'You’re all set 🎉',
      subtitle: 'Here’s what I’ll plan around this week.',
      continueLabel: 'Build my week 🍳',
      control: <IntakeSummary answers={answers} profile={profile ?? createDefaultProfile()} />,
    },
  ];

  // M2.3 fast path: dinners, proteins, ingredients-on-hand only — everything
  // else carries over from last week's answers untouched. Selected by stable
  // key rather than array index so reordering/inserting a question above
  // can't silently change which steps the fast path shows.
  const FAST_STEP_KEYS = ['dinners', 'proteins', 'pantry'];
  const fastSteps = FAST_STEP_KEYS.map((key) => steps.find((s) => s.key === key)!);

  const finish = () => {
    const pantry = usePantryStore.getState().items;
    usePlanStore.getState().setIntake({ ...answers, ingredientsAtHome: pantry });
    usePlanStore.getState().generate();
    router.replace('/plan/review');
  };

  if (!initialized) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' }}
      >
        <ActivityIndicator color={theme.colors.accent} />
      </SafeAreaView>
    );
  }

  if (mode === 'choice' && previousIntake) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'left', 'right']}>
        <View style={{ flexDirection: 'row', paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.sm }}>
          <Pressable accessibilityLabel="Close" accessibilityRole="button" hitSlop={8} onPress={() => router.back()}>
            <Ionicons name="close" size={26} color={theme.colors.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: theme.spacing.xl, paddingTop: theme.spacing.md }}>
          <Text variant="largeTitle" style={{ marginBottom: theme.spacing.lg }}>
            Plan this week
          </Text>
          <Card style={{ marginBottom: theme.spacing.xl }}>
            <Text variant="body" color="secondary">
              {lastWeekSummary(previousIntake)}
            </Text>
          </Card>
          <PrimaryButton
            title="Same as last week — just update proteins & fridge"
            onPress={() => {
              setMode('fast');
              setIndex(0);
            }}
          />
          <SecondaryButton
            title="Adjust everything"
            onPress={() => {
              setMode('full');
              setIndex(0);
            }}
            style={{ marginTop: theme.spacing.md }}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const activeSteps = mode === 'fast' ? fastSteps : steps;
  const current = activeSteps[index];
  const isLast = index === activeSteps.length - 1;
  const canReturnToChoice = !!previousIntake;

  return (
    <QuestionScaffold
      step={index + 1}
      total={activeSteps.length}
      title={current.title}
      subtitle={current.subtitle}
      continueLabel={isLast ? 'Build my week 🍳' : current.continueLabel ?? 'Continue'}
      onContinue={() => (isLast ? finish() : setIndex(index + 1))}
      onClose={() => router.back()}
      onBack={index > 0 ? () => setIndex(index - 1) : canReturnToChoice ? () => setMode('choice') : undefined}
      onSkip={current.canSkip && !isLast ? () => setIndex(index + 1) : undefined}
    >
      {current.control}
    </QuestionScaffold>
  );
}

function IntakeSummary({ answers, profile }: { answers: IntakeAnswers; profile: Profile }) {
  const theme = useTheme();
  const pantryCount = usePantryStore((s) => s.items.length);
  const cuisines =
    answers.cuisines.length > 0
      ? answers.cuisines.map((c) => CUISINE_LABEL[c]).join(', ')
      : 'No preference (I’ll rotate)';
  const vibe = ['Healthy', 'Balanced', 'Comfort'][Math.round(answers.healthyVsComfort * 2)] ?? 'Balanced';

  const rows: [string, string][] = [
    ['Dinners', `${answers.dinners}`],
    ['Cooking for', describeHouseholdServings(profile)],
    ['Budget', `$${answers.budget}`],
    ['Time limit', `${answers.maxPrepMinutes}m prep · ${answers.maxCookMinutes}m cook`],
    ['Cuisines', cuisines],
    ['Proteins', answers.proteins.length > 0 ? answers.proteins.join(', ') : 'No preference'],
    ['Building around', pantryCount > 0 ? `${pantryCount} pantry item${pantryCount === 1 ? '' : 's'}` : 'Nothing on hand'],
    ['Style', vibe],
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
