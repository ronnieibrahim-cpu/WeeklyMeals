/**
 * Supabase connection for household sync. The publishable key is designed to be
 * public (client-embedded); access is governed by row-level security on the
 * `households` table. Set SYNC_ENABLED to false to disable all network calls.
 */
export const SUPABASE_URL = 'https://mrfzhmvfycqbwnhdqhsr.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_WTvem2q3OGUjVUb5VNU55Q_aAf24O58';
export const HOUSEHOLD_TABLE = 'households';
export const SYNC_ENABLED = true;
