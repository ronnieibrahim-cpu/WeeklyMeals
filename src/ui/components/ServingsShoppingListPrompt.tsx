import { ShoppingListDeltaLine } from '@/domain/models';
import { usePlanStore } from '@/stores/planStore';
import { useTheme } from '@/ui/theme/useTheme';

import { Card } from './Card';
import { PrimaryButton } from './PrimaryButton';
import { SecondaryButton } from './SecondaryButton';
import { Text } from './Text';

interface Props {
  dayIndex: number;
  /** This meal's servings BEFORE the change that triggered this prompt —
   * captured by the caller at the moment of the tap (not a persisted field;
   * see planStore's own doc comment on `applyServingsDeltaToShoppingList`
   * for why). */
  oldServings: number;
  /** Called once the user has either applied or dismissed the prompt —
   * the caller clears whatever local state is showing this component. */
  onResolved: () => void;
}

function describeLine(line: ShoppingListDeltaLine, direction: 'increase' | 'decrease'): string {
  if (line.removesItem) return `${line.ingredientName} will be removed from the list`;
  const verb = direction === 'increase' ? 'more' : 'less';
  return `${line.deltaQuantity} ${line.unit} ${verb} ${line.ingredientName}`;
}

/**
 * M4.1: shown inline right under a meal's servings stepper, ONLY after a
 * servings change on an already-APPROVED plan — never on a draft, where
 * there's no shopping list yet to protect. Product Law #1: the shopping
 * list must never change without this explicit tap. Mirrors the
 * text-delta-then-explicit-button pattern already used on the pin-to-week
 * screen ("You'll need: X, Y" + a button that actually touches the list).
 *
 * Renders nothing (and the caller should treat that as "already resolved")
 * when there's nothing to show — e.g. every affected ingredient is a pantry
 * staple, so the change doesn't move the list at all.
 */
export function ServingsShoppingListPrompt({ dayIndex, oldServings, onResolved }: Props) {
  const theme = useTheme();
  const previewServingsDelta = usePlanStore((s) => s.previewServingsDelta);
  const applyServingsDeltaToShoppingList = usePlanStore((s) => s.applyServingsDeltaToShoppingList);
  const delta = previewServingsDelta(dayIndex, oldServings);

  if (!delta) return null;

  return (
    <Card style={{ marginTop: theme.spacing.sm, backgroundColor: theme.colors.accentMuted }}>
      <Text variant="subhead">
        You&rsquo;ll need: {delta.lines.map((line) => describeLine(line, delta.direction)).join(', ')}
      </Text>
      <PrimaryButton
        title={delta.direction === 'increase' ? 'Update shopping list' : 'Reduce shopping list'}
        onPress={() => {
          applyServingsDeltaToShoppingList(dayIndex, oldServings);
          onResolved();
        }}
        style={{ marginTop: theme.spacing.md }}
      />
      <SecondaryButton title="Not now" onPress={onResolved} style={{ marginTop: theme.spacing.sm }} />
    </Card>
  );
}
