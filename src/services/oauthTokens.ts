import * as SecureStore from 'expo-secure-store';

const TRAKT_TOKENS_KEY = 'trakt_oauth_tokens';
const SIMKL_TOKEN_KEY = 'simkl_oauth_token';

const TRAKT_CLIENT_ID = process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID || '';
const TRAKT_CLIENT_SECRET = process.env.EXPO_PUBLIC_TRAKT_CLIENT_SECRET || '';

// ---------- Types ----------

interface TraktTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  createdAt: number;
}

// ---------- Trakt ----------

export async function storeTraktTokens(tokens: TraktTokens): Promise<void> {
  await SecureStore.setItemAsync(TRAKT_TOKENS_KEY, JSON.stringify(tokens));
}

export async function getTraktTokens(): Promise<TraktTokens | null> {
  const stored = await SecureStore.getItemAsync(TRAKT_TOKENS_KEY);
  return stored ? JSON.parse(stored) : null;
}

export async function clearTraktTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TRAKT_TOKENS_KEY);
}

function isTraktTokenExpired(tokens: TraktTokens): boolean {
  const expiresAtMs = (tokens.createdAt + tokens.expiresIn) * 1000;
  return Date.now() >= expiresAtMs - 300_000; // 5-min buffer
}

/**
 * Returns a valid Trakt access token.
 * - If stored token is still valid, returns it.
 * - If expired, attempts refresh using the refresh token.
 * - Returns null if no stored tokens or refresh fails (caller should re-authenticate).
 */
export async function getValidTraktAccessToken(redirectUri: string): Promise<string | null> {
  const tokens = await getTraktTokens();
  if (!tokens) return null;

  if (!isTraktTokenExpired(tokens)) {
    return tokens.accessToken;
  }

  // Token expired — try refresh (refresh tokens valid for 90 days)
  try {
    const res = await fetch('https://api.trakt.tv/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: tokens.refreshToken,
        client_id: TRAKT_CLIENT_ID,
        client_secret: TRAKT_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'refresh_token',
      }),
    });

    if (!res.ok) {
      await clearTraktTokens();
      return null;
    }

    const newTokens = await res.json();
    const stored: TraktTokens = {
      accessToken: newTokens.access_token,
      refreshToken: newTokens.refresh_token,
      expiresIn: newTokens.expires_in,
      createdAt: newTokens.created_at,
    };
    await storeTraktTokens(stored);
    return stored.accessToken;
  } catch {
    await clearTraktTokens();
    return null;
  }
}

// ---------- SIMKL ----------

export async function storeSimklToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(SIMKL_TOKEN_KEY, token);
}

export async function getSimklToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(SIMKL_TOKEN_KEY);
}

export async function clearSimklToken(): Promise<void> {
  await SecureStore.deleteItemAsync(SIMKL_TOKEN_KEY);
}
