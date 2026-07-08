import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { INGREDIENT_DEPARTMENT_MAP } from '@/data/ingredientSuggestions';
import { RECIPE_INGREDIENT_NAMES } from '@/data/seed/recipes';
import { COMMON_ALLERGENS, CUISINES, DEPARTMENT_LABELS, DEPARTMENT_ORDER, PROTEINS, UNITS } from '@/domain/constants';
import { Cuisine, Department, Protein, RecipeIngredient, Unit } from '@/domain/models';
import { guessDepartment } from '@/engine/manualItems';
import { inferAllergensFromIngredients, UserRecipeInput, validateUserRecipeInput } from '@/engine/userRecipes';
import { useTheme } from '@/ui/theme/useTheme';

import { ChipMultiSelect } from './ChipMultiSelect';
import { ChipSingleSelect } from './ChipSingleSelect';
import { PrimaryButton } from './PrimaryButton';
import { SecondaryButton } from './SecondaryButton';
import { SectionHeader } from './SectionHeader';
import { Stepper } from './Stepper';
import { Text } from './Text';

const fieldStyle = (theme: ReturnType<typeof useTheme>) => ({
  borderWidth: 1,
  borderColor: theme.colors.border,
  borderRadius: theme.radius.md,
  paddingVertical: theme.spacing.sm,
  paddingHorizontal: theme.spacing.md,
  fontSize: 17,
  color: theme.colors.text,
});

interface IngredientDraft {
  key: string;
  name: string;
  quantity: string;
  unit: Unit;
  department: Department;
}

let draftKeyCounter = 0;
const nextKey = () => {
  draftKeyCounter += 1;
  return `draft-${draftKeyCounter}`;
};

function toDrafts(ingredients: RecipeIngredient[]): IngredientDraft[] {
  return ingredients.map((i) => ({
    key: nextKey(),
    name: i.name,
    quantity: String(i.quantity),
    unit: i.unit,
    department: i.department,
  }));
}

interface Props {
  initial?: UserRecipeInput;
  submitLabel: string;
  onSubmit: (input: UserRecipeInput) => void;
  /** Only shown in edit mode. */
  onDelete?: () => void;
}

/** Shared "Add/edit recipe" form (M3.5) — used by app/recipe/new.tsx and
 * app/recipe/edit/[id].tsx so the two screens don't duplicate the whole form. */
