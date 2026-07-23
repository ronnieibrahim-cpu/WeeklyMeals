import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { INGREDIENT_SUGGESTIONS } from '@/data/ingredientSuggestions';
import { DEPARTMENT_LABELS, DEPARTMENT_ORDER } from '@/domain/constants';
import { Department, ManualItem, PlannedMeal, ShoppingItem } from '@/domain/models';
import { isWholeUnitShoppingItem, mealsUsingItem } from '@/engine/wasteFit';
import { useManualItemsStore } from '@/stores/manualItemsStore';
import { usePlanStore } from '@/stores/planStore';
import { ChipSingleSelect, Card, EmptyState, Fab, Screen, Text } from '@/ui/components';
import { useTheme } from '@/ui/theme/useTheme';

type ManualRow = ManualItem & { key: string };

// Height reserved at the bottom of the list so the floating "+" FAB never
// covers the last department card.
const FAB_CLEARANCE = 88;

export default function ShoppingScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const plan = usePlanStore((s) => s.plan);
  const shoppingList = usePlanStore((s) => s.shoppingList);
  const hydrated = usePlanStore((s) => s.hydrated);
  const buildList = usePlanStore((s) => s.buildList);
  const toggleItem = usePlanStore((s) => s.toggleShoppingItem);

  const manualHydrated = useManualItemsStore((s) => s.hydrated);
  const manualItems = useManualItemsStore((s) => s.items);
  const addManualItem = useManualItemsStore((s) => s.add);
  const editManualItem = useManualItemsStore((s) => s.edit);
  const toggleManualChecked = useManualItemsStore((s) => s.toggleChecked);
  const removeManualItem = useManualItemsStore((s) => s.remove);

  const approved = plan?.status === 'approved';
  const stale = !shoppingList || (plan ? shoppingList.planId !== plan.id : true);

  useEffect(() => {
    if (approved && stale) buildList();
  }, [approved, stale, buildList]);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleCollapse = (d: Department) => setCollapsed((c) => ({ ...c, [d]: !c[d] }));

  const [query, setQuery] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  // Group 2b: the add-item flow is unchanged (same query/suggestions/onAdd
  // logic below) — only its entry point moved from an always-visible bar to
  // a FAB that opens it in a sheet.
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  const previouslyUsedNames = useMemo(
    () => Array.from(new Set(manualItems.map((i) => i.displayName.toLowerCase()))),
    [manualItems],
  );
  const suggestionPool = useMemo(
    () => Array.from(new Set([...INGREDIENT_SUGGESTIONS, ...previouslyUsedNames])).sort(),
    [previouslyUsedNames],
  );
  const q = query.trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (!q) return [];
    return suggestionPool.filter((s) => s.includes(q)).slice(0, 6);
  }, [q, suggestionPool]);
  const showCustomAdd = q.length > 0 && !suggestionPool.some((s) => s === q);

  const addAndClear = (name: string) => {
    addManualItem(name);
    setQuery('');
  };

  const closeAddSheet = () => {
    setAddSheetOpen(false);
    setQuery('');
  };

  const fab = (
    <Fab
      icon="add"
      accessibilityLabel="Add an item"
      onPress={() => setAddSheetOpen(true)}
      style={{ position: 'absolute', right: theme.spacing.xl, bottom: theme.spacing.lg }}
    />
  );

  const addItemSheet = addSheetOpen ? (
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
      onPress={closeAddSheet}
    >
      <Pressable
        onPress={() => {}}
        style={{
          backgroundColor: theme.colors.card,
          borderTopLeftRadius: theme.radius.xl,
          borderTopRightRadius: theme.radius.xl,
          padding: theme.spacing.xl,
          paddingBottom: theme.spacing.xl + insets.bottom,
        }}
      >
        <Text variant="title3" style={{ marginBottom: theme.spacing.md }}>
          Add an item
        </Text>
        <AddItemBar
          query={query}
          setQuery={setQuery}
          suggestions={suggestions}
          showCustomAdd={showCustomAdd}
          onAdd={addAndClear}
          autoFocus
        />
        <Pressable
          accessibilityRole="button"
          onPress={closeAddSheet}
          style={{ marginTop: theme.spacing.sm, alignItems: 'center' }}
        >
          <Text variant="body" color="secondary">
            Done
          </Text>
        </Pressable>
      </Pressable>
    </Pressable>
  ) : null;

  if (!hydrated || !manualHydrated) {
    return (
      <Screen title="Shopping List" subtitle="H-E-B" scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      </Screen>
    );
  }

  const hasPlannedList = approved && !!shoppingList;
  const plannedItems = hasPlannedList ? shoppingList!.items : [];

  if (!hasPlannedList && manualItems.length === 0) {
    return (
      <>
        <Screen title="Shopping List" subtitle="H-E-B">
          <EmptyState
            emoji="🛒"
            title="Nothing to buy yet"
            body="Tap the + button to add an item anytime, or approve a weekly plan and a consolidated H-E-B list — organized by department, with an estimated total — shows up here too."
          />
        </Screen>
        {fab}
        {addItemSheet}
      </>
    );
  }

  const grouped = DEPARTMENT_ORDER.map((dept) => ({
    dept,
    planned: plannedItems.filter((i) => i.department === dept),
    manual: manualItems.filter((i) => i.department === dept),
  })).filter((g) => g.planned.length > 0 || g.manual.length > 0);

  const checkedCount =
    plannedItems.filter((i) => i.checked).length + manualItems.filter((i) => i.checked).length;
  const totalCount = plannedItems.length + manualItems.length;

  return (
    <>
    <Screen
      title="Shopping List"
      subtitle="H-E-B"
      contentStyle={{ paddingBottom: theme.spacing.xxl + insets.bottom + FAB_CLEARANCE }}
    >
      {hasPlannedList ? (
        <Card style={{ marginBottom: theme.spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="subhead" color="secondary">
              Estimated total
            </Text>
            <Text variant="headline">${shoppingList!.estimatedTotal.toFixed(2)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.spacing.xs }}>
            <Text variant="subhead" color="secondary">
              Cost per serving
            </Text>
            <Text variant="subhead">~${shoppingList!.costPerServing.toFixed(2)}</Text>
          </View>
          <Text variant="footnote" color="tertiary" style={{ marginTop: theme.spacing.sm }}>
            {totalCount} items · {checkedCount} checked · pantry items excluded
          </Text>
        </Card>
      ) : (
        <Text variant="footnote" color="tertiary" style={{ marginBottom: theme.spacing.lg }}>
          {totalCount} item{totalCount === 1 ? '' : 's'} · {checkedCount} checked
        </Text>
      )}

      {grouped.map(({ dept, planned, manual }) => {
        const count = planned.length + manual.length;
        return (
          <View key={dept} style={{ marginBottom: theme.spacing.md }}>
            <Pressable
              onPress={() => toggleCollapse(dept)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: theme.spacing.sm,
                paddingHorizontal: theme.spacing.xs,
              }}
            >
              <Text variant="footnote" color="secondary">
                {DEPARTMENT_LABELS[dept].toUpperCase()} ({count})
              </Text>
              <Ionicons
                name={collapsed[dept] ? 'chevron-forward' : 'chevron-down'}
                size={16}
                color={theme.colors.textTertiary}
              />
            </Pressable>

            {!collapsed[dept] ? (
              <Card padded={false}>
                {planned.map((item, i) => (
                  <PlannedRow
                    key={`${item.ingredientName}-${item.unit}`}
                    item={item}
                    first={i === 0}
                    onToggle={() => toggleItem(item.ingredientName, item.unit)}
                    meals={plan?.meals ?? []}
                  />
                ))}
                {manual.map((item, i) => (
                  <ManualRowView
                    key={item.key}
                    item={item}
                    first={planned.length === 0 && i === 0}
                    last={i === manual.length - 1}
                    editing={editingKey === item.key}
                    onToggle={() => toggleManualChecked(item.key)}
                    onStartEdit={() => setEditingKey(item.key)}
                    onCancelEdit={() => setEditingKey(null)}
                    onSave={(patch) => {
                      editManualItem(item.key, patch);
                      setEditingKey(null);
                    }}
                    onDelete={() => {
                      removeManualItem(item.key);
                      setEditingKey(null);
                    }}
                  />
                ))}
              </Card>
            ) : null}
          </View>
        );
      })}

      {hasPlannedList ? (
        <Text variant="footnote" color="tertiary" center style={{ marginTop: theme.spacing.md }}>
          Estimates based on typical H-E-B prices.
        </Text>
      ) : null}
    </Screen>
    {fab}
    {addItemSheet}
    </>
  );
}

