import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { INGREDIENT_SUGGESTIONS } from '@/data/ingredientSuggestions';
import {
  BUDGET_OPTIONS,
  COMMON_ALLERGENS,
  COMMON_DIETS,
  COOK_TIME_OPTIONS,
  COOKING_SKILLS,
  CUISINES,
  PROTEINS,
  SPICE_LEVELS,
} from '@/domain/constants';
import { Cuisine, Difficulty, Protein, SpiceLevel } from '@/domain/models';
import { usePantryStore } from '@/stores/pantryStore';
import { useProfileStore } from '@/stores/profileStore';
import {
  AutocompleteTagInput,
  Card,
  ChipMultiSelect,
  ChipOption,
  ChipSingleSelect,
  SectionHeader,
  Screen,
  Stepper,
  Text,
} from '@/ui/components';
import { useTheme } from '@/ui/theme/useTheme';

function toggle<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
}

const toOptions = (values: string[]): ChipOption[] => values.map((v) => ({ value: v, label: v }));

export default function ProfileScreen() {
  const router = useRouter();
  const theme = useTheme();
  const profile = useProfileStore((s) => s.profile);
  const hydrated = useProfileStore((s) => s.hydrated);
  const update = useProfileStore((s) => s.update);
  const pantryItems = usePantryStore((s) => s.items);
  const addPantry = usePantryStore((s) => s.add);
  const removePantry = usePantryStore((s) => s.remove);

  const settingsButton = (
    <Pressable
      accessibilityLabel="Settings"
      accessibilityRole="button"
      hitSlop={8}
      onPress={() => router.push('/settings')}
    >
      <Ionicons name="settings-outline" size={24} color={theme.colors.text} />
    </Pressable>
  );

  if (!hydrated || !profile) {
    return (
      <Screen title="Profile" headerRight={settingsButton} scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="Profile" subtitle="The more I know, the better your plans" headerRight={settingsButton}>
      <SectionHeader title="Household" />
      <Card padded={false}>
        <RowField label="Family size">
          <Stepper
            value={profile.familySize}
            min={1}
            max={12}
            onChange={(familySize) => update({ familySize })}
          />
        </RowField>
        <StackField label="Cooking skill" last>
          <ChipSingleSelect
            options={COOKING_SKILLS}
            value={profile.cookingSkill}
            onChange={(v) => update({ cookingSkill: v as Difficulty })}
          />
        </StackField>
      </Card>

      <SectionHeader title="Food" />
      <Card padded={false}>
        <StackField label="Favorite cuisines">
          <ChipMultiSelect
            options={CUISINES}
            values={profile.favoriteCuisines}
            onToggle={(v) => update({ favoriteCuisines: toggle(profile.favoriteCuisines, v as Cuisine) })}
          />
        </StackField>
        <StackField label="Preferred proteins">
          <ChipMultiSelect
            options={PROTEINS}
            values={profile.preferredProteins}
            onToggle={(v) => update({ preferredProteins: toggle(profile.preferredProteins, v as Protein) })}
          />
        </StackField>
        <StackField label="Spice level">
          <ChipSingleSelect
            options={SPICE_LEVELS}
            value={profile.spiceLevel}
            onChange={(v) => update({ spiceLevel: v as SpiceLevel })}
          />
        </StackField>
        <StackField label="Dietary restrictions">
          <ChipMultiSelect
            options={toOptions(COMMON_DIETS)}
            values={profile.dietaryRestrictions}
            onToggle={(v) => update({ dietaryRestrictions: toggle(profile.dietaryRestrictions, v) })}
          />
        </StackField>
        <StackField label="Allergies" last>
          <ChipMultiSelect
            options={toOptions(COMMON_ALLERGENS)}
            values={profile.allergies}
            onToggle={(v) => update({ allergies: toggle(profile.allergies, v) })}
          />
        </StackField>
      </Card>

      <SectionHeader title="Planning" />
      <Card padded={false}>
        <StackField label="Weekly budget">
          <ChipSingleSelect
            options={BUDGET_OPTIONS.map((n) => ({ value: String(n), label: `$${n}` }))}
            value={String(profile.weeklyBudget)}
            onChange={(v) => update({ weeklyBudget: Number(v) })}
          />
        </StackField>
        <StackField label="Typical cooking time" last>
          <ChipSingleSelect
            options={COOK_TIME_OPTIONS.map((n) => ({ value: String(n), label: `${n} min` }))}
            value={String(profile.avgCookMinutes)}
            onChange={(v) => update({ avgCookMinutes: Number(v) })}
          />
        </StackField>
      </Card>

      <SectionHeader title="My Pantry" />
      <Card>
        <Text variant="subhead" color="secondary" style={{ marginBottom: theme.spacing.md }}>
          Ingredients you have on hand. I’ll build weeks around these to cut waste.
        </Text>
        <AutocompleteTagInput
          values={pantryItems}
          suggestions={INGREDIENT_SUGGESTIONS}
          onAdd={addPantry}
          onRemove={removePantry}
          placeholder="Add an ingredient…"
        />
      </Card>

      <Text variant="footnote" color="tertiary" center style={{ marginTop: theme.spacing.xl }}>
        Saved automatically · Store: H-E-B
      </Text>
    </Screen>
  );
}

/** Label and control side by side. */
function RowField({ label, children, last }: { label: string; children: ReactNode; last?: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.colors.separator,
      }}
    >
      <Text variant="body">{label}</Text>
      {children}
    </View>
  );
}

/** Label above a wrapping control (chips). */
function StackField({ label, children, last }: { label: string; children: ReactNode; last?: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.colors.separator,
      }}
    >
      <Text variant="subhead" color="secondary" style={{ marginBottom: theme.spacing.md }}>
        {label}
      </Text>
      {children}
    </View>
  );
}
