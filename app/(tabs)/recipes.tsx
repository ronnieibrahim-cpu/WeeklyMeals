import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { CATEGORIES, CUISINES, MAX_PREP_OPTIONS, PROTEINS } from '@/domain/constants';
import { Category, Cuisine, Difficulty, Protein } from '@/domain/models';
import { RECIPES } from '@/data/seed/recipes';
import { autocompleteSuggestions, filterRecipes, findByExactName, RecipeFilters, searchRecipes } from '@/engine/recipeSearch';
import { useLearningStore } from '@/stores/learningStore';
import { usePlanStore } from '@/stores/planStore';
import { ChipMultiSelect, ChipSingleSelect, EmptyState, RecipeResultCard, Screen, SectionHeader, Text } from '@/ui/components';
import { useTheme } from '@/ui/theme/useTheme';

const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard'];

export default function RecipesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ favoritesOnly?: string; pinTarget?: string }>();
  const pinTarget = params.pinTarget === 'draft' ? 'draft' : 'plan';

  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<RecipeFilters>({ favoritesOnly: params.favoritesOnly === '1' });

  const favorites = useLearningStore((s) => s.favorites);
  const isFavorite = useLearningStore((s) => s.isFavorite);
  const toggleFavorite = useLearningStore((s) => s.toggleFavorite);
  const kidApprovedList = useLearningStore((s) => s.kidApproved);
  const isKidApproved = useLearningStore((s) => s.isKidApproved);
  const toggleKidApproved = useLearningStore((s) => s.toggleKidApproved);
  const plan = usePlanStore((s) => s.plan);
  const draftPlan = usePlanStore((s) => s.draftPlan);
  const canPin = !!(pinTarget === 'draft' ? draftPlan : plan);

  // Drive the heavy list work off a deferred copy of the query so a fast
  // typist doesn't re-filter/re-render the whole (up to 541-item) list on
  // every keystroke — the input stays responsive, the list catches up.
  const deferredQuery = useDeferredValue(query);

  const favoriteIds = useMemo(() => new Set(favorites), [favorites]);
  const kidApprovedIds = useMemo(() => new Set(kidApprovedList), [kidApprovedList]);
  const activeFilters = useMemo<RecipeFilters>(
    () => ({ ...filters, favoriteIds, kidApprovedIds }),
    [filters, favoriteIds, kidApprovedIds],
  );
  const filtered = useMemo(() => filterRecipes(RECIPES, activeFilters), [activeFilters]);

  const suggestions = useMemo(() => autocompleteSuggestions(RECIPES, query), [query]);
  const results = useMemo(
    () => (deferredQuery.trim() ? searchRecipes(filtered, deferredQuery) : filtered),
    [filtered, deferredQuery],
  );

  const openDetail = (id: string) => router.push({ pathname: '/meal/[id]', params: { id, pinTarget } });
  const openPin = (id: string) => router.push({ pathname: '/pin/[recipeId]', params: { recipeId: id, target: pinTarget } });

  // Tapping a suggestion that IS one recipe's own exact name should go
  // straight there, not make the user tap again. This has to check exact
  // name equality, not "does searchRecipes return exactly one result" — the
  // search is deliberately broad substring matching, so e.g. "Shakshuka"
  // legitimately also matches "Vegetarian Shakshuka" and "Shakshuka Feta
  // Cheese" (3 results), even though "Shakshuka" unambiguously names one
  // specific recipe. Anything that isn't a recipe's exact name (a cuisine,
  // an ingredient shared by several dishes) still just fills the search box.
  const onPickSuggestion = (s: string) => {
    const exact = findByExactName(filtered, s);
    if (exact.length === 1) {
      setQuery('');
      openDetail(exact[0].id);
      return;
    }
    setQuery(s);
  };

  const renderCard = (id: string) => {
    const recipe = RECIPES.find((r) => r.id === id);
    if (!recipe) return null;
    return (
      <RecipeResultCard
        key={recipe.id}
        recipe={recipe}
        favorite={isFavorite(recipe.id)}
        onToggleFavorite={() => toggleFavorite(recipe.id)}
        onPress={() => openDetail(recipe.id)}
        onQuickPin={canPin ? () => openPin(recipe.id) : undefined}
        kidApproved={isKidApproved(recipe.id)}
        onToggleKidApproved={() => toggleKidApproved(recipe.id)}
      />
    );
  };

  // No active search text: lead with Favorites (still respecting whatever
  // filters are on), then everything else. Typing collapses this into one
  // ranked list — Favorites is a starting view, not a separate mode.
  const showingFavoritesSection = !deferredQuery.trim();
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  const favoritesInView = showingFavoritesSection
    ? filtered.filter((r) => favoriteIds.has(r.id)).sort(byName)
    : [];
  const restInView = showingFavoritesSection
    ? filtered.filter((r) => !favoriteIds.has(r.id)).sort(byName)
    : results;

  // Hard cap on how many result cards mount at once. Each card can load a
  // remote photo, and mobile Safari OOM-crashes ("a problem repeatedly
  // occurred") if we render all 541 — this is a plain ScrollView, not a
  // virtualized list. The cap keeps memory bounded; the count line tells the
  // user to narrow down rather than silently hiding matches.
  const MAX_VISIBLE_RESULTS = 40;
  const visibleRest = restInView.slice(0, MAX_VISIBLE_RESULTS);
  const hiddenCount = restInView.length - visibleRest.length;

  return (
    <Screen title="Recipes" subtitle={`${RECIPES.length} recipes to search, filter, and pin`}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          paddingHorizontal: theme.spacing.md,
          backgroundColor: theme.colors.card,
        }}
      >
        <Ionicons name="search" size={18} color={theme.colors.textTertiary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name, cuisine, or ingredient…"
          placeholderTextColor={theme.colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={{
            flex: 1,
            paddingVertical: theme.spacing.md,
            paddingHorizontal: theme.spacing.sm,
            fontSize: 17,
            color: theme.colors.text,
          }}
        />
        {query.length > 0 ? (
          <Pressable accessibilityLabel="Clear search" hitSlop={8} onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={theme.colors.textTertiary} />
          </Pressable>
        ) : null}
      </View>

      {/* Gated on the query, NOT on input focus. The dropdown used to
          unmount on blur — but tapping a suggestion blurs the input first,
          so the row disappeared mid-tap and the press never landed
          (verified in a real browser: pointerdown reached the row, the
          click event never fired at all). Keeping it mounted while a query
          exists makes taps reliable; it clears when the query does. */}
      {query.trim().length > 0 && suggestions.length > 0 ? (
        <View
          style={{
            marginTop: theme.spacing.sm,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: theme.colors.border,
            overflow: 'hidden',
          }}
        >
          {suggestions.map((s, i) => (
            <Pressable
              key={s}
              onPress={() => onPickSuggestion(s)}
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
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => setShowFilters((v) => !v)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: theme.spacing.md }}
      >
        <Ionicons name={showFilters ? 'chevron-up' : 'chevron-down'} size={16} color={theme.colors.accent} />
        <Text variant="subhead" color="accent">
          Filters{filtersActiveCount(filters) > 0 ? ` (${filtersActiveCount(filters)})` : ''}
        </Text>
      </Pressable>

      {showFilters ? (
        <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.lg }}>
          <View>
            <SectionHeader title="Cuisine" />
            <ChipSingleSelect
              options={[{ value: '', label: 'Any' }, ...CUISINES]}
              value={filters.cuisine ?? ''}
              onChange={(v) => setFilters((f) => ({ ...f, cuisine: (v || undefined) as Cuisine | undefined }))}
            />
          </View>
          <View>
            <SectionHeader title="Protein" />
            <ChipSingleSelect
              options={[{ value: '', label: 'Any' }, ...PROTEINS]}
              value={filters.protein ?? ''}
              onChange={(v) => setFilters((f) => ({ ...f, protein: (v || undefined) as Protein | undefined }))}
            />
          </View>
          <View>
            <SectionHeader title="Difficulty" />
            <ChipSingleSelect
              options={[{ value: '', label: 'Any' }, ...DIFFICULTIES.map((d) => ({ value: d, label: d }))]}
              value={filters.difficulty ?? ''}
              onChange={(v) => setFilters((f) => ({ ...f, difficulty: (v || undefined) as Difficulty | undefined }))}
            />
          </View>
          <View>
            <SectionHeader title="Max total time" />
            <ChipSingleSelect
              options={[
                { value: '', label: 'Any' },
                ...MAX_PREP_OPTIONS.map((m) => ({ value: String(m * 2), label: `${m * 2} min` })),
              ]}
              value={filters.maxTotalMinutes ? String(filters.maxTotalMinutes) : ''}
              onChange={(v) => setFilters((f) => ({ ...f, maxTotalMinutes: v ? Number(v) : undefined }))}
            />
          </View>
          <View>
            <SectionHeader title="Categories" />
            <ChipMultiSelect
              options={CATEGORIES}
              values={filters.categories ?? []}
              onToggle={(v) =>
                setFilters((f) => {
                  const current = f.categories ?? [];
                  const categories = current.includes(v as Category)
                    ? current.filter((c) => c !== v)
                    : [...current, v as Category];
                  return { ...f, categories };
                })
              }
            />
          </View>
          <View>
            <SectionHeader title="Other" />
            <ChipMultiSelect
              options={[
                { value: 'curatedOnly', label: 'Curated only' },
                { value: 'kidApprovedOnly', label: 'Kid-approved' },
              ]}
              values={[
                ...(filters.curatedOnly ? ['curatedOnly'] : []),
                ...(filters.kidApprovedOnly ? ['kidApprovedOnly'] : []),
              ]}
              onToggle={(v) =>
                setFilters((f) =>
                  v === 'curatedOnly' ? { ...f, curatedOnly: !f.curatedOnly } : { ...f, kidApprovedOnly: !f.kidApprovedOnly },
                )
              }
            />
          </View>
        </View>
      ) : null}

      {showingFavoritesSection && favoritesInView.length > 0 ? (
        <>
          <SectionHeader title="Favorites" />
          {favoritesInView.map((r) => renderCard(r.id))}
        </>
      ) : null}

      <SectionHeader title={showingFavoritesSection ? 'All Recipes' : 'Results'} />
      {restInView.length > 0 ? (
        <>
          {visibleRest.map((r) => renderCard(r.id))}
          {hiddenCount > 0 ? (
            <Text variant="footnote" color="tertiary" style={{ marginTop: theme.spacing.md, textAlign: 'center' }}>
              +{hiddenCount} more — search or add filters to narrow down.
            </Text>
          ) : null}
        </>
      ) : (
        <EmptyState emoji="🔍" title="No recipes match" body="Try a different search or fewer filters." />
      )}
    </Screen>
  );
}

function filtersActiveCount(filters: RecipeFilters): number {
  let n = 0;
  if (filters.cuisine) n += 1;
  if (filters.protein) n += 1;
  if (filters.difficulty) n += 1;
  if (filters.maxTotalMinutes) n += 1;
  if (filters.categories && filters.categories.length > 0) n += 1;
  if (filters.curatedOnly) n += 1;
  if (filters.favoritesOnly) n += 1;
  if (filters.kidApprovedOnly) n += 1;
  return n;
}