function AddItemBar({
  query,
  setQuery,
  suggestions,
  showCustomAdd,
  onAdd,
  autoFocus,
}: {
  query: string;
  setQuery: (q: string) => void;
  suggestions: string[];
  showCustomAdd: boolean;
  onAdd: (name: string) => void;
  autoFocus?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: theme.spacing.lg }}>
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
        <Ionicons name="add-circle-outline" size={18} color={theme.colors.textTertiary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Add an item…"
          placeholderTextColor={theme.colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={autoFocus}
          returnKeyType="done"
          onSubmitEditing={() => query.trim() && onAdd(query.trim())}
          style={{
            flex: 1,
            paddingVertical: theme.spacing.md,
            paddingHorizontal: theme.spacing.sm,
            fontSize: 17,
            color: theme.colors.text,
          }}
        />
      </View>

      {query.trim().length > 0 && (suggestions.length > 0 || showCustomAdd) ? (
        <View
          style={{
            marginTop: theme.spacing.sm,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: theme.colors.border,
            overflow: 'hidden',
          }}
        >
          {suggestions.map((item, i) => (
            <Pressable
              key={item}
              onPress={() => onAdd(item)}
              style={{
                paddingVertical: theme.spacing.md,
                paddingHorizontal: theme.spacing.md,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: theme.colors.separator,
              }}
            >
              <Text variant="body">{item}</Text>
            </Pressable>
          ))}
          {showCustomAdd ? (
            <Pressable
              onPress={() => onAdd(query.trim())}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
                paddingVertical: theme.spacing.md,
                paddingHorizontal: theme.spacing.md,
                borderTopWidth: suggestions.length === 0 ? 0 : 1,
                borderTopColor: theme.colors.separator,
              }}
            >
              <Ionicons name="add-circle-outline" size={18} color={theme.colors.accent} />
              <Text variant="body" color="accent">
                Add "{query.trim()}"
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function PlannedRow({
  item,
  first,
  onToggle,
  meals,
}: {
  item: ShoppingItem;
  first: boolean;
  onToggle: () => void;
  meals: PlannedMeal[];
}) {
  const theme = useTheme();
  // M4.3: a quiet, display-only "used in N meals" line for a whole-unit
  // perishable (a head of cabbage, a bunch of cilantro) shared across
  // multiple nights this week — surfaces the waste-fit scoring bonus's
  // reasoning without ever touching the list itself (Product Law #1).
  const sharedMealCount = isWholeUnitShoppingItem(item) ? mealsUsingItem(item.fromRecipeIds, meals) : 0;
  return (
    <Pressable
      onPress={onToggle}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: theme.colors.separator,
      }}
    >
      <Ionicons
        name={item.checked ? 'checkmark-circle' : 'ellipse-outline'}
        size={24}
        color={item.checked ? theme.colors.accent : theme.colors.textTertiary}
      />
      <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
        <Text
          variant="body"
          color={item.checked ? 'tertiary' : 'primary'}
          style={item.checked ? { textDecorationLine: 'line-through' } : undefined}
        >
          {item.ingredientName}
        </Text>
        <Text variant="footnote" color="tertiary">
          {item.quantity} {item.unit}
          {item.hebProductName ? ` · ${item.hebProductName}` : ''}
        </Text>
        {sharedMealCount >= 2 ? (
          <Text variant="footnote" color="tertiary">
            used in {sharedMealCount} meals
          </Text>
        ) : null}
      </View>
      <Text variant="subhead" color={item.checked ? 'tertiary' : 'secondary'}>
        ${item.estimatedPrice.toFixed(2)}
      </Text>
    </Pressable>
  );
}

function ManualRowView({
  item,
  first,
  last,
  editing,
  onToggle,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
}: {
  item: ManualRow;
  first: boolean;
  last: boolean;
  editing: boolean;
  onToggle: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (patch: { displayName?: string; quantityLabel?: string; department?: Department }) => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const [name, setName] = useState(item.displayName);
  const [quantityLabel, setQuantityLabel] = useState(item.quantityLabel ?? '');
  const [department, setDepartment] = useState<Department>(item.department);
  const swipeableRef = useRef<Swipeable>(null);

  if (editing) {
    return (
      <View
        style={{
          padding: theme.spacing.lg,
          borderTopWidth: first ? 0 : 1,
          borderTopColor: theme.colors.separator,
          gap: theme.spacing.sm,
        }}
      >
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Item name"
          placeholderTextColor={theme.colors.textTertiary}
          style={{
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.md,
            paddingVertical: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            fontSize: 17,
            color: theme.colors.text,
          }}
        />
        <TextInput
          value={quantityLabel}
          onChangeText={setQuantityLabel}
          placeholder="Quantity (optional) — e.g. 2 lbs"
          placeholderTextColor={theme.colors.textTertiary}
          style={{
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.md,
            paddingVertical: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            fontSize: 15,
            color: theme.colors.text,
          }}
        />
        <ChipSingleSelect
          options={DEPARTMENT_ORDER.map((d) => ({ value: d, label: DEPARTMENT_LABELS[d] }))}
          value={department}
          onChange={(v) => setDepartment(v as Department)}
        />
        <View style={{ flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.xs }}>
          <Pressable onPress={onDelete} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
            <Text variant="footnote" color="danger">
              Delete
            </Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={onCancelEdit}>
            <Text variant="footnote" color="secondary">
              Cancel
            </Text>
          </Pressable>
          <Pressable
            onPress={() =>
              onSave({
                displayName: name,
                quantityLabel: quantityLabel.trim() || undefined,
                department,
              })
            }
          >
            <Text variant="footnote" color="accent">
              Save
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <Swipeable
      ref={swipeableRef}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          accessibilityLabel={`Delete ${item.displayName}`}
          onPress={() => {
            swipeableRef.current?.close();
            onDelete();
          }}
          style={{
            width: 84,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.danger,
            borderTopRightRadius: first ? theme.radius.xl : 0,
            borderBottomRightRadius: last ? theme.radius.xl : 0,
          }}
        >
          <Ionicons name="trash-outline" size={22} color={theme.colors.onAccent} />
          <Text variant="footnote" color="onAccent" style={{ marginTop: 2 }}>
            Delete
          </Text>
        </Pressable>
      )}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          borderTopWidth: first ? 0 : 1,
          borderTopColor: theme.colors.separator,
          backgroundColor: theme.colors.card,
        }}
      >
        <Pressable onPress={onToggle} hitSlop={8}>
          <Ionicons
            name={item.checked ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={item.checked ? theme.colors.accent : theme.colors.textTertiary}
          />
        </Pressable>
        <Pressable onPress={onToggle} style={{ flex: 1, marginLeft: theme.spacing.md }}>
          <Text
            variant="body"
            color={item.checked ? 'tertiary' : 'primary'}
            style={item.checked ? { textDecorationLine: 'line-through' } : undefined}
          >
            {item.displayName}
          </Text>
          {item.quantityLabel ? (
            <Text variant="footnote" color="tertiary">
              {item.quantityLabel}
            </Text>
          ) : null}
        </Pressable>
        <Pressable accessibilityLabel={`Edit ${item.displayName}`} onPress={onStartEdit} hitSlop={8}>
          <Ionicons name="pencil-outline" size={18} color={theme.colors.textTertiary} />
        </Pressable>
      </View>
    </Swipeable>
  );
}
