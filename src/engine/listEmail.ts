import { DEPARTMENT_LABELS, DEPARTMENT_ORDER } from '@/domain/constants';
import { ManualItem, ShoppingList } from '@/domain/models';

/**
 * The "email my H-E-B list" export (Nov 2026). After "Approve this week",
 * the app can open a ready-made email of the week's list so it can be handed
 * to someone (or something) that shops the H-E-B cart. Read-only: this never
 * changes the list (Product Law #1) — it only formats what's already there.
 *
 * Only unchecked items go in — a checked item is already bought. Hand-added
 * items that are deleted or checked are left out for the same reason.
 */

export interface ListEmail {
  subject: string;
  body: string;
  itemCount: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `2026-11-30` -> `Nov 30`, without going through Date (no timezone shift). */
export function formatWeekLabel(weekStartISO: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(weekStartISO);
  if (!m) return weekStartISO;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${Number(m[3])}` : weekStartISO;
}

function formatQuantity(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export function buildListEmail(
  list: ShoppingList | null,
  manualItems: Pick<ManualItem, 'displayName' | 'quantityLabel' | 'department' | 'checked' | 'deleted'>[],
  weekStartISO: string,
): ListEmail {
  const planned = (list?.items ?? []).filter((i) => !i.checked);
  const manual = manualItems.filter((i) => !i.checked && !i.deleted);

  const lines: string[] = [];
  let estimated = 0;
  for (const dept of DEPARTMENT_ORDER) {
    const deptLines: string[] = [];
    for (const item of planned.filter((i) => i.department === dept)) {
      const product = item.hebProductName && item.hebProductName !== item.ingredientName
        ? ` (${item.hebProductName})`
        : '';
      deptLines.push(`- ${item.ingredientName}: ${formatQuantity(item.quantity)} ${item.unit}${product}`);
      estimated += item.estimatedPrice;
    }
    for (const item of manual.filter((i) => i.department === dept)) {
      const qty = item.quantityLabel?.trim() ? `: ${item.quantityLabel.trim()}` : '';
      deptLines.push(`- ${item.displayName}${qty}`);
    }
    if (deptLines.length > 0) {
      if (lines.length > 0) lines.push('');
      lines.push(DEPARTMENT_LABELS[dept].toUpperCase(), ...deptLines);
    }
  }

  const itemCount = planned.length + manual.length;
  const week = formatWeekLabel(weekStartISO);
  const footer = [
    '',
    `${itemCount} item${itemCount === 1 ? '' : 's'} · planned items est. $${estimated.toFixed(2)}`,
    'Sent from Weekly Meals. Pantry items and anything already checked off are left out.',
  ];

  return {
    subject: `Weekly Meals H-E-B list - week of ${week}`,
    body: (itemCount > 0 ? lines : ['(Nothing left to buy this week.)']).concat(footer).join('\n'),
    itemCount,
  };
}

/** A basic shape check before handing an address to the mail app. */
export function isPlausibleEmail(address: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.trim());
}

export function mailtoUrl(to: string, email: Pick<ListEmail, 'subject' | 'body'>): string {
  const recipient = encodeURIComponent(to.trim()).replace(/%40/g, '@');
  return `mailto:${recipient}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
}
