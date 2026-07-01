import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { RatingEvent } from '@/domain/models';
import { useLearningStore } from '@/stores/learningStore';
import { usePlanStore } from '@/stores/planStore';
import {
  ChipMultiSelect,
  ChipOption,
  QuestionScaffold,
  StarRating,
  Text,
  YesNoToggle,
} from '@/ui/components';
import { useTheme } from '@/ui/theme/useTheme';
import { createId } from '@/utils/id';

interface Draft {
  cooked?: boolean;
  enjoyment?: number;
  cookAgain?: boolean;
  familyAgain?: boolean;
  flags: string[];
}

const FLAG_OPTIONS: ChipOption[] = [
  { value: 'prep', label: 'Too much prep' },
  { value: 'pricey', label: 'Too pricey' },
  { value: 'spicy', label: 'Too spicy' },
  { value: 'bland', label: 'Too bland' },
  { value: 'leftovers', label: 'Too many leftovers' },
];

export default function WeeklyReviewScreen() {
  const router = useRouter();
  const theme = useTheme();
  const plan = usePlanStore((s) => s.plan);
  const recipeFor = usePlanStore((s) => s.recipeFor);
  const submitReview = useLearningStore((s) => s.submitReview);

  const meals = plan ? [...plan.meals].sort((a, b) => a.dayIndex - b.dayIndex) : [];
  const [index, setIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const initial: Record<string, Draft> = {};
    for (const m of meals) initial[m.recipeId] = { cooked: m.cooked, flags: [] };
    return initial;
  });

  if (!plan || meals.length === 0) {
    return (
      <QuestionScaffold
        step={1}
        total={1}
        title="Nothing to review yet"
        onContinue={() => router.dismissAll()}
        onClose={() => router.dismissAll()}
        continueLabel="Close"
      >
        <Text variant="body" color="secondary">
          Approve a weekly plan first, then come back to rate your meals.
        </Text>
      </QuestionScaffold>
    );
  }

  const meal = meals[index];
  const recipe = recipeFor(meal);
  const draft = drafts[meal.recipeId] ?? { flags: [] };
  const isLast = index === meals.length - 1;

  const update = (patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [meal.recipeId]: { ...d[meal.recipeId], ...patch } }));

  const finish = (allDrafts: Record<string, Draft>) => {
    const now = new Date().toISOString();
    const events: RatingEvent[] = meals.map((m) => {
      const a = allDrafts[m.recipeId] ?? { flags: [] };
      return {
        id: createId(),
        planId: plan.id,
        recipeId: m.recipeId,
        cooked: a.cooked ?? false,
        enjoyment: a.enjoyment,
        cookAgain: a.cookAgain,
        familyAgain: a.familyAgain,
        tooMuchPrep: a.flags.includes('prep'),
        tooExpensive: a.flags.includes('pricey'),
        tooSpicy: a.flags.includes('spicy'),
        tooBland: a.flags.includes('bland'),
        tooManyLeftovers: a.flags.includes('leftovers'),
        ratedAtISO: now,
      };
    });
    submitReview(events);
    router.dismissAll();
  };

  const onContinue = () => {
    if (isLast) finish(drafts);
    else setIndex(index + 1);
  };

  return (
    <QuestionScaffold
      step={index + 1}
      total={meals.length}
      title={recipe?.name ?? 'This meal'}
      subtitle={recipe ? `${recipe.cuisine} · rate to improve next week` : undefined}
      continueLabel={isLast ? 'Finish' : 'Next meal'}
      onContinue={onContinue}
      onClose={() => router.dismissAll()}
      onBack={index > 0 ? () => setIndex(index - 1) : undefined}
      onSkip={!isLast ? () => setIndex(index + 1) : undefined}
    >
      <Field label="Did you cook it?">
        <YesNoToggle value={draft.cooked} onChange={(cooked) => update({ cooked })} />
      </Field>

      {draft.cooked ? (
        <>
          <Field label="How much did you enjoy it?">
            <StarRating value={draft.enjoyment ?? 0} onChange={(enjoyment) => update({ enjoyment })} />
          </Field>
          <Field label="Cook it again?">
            <YesNoToggle value={draft.cookAgain} onChange={(cookAgain) => update({ cookAgain })} />
          </Field>
          <Field label="Would the family want it again?">
            <YesNoToggle value={draft.familyAgain} onChange={(familyAgain) => update({ familyAgain })} />
          </Field>
          <Field label="Anything off? (optional)">
            <ChipMultiSelect
              options={FLAG_OPTIONS}
              values={draft.flags}
              onToggle={(v) =>
                update({
                  flags: draft.flags.includes(v)
                    ? draft.flags.filter((f) => f !== v)
                    : [...draft.flags, v],
                })
              }
            />
          </Field>
        </>
      ) : null}
    </QuestionScaffold>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: theme.spacing.xl }}>
      <Text variant="subhead" color="secondary" style={{ marginBottom: theme.spacing.md }}>
        {label}
      </Text>
      {children}
    </View>
  );
}