export function RecipeForm({ initial, submitLabel, onSubmit, onDelete }: Props) {
  const theme = useTheme();

  const [name, setName] = useState(initial?.name ?? '');
  const [cuisine, setCuisine] = useState<Cuisine>(initial?.cuisine ?? 'American');
  const [primaryProtein, setPrimaryProtein] = useState<Protein>(initial?.primaryProtein ?? 'Chicken');
  const [baseServings, setBaseServings] = useState(initial?.baseServings ?? 4);
  const [prepMinutes, setPrepMinutes] = useState(initial?.prepMinutes ?? 15);
  const [cookMinutes, setCookMinutes] = useState(initial?.cookMinutes ?? 20);
  const [description, setDescription] = useState(initial?.description ?? '');
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(() => toDrafts(initial?.ingredients ?? []));
  const [steps, setSteps] = useState<string[]>(initial?.steps ?? ['', '', '']);
  const [tips, setTips] = useState<string[]>(initial?.tips ?? []);
  const [allergens, setAllergens] = useState<string[]>(
    initial?.allergens ?? inferAllergensFromIngredients(initial?.ingredients ?? []),
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [ingredientQuery, setIngredientQuery] = useState('');

  const ingredientSuggestions = useMemo(() => {
    const q = ingredientQuery.trim().toLowerCase();
    if (!q) return [];
    const have = new Set(ingredients.map((i) => i.name.trim().toLowerCase()));
    return RECIPE_INGREDIENT_NAMES.filter((n) => n.toLowerCase().includes(q) && !have.has(n.toLowerCase())).slice(0, 6);
  }, [ingredientQuery, ingredients]);

  const addIngredient = (rawName: string) => {
    const trimmed = rawName.trim();
    if (!trimmed) return;
    setIngredients((prev) => [
      ...prev,
      {
        key: nextKey(),
        name: trimmed,
        quantity: '1',
        unit: 'piece',
        department: guessDepartment(trimmed, INGREDIENT_DEPARTMENT_MAP),
      },
    ]);
    setIngredientQuery('');
  };

  const updateIngredient = (key: string, patch: Partial<IngredientDraft>) => {
    setIngredients((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  };

  const removeIngredient = (key: string) => {
    setIngredients((prev) => prev.filter((i) => i.key !== key));
  };

  const updateStep = (index: number, value: string) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? value : s)));
  };

  const removeStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    setSteps((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const updateTip = (index: number, value: string) => {
    setTips((prev) => prev.map((t, i) => (i === index ? value : t)));
  };

  const removeTip = (index: number) => {
    setTips((prev) => prev.filter((_, i) => i !== index));
  };

  const suggestAllergens = () => {
    const suggested = inferAllergensFromIngredients(toRecipeIngredients(ingredients));
    setAllergens((prev) => Array.from(new Set([...prev, ...suggested])));
  };

  const handleSubmit = () => {
    const input: UserRecipeInput = {
      name,
      cuisine,
      primaryProtein,
      baseServings,
      prepMinutes,
      cookMinutes,
      ingredients: toRecipeIngredients(ingredients),
      steps,
      description: description.trim() || undefined,
      tips: tips.filter((t) => t.trim().length > 0),
      allergens,
    };
    const validationErrors = validateUserRecipeInput(input);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors([]);
    onSubmit(input);
  };

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <View>
        <SectionHeader title="Name" />
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Grandma's Chicken Soup"
          placeholderTextColor={theme.colors.textTertiary}
          style={fieldStyle(theme)}
        />
      </View>

      <View>
        <SectionHeader title="Cuisine" />
        <ChipSingleSelect options={CUISINES} value={cuisine} onChange={(v) => setCuisine(v as Cuisine)} />
      </View>

      <View>
        <SectionHeader title="Main protein" />
        <ChipSingleSelect options={PROTEINS} value={primaryProtein} onChange={(v) => setPrimaryProtein(v as Protein)} />
      </View>

      <View style={{ flexDirection: 'row', gap: theme.spacing.xl }}>
        <View>
          <SectionHeader title="Servings" />
          <Stepper value={baseServings} min={1} max={12} onChange={setBaseServings} />
        </View>
        <View>
          <SectionHeader title="Prep (min)" />
          <Stepper value={prepMinutes} min={0} max={180} step={5} onChange={setPrepMinutes} />
        </View>
        <View>
          <SectionHeader title="Cook (min)" />
          <Stepper value={cookMinutes} min={0} max={240} step={5} onChange={setCookMinutes} />
        </View>
      </View>

      <View>
        <SectionHeader title="Ingredients" />
        {ingredients.map((ing) => (
          <View
            key={ing.key}
            style={{
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.md,
              padding: theme.spacing.md,
              marginBottom: theme.spacing.sm,
              gap: theme.spacing.sm,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <TextInput
                value={ing.name}
                onChangeText={(v) => updateIngredient(ing.key, { name: v })}
                placeholder="Ingredient name"
                placeholderTextColor={theme.colors.textTertiary}
                style={[fieldStyle(theme), { flex: 1 }]}
              />
              <Pressable accessibilityLabel="Remove ingredient" hitSlop={8} onPress={() => removeIngredient(ing.key)}>
                <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
              </Pressable>
            </View>
            <TextInput
              value={ing.quantity}
              onChangeText={(v) => updateIngredient(ing.key, { quantity: v })}
              placeholder="Amount"
              placeholderTextColor={theme.colors.textTertiary}
              keyboardType="numeric"
              style={[fieldStyle(theme), { width: 100 }]}
            />
            <ChipSingleSelect
              options={UNITS}
              value={ing.unit}
              onChange={(v) => updateIngredient(ing.key, { unit: v as Unit })}
            />
            <ChipSingleSelect
              options={DEPARTMENT_ORDER.map((d) => ({ value: d, label: DEPARTMENT_LABELS[d] }))}
              value={ing.department}
              onChange={(v) => updateIngredient(ing.key, { department: v as Department })}
            />
          </View>
        ))}

        <TextInput
          value={ingredientQuery}
          onChangeText={setIngredientQuery}
          onSubmitEditing={() => addIngredient(ingredientQuery)}
          placeholder="Add an ingredient…"
          placeholderTextColor={theme.colors.textTertiary}
          returnKeyType="done"
          style={fieldStyle(theme)}
        />
        {ingredientSuggestions.length > 0 || ingredientQuery.trim().length > 0 ? (
          <View
            style={{
              marginTop: theme.spacing.sm,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: theme.colors.border,
              overflow: 'hidden',
            }}
          >
            {ingredientSuggestions.map((s, i) => (
              <Pressable
                key={s}
                onPress={() => addIngredient(s)}
                style={{
                  paddingVertical: theme.spacing.md,
                  paddingHorizontal: theme.spacing.md,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: theme.colors.separator,
                }}
              >
                <Text variant="body">{s}</Text>
              </Pressable>
            ))}
            {ingredientQuery.trim().length > 0 ? (
              <Pressable
                onPress={() => addIngredient(ingredientQuery)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                  paddingVertical: theme.spacing.md,
                  paddingHorizontal: theme.spacing.md,
                  borderTopWidth: ingredientSuggestions.length === 0 ? 0 : 1,
                  borderTopColor: theme.colors.separator,
                }}
              >
                <Ionicons name="add-circle-outline" size={18} color={theme.colors.accent} />
                <Text variant="body" color="accent">
                  Add “{ingredientQuery.trim()}”
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      <View>
        <SectionHeader title="Steps" />
        {steps.map((step, i) => (
          <View
            key={i}
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: theme.spacing.sm,
              marginBottom: theme.spacing.sm,
            }}
          >
            <Text variant="headline" color="accent" style={{ width: 24, marginTop: theme.spacing.sm }}>
              {i + 1}
            </Text>
            <TextInput
              value={step}
              onChangeText={(v) => updateStep(i, v)}
              placeholder="What do you do in this step?"
              placeholderTextColor={theme.colors.textTertiary}
              multiline
              style={[fieldStyle(theme), { flex: 1, minHeight: 44 }]}
            />
            <View style={{ gap: 4 }}>
              <Pressable accessibilityLabel="Move step up" hitSlop={6} disabled={i === 0} onPress={() => moveStep(i, -1)}>
                <Ionicons name="chevron-up" size={18} color={i === 0 ? theme.colors.textTertiary : theme.colors.text} />
              </Pressable>
              <Pressable
                accessibilityLabel="Move step down"
                hitSlop={6}
                disabled={i === steps.length - 1}
                onPress={() => moveStep(i, 1)}
              >
                <Ionicons
                  name="chevron-down"
                  size={18}
                  color={i === steps.length - 1 ? theme.colors.textTertiary : theme.colors.text}
                />
              </Pressable>
              <Pressable accessibilityLabel="Remove step" hitSlop={6} onPress={() => removeStep(i)}>
                <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
              </Pressable>
            </View>
          </View>
        ))}
        <SecondaryButton title="+ Add step" onPress={() => setSteps((prev) => [...prev, ''])} />
      </View>

      <View>
        <SectionHeader title="Description (optional)" />
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="A sentence or two about the dish."
          placeholderTextColor={theme.colors.textTertiary}
          multiline
          style={[fieldStyle(theme), { minHeight: 60 }]}
        />
      </View>

      <View>
        <SectionHeader title="Tips (optional)" />
        {tips.map((tip, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.sm }}>
            <TextInput
              value={tip}
              onChangeText={(v) => updateTip(i, v)}
              placeholder="A substitution, make-ahead note, etc."
              placeholderTextColor={theme.colors.textTertiary}
              style={[fieldStyle(theme), { flex: 1 }]}
            />
            <Pressable accessibilityLabel="Remove tip" hitSlop={8} onPress={() => removeTip(i)}>
              <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
            </Pressable>
          </View>
        ))}
        <SecondaryButton title="+ Add tip" onPress={() => setTips((prev) => [...prev, ''])} />
      </View>

      <View>
        <SectionHeader title="Allergens" />
        <Text variant="footnote" color="secondary" style={{ marginBottom: theme.spacing.sm }}>
          Guessed from your ingredients — double-check these, especially if anyone in the family has an allergy.
        </Text>
        <ChipMultiSelect
          options={COMMON_ALLERGENS.map((a) => ({ value: a, label: a }))}
          values={allergens}
          onToggle={(v) => setAllergens((prev) => (prev.includes(v) ? prev.filter((a) => a !== v) : [...prev, v]))}
        />
        <Pressable onPress={suggestAllergens} style={{ marginTop: theme.spacing.sm }}>
          <Text variant="footnote" color="accent">
            🔍 Re-check ingredients for allergens
          </Text>
        </Pressable>
      </View>

      {errors.length > 0 ? (
        <View>
          {errors.map((e) => (
            <Text key={e} variant="footnote" color="danger">
              {e}
            </Text>
          ))}
        </View>
      ) : null}

      <PrimaryButton title={submitLabel} onPress={handleSubmit} />
      {onDelete ? <SecondaryButton title="Delete recipe" onPress={onDelete} /> : null}
    </View>
  );
}

function toRecipeIngredients(drafts: IngredientDraft[]): RecipeIngredient[] {
  return drafts.map((d) => ({
    name: d.name.trim(),
    quantity: Number(d.quantity) || 1,
    unit: d.unit,
    department: d.department,
  }));
}
