/**
 * auth.js — the sign-in return page's entry module (auth/index.html).
 */

// Google sends the browser here with a one-time code (PKCE). Trade it
// for a session, keep nothing Google-side, and go back where you were.
import { client } from './account/cloud.js';
import { AUTH_KEY, RETURN_KEY } from './account/config.js';
import { safeReturn } from './account/auth.js';
import { t, fillPage } from './lang.js';

fillPage();

const status = document.getElementById('status');
const params = new URLSearchParams(location.search);
const back = safeReturn(sessionStorage.getItem(RETURN_KEY) || '/');
const fail = (text) => {
  status.textContent = `${text} `;
  const link = document.createElement('a');
  link.href = back;
  link.textContent = t('auth.back');
  status.append(link);
};
try {
  if (params.get('error')) throw new Error(params.get('error_description') || params.get('error'));
  const code = params.get('code');
  if (!code) throw new Error(t('auth.no_code'));
  const sb = await client();
  const { error } = await sb.auth.exchangeCodeForSession(code);
  if (error) throw error;
  // The hub never needs Google's own tokens: don't keep them on a page games share.
  const stored = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
  if (stored) {
    delete stored.provider_token;
    delete stored.provider_refresh_token;
    localStorage.setItem(AUTH_KEY, JSON.stringify(stored));
  }
  sessionStorage.removeItem(RETURN_KEY);
  location.replace(back);
} catch (error) {
  fail(t('auth.failed', { reason: error.message || error }));
}
