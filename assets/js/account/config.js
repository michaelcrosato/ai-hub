/**
 * account/config.js — where the hub's accounts live. Both values are public by
 * design (Supabase's publishable key): what any page may do with them is
 * decided by the database's row-level security (supabase/migrations/).
 */

export const SUPABASE_URL = 'https://ncbiljxbxfrotlszdghi.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_OrZw2n3S5kGipkxF_jIRAg_eNkDDWKZ';

/** supabase-js, vendored and pinned; loaded only when an account is in use. */
export const LIBRARY = '/assets/vendor/supabase-js/2.117.3/supabase.js';

/** The signed-in session, in localStorage. Its presence alone says "signed in". */
export const AUTH_KEY = 'ai-hub:auth';

/** Where /auth/ sends you back to after Google. */
export const RETURN_KEY = 'ai-hub:return';
