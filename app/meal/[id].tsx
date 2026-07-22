import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, TextInput, View } from 'react-native';

import { RECIPE_IMAGE_ATTRIBUTION } from '@/data/recipeImages';
import { isMain } from '@/domain/models';
import { formatServings } from '@/engine/portions';
import { isUserRecipe } from '@/engine/userRecipes';
import { useLearningStore } from '@/stores/learningStore';
import { usePlanStore } from '@/stores/planStore';
import { useRecipeNotesStore } from '@/stores/recipeNotesStore';
import { useRecipesById, useUserRecipesStore } from '@/stores/userRecipesStore';
import {
  Card,
  EmptyState,
  PrimaryButton,
  RecipeImage,
  RemoveSideShoppingListPrompt,
  Screen,
  SecondaryButton,
  ServingsShoppingListPrompt,
  StarRating,
  Stepper,
  Text,
} from '@/ui/components';
import { useTheme } from '@/ui/theme/useTheme';

export default function MealDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { id, pinTarget: pinTargetParam } = useLocalSearchParams<{ id: string; pinTarget?: string }>();
  const pinTarget = pinTargetParam === 'draft' ? 'draft' : 'plan';
  const recipesById = useRecipesById();
  const recipe = id ? recipesById[id] : undefined;
  const deleteRecipe = useUserRecipesStore((s) => s.deleteRecipe);
  const favorites = useLearningStore((s) => s.favorites);
  const toggleFavorite = useLearningStore((s) => s.toggleFavorite);
  const kidApproved = useLearningStore((s) => s.kidApproved);
  const toggleKidApproved = useLearningStore((s) => s.toggleKidApproved);
  const plan = usePlanStore((s) => s.plan);
  const draftPlan = usePlanStore((s) => s.draftPlan);
  const toggleCooked = usePlanStore((s) => s.toggleCooked);
  const rateMeal = usePlanStore((s) => s.rateMeal);
  const setApprovedMealServings = usePlanStore((s) => s.setApprovedMealServings);
  const removeSideFromMeal = usePlanStore((s) => s.removeSideFromMeal);
  // M4.4: subscribe to the data (notesMap), not a lookup function — the
  // M4.0a lesson, see recipeNotesStore's doc comment.
  const notesMap = useRecipeNotesStore((s) => s.notesMap);
  const setNote = useRecipeNotesStore((s) => s.setNote);
  // Law #5, store-level guard already covers pinning itself — this is just
  // the UI reflecting the same invariant: a side/sauce opened from a plate
  // is never independently pinnable as a whole dinner.
  const canPin = !!(pinTarget === 'draft' ? draftPlan : plan) && (recipe ? isMain(recipe) : true);
  // M4.1: the servings value just before the most recent change on this
  // screen — see app/(tabs)/index.tsx for why this is local-only, not
  // persisted. Every meal shown here is on the approved plan (`plannedMeal`
  // only resolves from `plan.status === 'approved'`), so a change here
  // always needs the confirmation, never the no-confirm draft path.
  const [oldServings, setOldServings] = useState<number | null>(null);
  // M4.2 part 2: which side (if any) was just removed from the plate,
  // waiting on the separate, explicit shopping-list confirm.
  const [removingSideId, setRemovingSideId] = useState<string | null>(null);
  // M4.4: whether the family-notes editor is open, and its in-progress text.
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');

  const photoAttribution = recipe ? RECIPE_IMAGE_ATTRIBUTION[recipe.id] : undefined;
  const isFavorite = recipe ? favorites.includes(recipe.id) : false;
  const isKidApproved = recipe ? kidApproved.includes(recipe.id) : false;
  const plannedMeal =
    recipe && plan?.status === 'approved'
      ? plan.meals.find((m) => m.recipeId === recipe.id)
      : undefined;
  const isOwnRecipe = recipe ? isUserRecipe(recipe.id) : false;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Empty text is the M4.4 tombstone for "cleared" — treat it as no note.
  const noteText = recipe ? notesMap[recipe.id]?.text ?? '' : '';

  const header = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: theme.spacing.md,
      }}
    >
      <Pressable
        accessibilityLabel="Back"
        hitSlop={8}
        onPress={() => router.back()}
        style={{ flexDirection: 'row', alignItems: 'center' }}
      >
        <Ionicons name="chevron-back" size={26} color={theme.colors.accent} />
        <Text variant="body" color="accent">
          Back
        </Text>
      </Pressable>
      {recipe ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.lg }}>
          {isOwnRecipe ? (
            <Pressable
              accessibilityLabel="Edit recipe"
              hitSlop={8}
              onPress={() => router.push({ pathname: '/recipe/edit/[id]', params: { id: recipe.id } })}
            >
              <Ionicons name="pencil-outline" size={24} color={theme.colors.textTertiary} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityLabel={isKidApproved ? 'Remove Kids approved' : 'Mark Kids approved'}
            hitSlop={8}
            onPress={() => toggleKidApproved(recipe.id)}
          >
            <Ionicons
              name={isKidApproved ? 'happy' : 'happy-outline'}
              size={26}
              color={isKidApproved ? theme.colors.success : theme.colors.textTertiary}
            />
          </Pressable>
          <Pressable
            accessibilityLabel={isFavorite ? 'Remove favorite' : 'Add favorite'}
            hitSlop={8}
            onPress={() => toggleFavorite(recipe.id)}
          >
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={26}
              color={isFavorite ? theme.colors.danger : theme.colors.textTertiary}
            />
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  if (!recipe) {
    return (
      <Screen>
        {header}
        <EmptyState emoji="🍽️" title="Recipe not found" />
      </Screen>
    );
  }

  const stats: [string, string][] = [
    [`${recipe.prepMinutes}m`, 'prep'],
    [`${recipe.cookMinutes}m`, 'cook'],
    [`${recipe.nutrition.calories}`, 'cal'],
    [`${recipe.nutrition.protein}g`, 'protein'],
  ];

  return (
    <Screen>
      {header}

      <View style={{ marginBottom: theme.spacing.lg }}>
        <RecipeImage recipe={recipe} height={180} emojiSize={64} radius={theme.radius.xl} />
        {photoAttribution ? (
          <Pressable
            disabled={!photoAttribution.attributionUrl}
            onPress={() => photoAttribution.attributionUrl && Linking.openURL(photoAttribution.attributionUrl)}
          >
            <Text
              variant="caption"
              color="tertiary"
              style={{ marginTop: theme.spacing.xs }}
            >
              Photo: {photoAttribution.attribution}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Text variant="largeTitle">{recipe.name}</Text>
      <Text variant="subhead" color="secondary" style={{ marginTop: theme.spacing.xs }}>
        {recipe.cuisine} · {recipe.difficulty}
        {recipe.spiceLevel !== 'None' ? ` · ${recipe.spiceLevel} spice` : ''}
      </Text>
      {isKidApproved ? (
        <Text variant="footnote" color="success" style={{ marginTop: theme.spacing.xs }}>
          😊 Kids approved
        </Text>
      ) : null}
      {isOwnRecipe ? (
        <Text variant="footnote" color="tertiary" style={{ marginTop: theme.spacing.xs }}>
          🏠 Your recipe — saved on this device only
        </Text>
      ) : null}
      {recipe.description ? (
        <Text variant="body" color="secondary" style={{ marginTop: theme.spacing.md }}>
          {recipe.description}
        </Text>
      ) : null}

      <Card padded={false} style={{ marginTop: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row' }}>
          {stats.map(([value, label], i) => (
            <View
              key={label}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: theme.spacing.md,
                borderLeftWidth: i === 0 ? 0 : 1,
                borderLeftColor: theme.colors.separator,
              }}
            >
              <Text variant="headline">{value}</Text>
              <Text variant="caption" color="tertiary">
                {label}
              </Text>
            </View>
          ))}
        </View>
      </Card>
      <Text variant="footnote" color="tertiary" style={{ marginTop: theme.spacing.sm }}>
        Carbs {recipe.nutrition.carbs}g · Fat {recipe.nutrition.fat}g · per serving
      </Text>

      {plannedMeal ? (
        <PrimaryButton
          title="Start cooking"
          icon="restaurant"
          onPress={() => router.push({ pathname: '/cook/[dayIndex]', params: { dayIndex: String(plannedMeal.dayIndex) } })}
          style={{ marginTop: theme.spacing.lg }}
        />
      ) : null}

      {plannedMeal ? (
        <SecondaryButton
          title={plannedMeal.cooked ? 'Cooked' : 'Mark as cooked'}
          icon={plannedMeal.cooked ? 'checkmark-circle' : undefined}
          onPress={() => toggleCooked(plannedMeal.dayIndex)}
          style={{ marginTop: theme.spacing.md }}
        />
      ) : null}

      {canPin ? (
        <PrimaryButton
          title={pinTarget === 'draft' ? 'Pin to this draft' : 'Pin to this week'}
          onPress={() => router.push({ pathname: '/pin/[recipeId]', params: { recipeId: recipe.id, target: pinTarget } })}
          style={{ marginTop: theme.spacing.lg }}
        />
      ) : null}

      {plannedMeal ? (
        <Card style={{ marginTop: theme.spacing.lg }}>
          <Text variant="headline">How was it?</Text>
          <View style={{ marginTop: theme.spacing.sm }}>
            <StarRating
              value={plannedMeal.rating ?? 0}
              onChange={(rating) => rateMeal(plannedMeal.dayIndex, rating as 1 | 2 | 3 | 4 | 5)}
            />
          </View>
        </Card>
      ) : null}

      {plannedMeal ? (
        <Card style={{ marginTop: theme.spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="headline">Portions</Text>
            <Stepper
              value={plannedMeal.servings}
              min={1}
              step={0.5}
              format={formatServings}
              onChange={(servings) => {
                setOldServings(plannedMeal.servings);
                setApprovedMealServings(plannedMeal.dayIndex, servings);
              }}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cook extra for lunches"
            hitSlop={6}
            style={{ marginTop: theme.spacing.sm }}
            onPress={() => {
              setOldServings(plannedMeal.servings);
              setApprovedMealServings(plannedMeal.dayIndex, plannedMeal.servings + 2);
            }}
          >
            <Text variant="caption" color="accent">
              Cook extra for lunches (+2)
            </Text>
          </Pressable>
        </Card>
      ) : null}

      {plannedMeal && oldServings !== null ? (
        <ServingsShoppingListPrompt
          dayIndex={plannedMeal.dayIndex}
          oldServings={oldServings}
          onResolved={() => setOldServings(null)}
        />
      ) : null}

      {plannedMeal && plannedMeal.sideRecipeIds && plannedMeal.sideRecipeIds.length > 0 ? (
        <View style={{ marginTop: theme.spacing.lg }}>
          <Text variant="title3" style={{ marginBottom: theme.spacing.sm }}>
            On the plate
          </Text>
          {plannedMeal.sideRecipeIds.map((sideId) => {
            const side = recipesById[sideId];
            if (!side) return null;
            return (
              <Card key={sideId} style={{ marginBottom: theme.spacing.sm }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`View ${side.name}`}
                  onPress={() => router.push({ pathname: '/meal/[id]', params: { id: sideId } })}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <View style={{ flex: 1 }}>
                    <Text variant="headline">{side.name}</Text>
                    <Text variant="footnote" color="secondary">
                      {side.role === 'sauce' ? 'Sauce' : 'Side'} · {side.prepMinutes + side.cookMinutes}m
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${side.name}`}
                  hitSlop={6}
                  style={{ marginTop: theme.spacing.sm }}
                  onPress={() => {
                    removeSideFromMeal(plannedMeal.dayIndex, sideId);
                    setRemovingSideId(sideId);
                  }}
                >
                  <Text variant="footnote" color="danger">
                    Remove
                  </Text>
                </Pressable>
              </Card>
            );
          })}
        </View>
      ) : null}

      {/* Rendered independent of the map above — removing a side takes it
          out of `plannedMeal.sideRecipeIds` immediately, so the prompt must
          not live inside that side's (now-gone) card. */}
      {plannedMeal && removingSideId !== null ? (
        <RemoveSideShoppingListPrompt
          dayIndex={plannedMeal.dayIndex}
          sideId={removingSideId}
          onResolved={() => setRemovingSideId(null)}
        />
      ) : null}

      <Text variant="title3" style={{ marginTop: theme.spacing.xl, marginBottom: theme.spacing.sm }}>
        Ingredients
      </Text>
      <Text variant="footnote" color="tertiary" style={{ marginBottom: theme.spacing.sm }}>
        For {recipe.baseServings} servings
      </Text>
      {recipe.estimated ? (
        <Text variant="footnote" color="tertiary" style={{ marginBottom: theme.spacing.sm }}>
          ⚠️ Imported recipe — allergen info estimated, check labels.
        </Text>
      ) : null}
      <Card>
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
      </Card>

      <Text variant="title3" style={{ marginTop: theme.spacing.xl, marginBottom: theme.spacing.sm }}>
        Steps
      </Text>
      {recipe.steps.map((step, i) => (
        <View key={i} style={{ flexDirection: 'row', marginBottom: theme.spacing.md }}>
          <Text variant="headline" color="accent" style={{ width: 28 }}>
            {i + 1}
          </Text>
          <Text variant="body" style={{ flex: 1 }}>
            {step}
          </Text>
        </View>
      ))}

      <Text variant="title3" style={{ marginTop: theme.spacing.xl, marginBottom: theme.spacing.sm }}>
        Family notes
      </Text>
      <Card>
        {editingNote ? (
          <>
            <TextInput
              value={noteDraft}
              onChangeText={setNoteDraft}
              placeholder="What did you change? What did everyone think?"
              placeholderTextColor={theme.colors.textTertiary}
              multiline
              autoFocus
              style={{
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: theme.radius.md,
                paddingVertical: theme.spacing.sm,
                paddingHorizontal: theme.spacing.md,
                fontSize: 17,
                color: theme.colors.text,
                minHeight: 80,
              }}
            />
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                gap: theme.spacing.lg,
                marginTop: theme.spacing.sm,
              }}
            >
              <Pressable onPress={() => setEditingNote(false)}>
                <Text variant="footnote" color="secondary">
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setNote(recipe.id, noteDraft.trim());
                  setEditingNote(false);
                }}
              >
                <Text variant="footnote" color="accent">
                  Save
                </Text>
              </Pressable>
            </View>
          </>
        ) : noteText ? (
          <>
            <Text variant="body" color="secondary">
              {noteText}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setNoteDraft(noteText);
                setEditingNote(true);
              }}
              style={{ marginTop: theme.spacing.sm }}
            >
              <Text variant="footnote" color="accent">
                Edit
              </Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setNoteDraft('');
              setEditingNote(true);
            }}
          >
            <Text variant="footnote" color="accent">
              + Add a note
            </Text>
          </Pressable>
        )}
      </Card>

      {recipe.tips && recipe.tips.length > 0 ? (
        <Card style={{ marginTop: theme.spacing.md }}>
          <Text variant="headline">💡 Tips</Text>
          {recipe.tips.map((tip, i) => (
            <Text
              key={i}
              variant="body"
              color="secondary"
              style={{ marginTop: i === 0 ? theme.spacing.xs : theme.spacing.sm }}
            >
              {tip}
            </Text>
          ))}
        </Card>
      ) : null}

      {recipe.leftoverNotes ? (
        <Card style={{ marginTop: theme.spacing.md }}>
          <Text variant="headline">🥡 Leftovers</Text>
          <Text variant="body" color="secondary" style={{ marginTop: theme.spacing.xs }}>
            {recipe.leftoverNotes}
          </Text>
        </Card>
      ) : null}
      {recipe.freezingNotes ? (
        <Card style={{ marginTop: theme.spacing.md }}>
          <Text variant="headline">❄️ Freezing</Text>
          <Text variant="body" color="secondary" style={{ marginTop: theme.spacing.xs }}>
            {recipe.freezingNotes}
          </Text>
        </Card>
      ) : null}

      {recipe.sourceName ? (
        <View style={{ marginTop: theme.spacing.lg }}>
          {recipe.estimated ? (
            <Text variant="footnote" color="tertiary" style={{ marginBottom: 2 }}>
              Times and nutrition are estimated.
            </Text>
          ) : null}
          <Pressable
            disabled={!recipe.sourceUrl}
            onPress={() => recipe.sourceUrl && Linking.openURL(recipe.sourceUrl)}
          >
            <Text variant="footnote" color={recipe.sourceUrl ? 'accent' : 'tertiary'}>
              Recipe from {recipe.sourceName}
              {recipe.origin ? ` · ${recipe.origin}` : ''}
              {recipe.sourceUrl ? ' ↗' : ''}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {isOwnRecipe ? (
        <View style={{ marginTop: theme.spacing.xl }}>
          {confirmingDelete ? (
            <>
              <Text variant="body" color="secondary" style={{ marginBottom: theme.spacing.md }}>
                Delete {recipe.name} for good? This can't be undone.
              </Text>
              <SecondaryButton
                title="Yes, delete this recipe"
                onPress={() => {
                  deleteRecipe(recipe.id);
                  router.back();
                }}
              />
              <Pressable
                onPress={() => setConfirmingDelete(false)}
                style={{ marginTop: theme.spacing.md, alignSelf: 'center' }}
              >
                <Text variant="footnote" color="secondary">
                  Cancel
                </Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => setConfirmingDelete(true)}
              style={{ alignSelf: 'center' }}
            >
              <Text variant="footnote" color="danger">
                Delete recipe
              </Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </Screen>
  );
}
