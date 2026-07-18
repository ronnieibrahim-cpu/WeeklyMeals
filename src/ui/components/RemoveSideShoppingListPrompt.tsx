import { ShoppingListDeltaLine } from '@/domain/models';
import { usePlanStore } from '@/stores/planStore';
import { useTheme } from '@/ui/theme/useTheme';

import { Card } from './Card';
import { PrimaryButton } from './PrimaryButton';
import { SecondaryButton } from './SecondaryButton';
import { Text } from './Text';

interface Props {
  dayIndex: number;
  sideId: string;
  /** Called once the user has either applied or dismissed the prompt —
   * the caller clears whatever local state is showing this component. */
  onResolved: () => void;
}

function describeLine(line: ShoppingListDeltaLine): string {
  if (line.removesItem) return `${line.ingredientName} will be removed from the list`;
  return `${line.deltaQuantity} ${line.unit} less ${line.ingredientName}`;
}

/**
 * M4.2 part 2: shown right under a removed side, same pattern as
 * `ServingsShoppingListPrompt` — the side comes off the plate immediately
 * (an explicit tap already did that), but the shopping list is a SEPARATE
 * explicit choice (Product Law #1). Renders nothing when there's nothing to
 * show (every affected ingredient is a pantry staple or already covered by
 * the main/another side) — the caller should treat that as "already
 * resolved."
 */
export function RemoveSideShoppingListPrompt({ dayIndex, sideId, onResolved }: Props) {
  const theme = useTheme();
  const previewRemoveSideDelta = usePlanStore((s) => s.previewRemoveSideDelta);
  const applyRemoveSideDeltaToShoppingList = usePlanStore((s) => s.applyRemoveSideDeltaToShoppingList);
  const delta = previewRemoveSideDelta(dayIndex, sideId);

  if (!delta) return null;

  return (
    <Card style={{ marginTop: theme.spacing.sm, backgroundColor: theme.colors.accentMuted }}>
      <Text variant="subhead">You&rsquo;ll need: {delta.lines.map(describeLine).join(', ')}</Text>
      <PrimaryButton
        title="Remove from shopping list"
        onPress={() => {
          applyRemoveSideDeltaToShoppingList(dayIndex, sideId);
          onResolved();
        }}
        style={{ marginTop: theme.spacing.md }}
      />
      <SecondaryButton title="Not now" onPress={onResolved} style={{ marginTop: theme.spacing.sm }} />
    </Card>
  );
}
