/** One meal's weekly-review feedback. The raw signal behind learning. */
export interface RatingEvent {
  id: string;
  planId: string;
  recipeId: string;
  cooked: boolean;
  enjoyment?: number; // 1–5
  cookAgain?: boolean;
  familyAgain?: boolean;
  tooMuchPrep?: boolean;
  tooExpensive?: boolean;
  tooSpicy?: boolean;
  tooBland?: boolean;
  tooManyLeftovers?: boolean;
  ratedAtISO: string;
}
