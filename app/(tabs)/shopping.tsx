import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { DEPARTMENT_LABELS, DEPARTMENT_ORDER } from '@/domain/constants';
import { Department, ShoppingItem } from '@/domain/models';
import { usePlanStore } from '@/stores/planStore';
import { Card, EmptyState, Screen, Text } from '@/ui/components';
import { useTheme } from '@/ui/theme/useTheme';

export default function ShoppingScreen() {
  const theme = useTheme();
  const plan = usePlanStore((s) => s.plan);
  const shoppingList = usePlanStore((s) => s.shoppingList);
  const hydrated = usePlanStore((s) => s.hydrated);
  const buildList = usePlanStore((s) => s.buildList);
  const toggleItem = usePlanStore((s) => s.toggleShoppingItem);

  const approved = plan?.status === 'approved';
  const stale = !shoppingList || (plan ? shoppingList.planId !== plan.id : true);

  useEffect(() => {
    if (approved && stale) buildList();
  }, [approved, stale, buildList]);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleCollapse = (d: Department) => setCollapsed((c) => ({ ...c, [d]: !c[d] }));

  if (!hydrated) {
    return (
      <Screen title="Shopping List" subtitle="H-E-B" scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      </Screen>
    );
  }

  if (!approved || !shoppingList) {
    return (
      <Screen title="Shopping List" subtitle="H-E-B">
        <EmptyState
          emoji="🛒"
          title="Nothing to buy yet"
          body="Approve a weekly plan and a consolidated H-E-B list — organized by department, with an estimated total — shows up here."
        />
      </Screen>
    );
  }

  const grouped = DEPARTMENT_ORDER.map((dept) => ({
    dept,
    items: shoppingList.items.filter((i) => i.department === dept),
  })).filter((g) => g.items.length > 0);

  const checkedCount = shoppingList.items.filter((i) => i.checked).length;

  return (
    <Screen title="Shopping List" subtitle="H-E-B">
      <Card style={{ marginBottom: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="subhead" color="secondary">
            Estimated total
          </Text>
          <Text variant="headline">${shoppingList.estimatedTotal.toFixed(2)}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.spacing.xs }}>
          <Text variant="subhead" color="secondary">
            Cost per serving
          </Text>
          <Text variant="subhead">~${shoppingList.costPerServing.toFixed(2)}</Text>
        </View>
        <Text variant="footnote" color="tertiary" style={{ marginTop: theme.spacing.sm }}>
          {shoppingList.items.length} items · {checkedCount} checked · pantry items excluded
        </Text>
      </Card>

      {grouped.map(({ dept, items }) => (
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
              {DEPARTMENT_LABELS[dept].toUpperCase()} ({items.length})
            </Text>
            <Ionicons
              name={collapsed[dept] ? 'chevron-forward' : 'chevron-down'}
              size={16}
              color={theme.colors.textTertiary}
            />
          </Pressable>

          {!collapsed[dept] ? (
            <Card padded={false}>
              {items.map((item, i) => (
                <ShoppingRow
                  key={`${item.ingredientName}-${item.unit}`}
                  item={item}
                  first={i === 0}
                  onToggle={() => toggleItem(item.ingredientName, item.unit)}
                />
              ))}
            </Card>
          ) : null}
        </View>
      ))}

      <Text variant="footnote" color="tertiary" center style={{ marginTop: theme.spacing.md }}>
        Estimates based on typical H-E-B prices.
      </Text>
    </Screen>
  );
}

function ShoppingRow({
  item,
  first,
  onToggle,
}: {
  item: ShoppingItem;
  first: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
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
      </View>
      <Text variant="subhead" color={item.checked ? 'tertiary' : 'secondary'}>
        ${item.estimatedPrice.toFixed(2)}
      </Text>
    </Pressable>
  );
}
