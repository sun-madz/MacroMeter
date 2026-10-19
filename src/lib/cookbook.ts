// Sends a meal (name + ingredient list) to the user's Google Doc through their
// Google Apps Script web app. See google-apps-script/Cookbook.gs and the README.
import type { Settings } from './store';

export interface CookbookEntry {
  title: string;
  ingredients: string[];
  servings?: number;
}

export function cookbookReady(s: Settings) {
  return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/.test(s.cookbookScriptUrl.trim());
}

export async function sendToCookbook(s: Settings, entry: CookbookEntry): Promise<'sent' | 'queued'> {
  const payload = { ...entry, token: s.cookbookToken };
  // Preferred: go through our Vercel function so we get a real success/failure answer.
  try {
    const res = await fetch('/api/cookbook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scriptUrl: s.cookbookScriptUrl.trim(), ...payload }),
    });
    if (res.ok) return 'sent';
    if (res.status !== 404) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Cookbook error (${res.status})`);
    }
  } catch (e) {
    if (e instanceof Error && !/Failed to fetch|NetworkError|Load failed/.test(e.message)) throw e;
  }
  // Fallback (e.g. local dev without the API): fire-and-forget straight to Apps Script.
  await fetch(s.cookbookScriptUrl.trim(), {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });
  return 'queued';
}
