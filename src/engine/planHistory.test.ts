import { IntakeAnswers, PlannedMeal, WeeklyPlan } from '@/domain/models';
import { archivePlan } from './planHistory';

const INTAKE = {} as IntakeAnswers;

function meal(dayIndex: number, over: Partial<PlannedMeal> = {}): PlannedMeal {
  return {
    recipeId: `r${dayIndex}`,
    servings: 4,
    dayIndex,
    locked: false,
    cooked: false,
    ...over,
  };
}

function plan(over: Partial<WeeklyPlan> = {}): WeeklyPlan {
  return {
    id: 'plan-1',
    weekStartISO: '2026-07-13',
    intake: INTAKE,
    meals: [meal(0), meal(1)],
    status: 'approved',
    createdAtISO: '2026-07-13T00:00:00.000Z',
    ...over,
  };
}

describe('archivePlan', () => {
  it('inserts a plan into an empty history, stamped completed', () => {
    const p = plan();
    const result = archivePlan([], p);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('plan-1');
    expect(result[0].status).toBe('completed');
    // The rest of the plan's fields are preserved verbatim.
    expect(result[0].meals).toEqual(p.meals);
    expect(result[0].weekStartISO).toBe(p.weekStartISO);
  });

  it('does not mutate the outgoing plan or the input history array', () => {
    const p = plan({ status: 'approved' });
    const history: WeeklyPlan[] = [];
    archivePlan(history, p);
    expect(p.status).toBe('approved'); // original untouched
    expect(history).toEqual([]); // input array untouched
  });

  it('re-archiving the same id replaces the entry — newest snapshot wins', () => {
    const first = plan({ id: 'plan-1', meals: [meal(0, { rating: undefined })] });
    const afterFirstArchive = archivePlan([], first);

    const updated = plan({ id: 'plan-1', meals: [meal(0, { rating: 5, cooked: true })] });
    const result = archivePlan(afterFirstArchive, updated);

    expect(result).toHaveLength(1);
    expect(result[0].meals[0].rating).toBe(5);
    expect(result[0].meals[0].cooked).toBe(true);
  });

  it('two plans with the same weekStartISO but different ids both count', () => {
    const original = plan({ id: 'plan-A', createdAtISO: '2026-07-13T08:00:00.000Z' });
    const reapproved = plan({ id: 'plan-B', createdAtISO: '2026-07-14T08:00:00.000Z' });
    const afterFirst = archivePlan([], original);
    const result = archivePlan(afterFirst, reapproved);

    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id).sort()).toEqual(['plan-A', 'plan-B']);
  });

  it('sorts descending by weekStartISO', () => {
    const older = plan({ id: 'older', weekStartISO: '2026-07-06' });
    const newer = plan({ id: 'newer', weekStartISO: '2026-07-13' });
    let history = archivePlan([], older);
    history = archivePlan(history, newer);
    expect(history.map((p) => p.id)).toEqual(['newer', 'older']);
  });

  it('breaks a weekStartISO tie by createdAtISO descending', () => {
    const early = plan({ id: 'early', weekStartISO: '2026-07-13', createdAtISO: '2026-07-13T08:00:00.000Z' });
    const late = plan({ id: 'late', weekStartISO: '2026-07-13', createdAtISO: '2026-07-13T20:00:00.000Z' });
    let history = archivePlan([], early);
    history = archivePlan(history, late);
    expect(history.map((p) => p.id)).toEqual(['late', 'early']);
  });

  it('breaks a weekStartISO + createdAtISO tie by id descending, deterministically', () => {
    const a = plan({ id: 'aaa', weekStartISO: '2026-07-13', createdAtISO: '2026-07-13T08:00:00.000Z' });
    const b = plan({ id: 'bbb', weekStartISO: '2026-07-13', createdAtISO: '2026-07-13T08:00:00.000Z' });
    let history = archivePlan([], a);
    history = archivePlan(history, b);
    expect(history.map((p) => p.id)).toEqual(['bbb', 'aaa']);

    // Same result regardless of insertion order.
    let historyReversed = archivePlan([], b);
    historyReversed = archivePlan(historyReversed, a);
    expect(historyReversed.map((p) => p.id)).toEqual(['bbb', 'aaa']);
  });

  it('caps at 6 by default, dropping the oldest', () => {
    let history: WeeklyPlan[] = [];
    for (let week = 1; week <= 7; week++) {
      history = archivePlan(history, plan({ id: `plan-${week}`, weekStartISO: `2026-${String(week).padStart(2, '0')}-01` }));
    }
    expect(history).toHaveLength(6);
    // Weeks 2..7 survive (newest-first); week 1 (oldest) was dropped.
    expect(history.map((p) => p.id)).toEqual(['plan-7', 'plan-6', 'plan-5', 'plan-4', 'plan-3', 'plan-2']);
  });

  it('respects a custom cap', () => {
    let history: WeeklyPlan[] = [];
    for (let week = 1; week <= 4; week++) {
      history = archivePlan(history, plan({ id: `plan-${week}`, weekStartISO: `2026-${String(week).padStart(2, '0')}-01` }), 2);
    }
    expect(history).toHaveLength(2);
    expect(history.map((p) => p.id)).toEqual(['plan-4', 'plan-3']);
  });

  it('a plan already draft/approved is stamped completed on archive, even mid-cap-eviction', () => {
    const history = archivePlan([], plan({ status: 'draft' }));
    expect(history[0].status).toBe('completed');
  });
});
