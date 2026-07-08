import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { unratedMeals } from '@/engine/rating';
import { usePlanStore } from '@/stores/planStore';
import { useRecipesById } from '@/stores/userRecipesStore';
import {
  Card,
  ChipMultiSelect,
  ChipOption,
  QuestionScaffold,
  StarRating,
  Text,
  YesNoToggle,
} from '@/ui/components';
import { useTheme } from '@/ui/theme/useTheme';

interface Draft {
  cooked?: boolean;
  enjoyment?: number;
  cookAgain?: boolean;
  familyAgain?: boolean;
  flags: string[];
}

/** `flags` can be missing if a draft was only ever updated via `cooked`/`enjoyment` patches. */
function normalizeDraft(draft: Draft | undefined): Draft {
  return draft ? { ...draft, flags: draft.flags ?? [] } : { flags: [] };
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
  const rateMeal = usePlanStore((s) => s.rateMeal);
  const recipesById = useRecipesById();

  const allMeals = plan ? [...plan.meals].sort((a, b) => a.dayIndex - b.dayIndex) : [];
  const meals = unratedMeals(allMeals);
  const [index, setIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const initial: Record<string, Draft> = {};
    for (const m of meals) initial[m.recipeId] = { cooked: m.cooked, flags: [] };
    return initial;
  });

  if (!plan || allMeals.length === 0) {
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

  // Rate-as-you-go (M2.1): the wizard is only a catch-up for whatever hasn't
  // been rated yet — once every meal has a rating, there's nothing to walk
  // through, just a read-only recap.
  if (meals.length === 0) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        edges={['top', 'left', 'right']}
      >
        <View
          style={{
            flexDirection: 'row',
            paddingHorizontal: theme.spacing.xl,
            paddingTop: theme.spacing.sm,
          }}
        >
          <Pressable accessibilityLabel="Close" accessibilityRole="button" hitSlop={8} onPress={() => router.dismissAll()}>
            <Ionicons name="close" size={26} color={theme.colors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: theme.spacing.xl }} showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: 'center', marginBottom: theme.spacing.xl }}>
            <Text style={{ fontSize: 44, lineHeight: 52 }}>⭐</Text>
            <Text variant="title2" center style={{ marginTop: theme.spacing.md }}>
              You've rated every meal this week
            </Text>
            <Text variant="body" color="secondary" center style={{ marginTop: theme.spacing.sm }}>
              Thanks for the feedback — it's already shaping next week's picks.
            </Text>
          </View>

          <Text variant="footnote" color="secondary" style={{ marginBottom: theme.spacing.sm }}>
            WHAT YOU SAID
          </Text>
          <Card padded={false}>
            {allMeals.map((m, i) => {
              const recipe = recipesById[m.recipeId];
              const stars =
                typeof m.rating === 'number' ? '★'.repeat(m.rating) + '☆'.repeat(5 - m.rating) : '—';
              return (
                <View
                  key={m.recipeId}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingVertical: theme.spacing.md,
                    paddingHorizontal: theme.spacing.lg,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: theme.colors.separator,
                  }}
                >
                  <Text variant="body">{recipe?.name ?? 'Unknown recipe'}</Text>
                  <Text variant="subhead" color="secondary">
                    {stars}
                  </Text>
                </View>
              );
            })}
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const meal = meals[index];
  const recipe = recipeFor(meal);
  const draft = normalizeDraft(drafts[meal.recipeId]);
  const isLast = index === meals.length - 1;

  const update = (patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [meal.recipeId]: { ...d[meal.recipeId], ...patch } }));

  const finish = (allDrafts: Record<string, Draft>) => {
    for (const m of meals) {
      const a = normalizeDraft(allDrafts[m.recipeId]);
      if (!a.cooked || typeof a.enjoyment !== 'number') continue;
      rateMeal(m.dayIndex, a.enjoyment as 1 | 2 | 3 | 4 | 5, {
        cooked: true,
        cookAgain: a.cookAgain,
        familyAgain: a.familyAgain,
        tooMuchPrep: a.flags.includes('prep'),
        tooExpensive: a.flags.includes('pricey'),
        tooSpicy: a.flags.includes('spicy'),
        tooBland: a.flags.includes('bland'),
        tooManyLeftovers: a.flags.includes('leftovers'),
      });
    }
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
