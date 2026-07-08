import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { parseDurationMinutes } from '@/engine/cookMode';
import { cookModeKey, useCookModeStore } from '@/stores/cookModeStore';
import { usePlanStore } from '@/stores/planStore';
import { useRecipesById } from '@/stores/userRecipesStore';
import { Card, EmptyState, PrimaryButton, ProgressBar, StarRating, Text } from '@/ui/components';
import { useTheme } from '@/ui/theme/useTheme';

interface TimerState {
  minutes: number;
  remainingSeconds: number;
  status: 'running' | 'done';
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function CookModeScreen() {
  useKeepAwake();
  const router = useRouter();
  const theme = useTheme();
  const { dayIndex: dayIndexParam } = useLocalSearchParams<{ dayIndex: string }>();
  const dayIndex = Number(dayIndexParam);

  const plan = usePlanStore((s) => s.plan);
  const toggleCooked = usePlanStore((s) => s.toggleCooked);
  const rateMeal = usePlanStore((s) => s.rateMeal);
  // Select the actual `steps` state (not the `setStep` action, which is a
  // stable reference and wouldn't re-render this screen when it changes).
  const cookModeSteps = useCookModeStore((s) => s.steps);
  const setStep = useCookModeStore((s) => s.setStep);

  const recipesById = useRecipesById();
  const meal = plan?.meals.find((m) => m.dayIndex === dayIndex);
  const recipe = meal ? recipesById[meal.recipeId] : undefined;
  const key = plan && meal ? cookModeKey(plan.id, dayIndex) : '';

  const savedStep = key ? (cookModeSteps[key] ?? 0) : 0;
  const stepIndex = recipe ? Math.max(0, Math.min(savedStep, recipe.steps.length - 1)) : 0;

  const [showIngredients, setShowIngredients] = useState(false);
  const [timer, setTimer] = useState<TimerState | null>(null);

  useEffect(() => {
    if (timer?.status !== 'running') return;
    const id = setInterval(() => {
      setTimer((t) => {
        if (!t || t.status !== 'running') return t;
        if (t.remainingSeconds <= 1) {
          Vibration.vibrate(500);
          return { ...t, remainingSeconds: 0, status: 'done' };
        }
        return { ...t, remainingSeconds: t.remainingSeconds - 1 };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timer?.status]);

  if (!plan || !meal || !recipe) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <EmptyState emoji="🍳" title="Nothing to cook" body="This meal isn't on your current plan." />
      </SafeAreaView>
    );
  }

  const isLastStep = stepIndex === recipe.steps.length - 1;
  const goToStep = (index: number) => setStep(key, Math.max(0, Math.min(index, recipe.steps.length - 1)));
  const next = () => goToStep(stepIndex + 1);
  const back = () => goToStep(stepIndex - 1);

  const parsedMinutes = parseDurationMinutes(recipe.steps[stepIndex]);
  const startTimer = (minutes: number) =>
    setTimer({ minutes, remainingSeconds: minutes * 60, status: 'running' });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.spacing.xl,
          paddingTop: theme.spacing.sm,
          paddingBottom: theme.spacing.md,
        }}
      >
        <Pressable
          accessibilityLabel="Exit cook mode"
          hitSlop={8}
          onPress={() => router.back()}
          style={{ flexDirection: 'row', alignItems: 'center' }}
        >
          <Ionicons name="chevron-down" size={22} color={theme.colors.accent} />
          <Text variant="body" color="accent">
            Exit
          </Text>
        </Pressable>
        <Text variant="subhead" color="secondary">
          Step {stepIndex + 1} of {recipe.steps.length}
        </Text>
        <Pressable
          accessibilityLabel="Show ingredients"
          hitSlop={8}
          onPress={() => setShowIngredients(true)}
          style={{ flexDirection: 'row', alignItems: 'center' }}
        >
          <Text variant="body" color="accent">
            🥕 Ingredients
          </Text>
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: theme.spacing.xl }}>
        <ProgressBar progress={(stepIndex + 1) / recipe.steps.length} />
      </View>

      {timer ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginHorizontal: theme.spacing.xl,
            marginTop: theme.spacing.md,
            padding: theme.spacing.md,
            borderRadius: theme.radius.lg,
            backgroundColor: timer.status === 'done' ? theme.colors.accentMuted : theme.colors.card,
          }}
        >
          <Text variant="headline" color={timer.status === 'done' ? 'accent' : 'primary'}>
            {timer.status === 'done' ? `⏰ Time's up! (${timer.minutes} min)` : `⏱ ${formatClock(timer.remainingSeconds)}`}
          </Text>
          <Pressable onPress={() => setTimer(null)} hitSlop={8}>
            <Ionicons name="close-circle" size={22} color={theme.colors.textTertiary} />
          </Pressable>
        </View>
      ) : null}

      <Pressable onPress={next} style={{ flex: 1, justifyContent: 'center', padding: theme.spacing.xl }}>
        <Text variant="title2">{recipe.steps[stepIndex]}</Text>

        {parsedMinutes ? (
          <Pressable
            onPress={() => startTimer(parsedMinutes)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              alignSelf: 'flex-start',
              marginTop: theme.spacing.xl,
              paddingVertical: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.accentMuted,
            }}
          >
            <Ionicons name="timer-outline" size={20} color={theme.colors.accent} />
            <Text variant="body" color="accent">
              Start {parsedMinutes} min timer
            </Text>
          </Pressable>
        ) : null}

        {isLastStep ? (
          <Card style={{ marginTop: theme.spacing.xl }}>
            <Text variant="headline">How was it?</Text>
            <View style={{ marginTop: theme.spacing.sm }}>
              <StarRating
                value={meal.rating ?? 0}
                onChange={(rating) => rateMeal(meal.dayIndex, rating as 1 | 2 | 3 | 4 | 5)}
              />
            </View>
            <PrimaryButton
              title={meal.cooked ? '✓ Cooked' : 'Mark cooked'}
              onPress={() => toggleCooked(meal.dayIndex)}
              style={{ marginTop: theme.spacing.lg }}
            />
          </Card>
        ) : null}
      </Pressable>

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: theme.spacing.xl,
          paddingBottom: theme.spacing.lg,
        }}
      >
        <Pressable onPress={back} hitSlop={8} disabled={stepIndex === 0}>
          <Text variant="body" color={stepIndex === 0 ? 'tertiary' : 'accent'}>
            ← Back
          </Text>
        </Pressable>
        <Pressable onPress={next} hitSlop={8} disabled={isLastStep}>
          <Text variant="body" color={isLastStep ? 'tertiary' : 'accent'}>
            Next step →
          </Text>
        </Pressable>
      </View>

      {showIngredients ? (
        <Pressable
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            justifyContent: 'flex-end',
          }}
          onPress={() => setShowIngredients(false)}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: theme.colors.card,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              padding: theme.spacing.xl,
              maxHeight: '70%',
            }}
          >
            <Text variant="title3" style={{ marginBottom: theme.spacing.md }}>
              Ingredients
            </Text>
            <ScrollView>
              {recipe.ingredients.map((ing, i) => (
                <View
                  key={`${ing.name}-${i}`}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingVertical: theme.spacing.sm,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: theme.colors.separator,
                  }}
                >
                  <Text variant="body" style={{ flex: 1 }}>
                    {ing.name}
                    {ing.optional ? ' (optional)' : ''}
                  </Text>
                  <Text variant="body" color="secondary">
                    {ing.quantity} {ing.unit}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}
