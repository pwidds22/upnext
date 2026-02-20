// TMDB API Configuration
export const TMDB_API_KEY = process.env.EXPO_PUBLIC_TMDB_API_KEY || '';

// Validate required environment variables in development
if (__DEV__) {
  const missing: string[] = [];
  if (!process.env.EXPO_PUBLIC_TMDB_API_KEY) missing.push('EXPO_PUBLIC_TMDB_API_KEY');
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL) missing.push('EXPO_PUBLIC_SUPABASE_URL');
  if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (!process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY) missing.push('EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY');
  if (missing.length > 0) {
    console.warn(
      `Missing environment variables: ${missing.join(', ')}\nCopy .env.example to .env and fill in your keys.`
    );
  }
}

export const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
export const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

// Image sizes
export const POSTER_SIZES = {
  small: 'w154',
  medium: 'w342',
  large: 'w500',
  original: 'original',
} as const;

export const STILL_SIZES = {
  small: 'w185',
  medium: 'w300',
  original: 'original',
} as const;

export const LOGO_SIZES = {
  small: 'w45',
  medium: 'w92',
  large: 'w154',
} as const;

// App constants
export const SEARCH_DEBOUNCE_MS = 300;
export const MAX_SEARCH_RESULTS = 20;
export const DEFAULT_COUNTRY_CODE = 'US';

// Colors (dark theme first)
export const COLORS = {
  primary: '#10B981', // Green for watched/primary actions
  background: '#000000',
  surface: '#1C1C1E',
  surfaceLight: '#2C2C2E',
  text: '#FFFFFF',
  textSecondary: '#8E8E93',
  textTertiary: '#636366',
  border: '#38383A',
  error: '#FF453A',
  warning: '#FF9F0A',
  blue: '#0A84FF',
} as const;

// Status display
export const STATUS_CONFIG = {
  watching: {
    label: 'Watching',
    color: COLORS.primary,
    icon: 'play-circle',
  },
  waiting: {
    label: 'Waiting',
    color: COLORS.warning,
    icon: 'time',
  },
  watchlist: {
    label: 'Watchlist',
    color: COLORS.blue,
    icon: 'list',
  },
  completed: {
    label: 'Watched',
    color: COLORS.primary,
    icon: 'checkmark-circle',
  },
  dropped: {
    label: 'Dropped',
    color: COLORS.textSecondary,
    icon: 'close-circle',
  },
} as const;

// Helper functions
export function getPosterUrl(path: string | null, size: keyof typeof POSTER_SIZES = 'medium'): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE_URL}/${POSTER_SIZES[size]}${path}`;
}

export function getStillUrl(path: string | null, size: keyof typeof STILL_SIZES = 'medium'): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE_URL}/${STILL_SIZES[size]}${path}`;
}

export function getLogoUrl(path: string | null, size: keyof typeof LOGO_SIZES = 'medium'): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE_URL}/${LOGO_SIZES[size]}${path}`;
}

export function formatEpisodeCode(season: number, episode: number): string {
  return `S${String(season).padStart(2, '0')} E${String(episode).padStart(2, '0')}`;
}

export function getYearFromDate(dateString: string | null): string | null {
  if (!dateString || dateString.length < 4) return null;
  return dateString.substring(0, 4);
}

// Parse TMDB date string (YYYY-MM-DD) as local date, not UTC
// This prevents timezone issues where "2025-01-28" shows as Jan 27 in US timezones
export function parseLocalDate(dateString: string | null): Date | null {
  if (!dateString) return null;
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day); // month is 0-indexed
}

// Get today's date in Pacific Time as YYYY-MM-DD string
// Used for comparing air dates since most shows release at midnight PT
export function getTodayPacificDate(): string {
  const now = new Date();
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

// Check if a TMDB date is in the past (has aired) based on Pacific Time
export function hasAiredPacific(dateString: string | null): boolean {
  if (!dateString) return false;
  const todayPT = getTodayPacificDate();
  return dateString <= todayPT;
}

// Format a date string for display (e.g., "Jan 28, 2025" or "Wed, Jan 28")
// Uses manual formatting to avoid any locale/timezone issues
export function formatAirDate(dateString: string | null, includeYear = false): string | null {
  const date = parseLocalDate(dateString);
  if (!date) return null;

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const weekday = weekdays[date.getDay()];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();

  if (includeYear) {
    return `${month} ${day}, ${year}`;
  }
  return `${weekday}, ${month} ${day}`;
}

export function getDaysUntil(dateString: string | null): number | null {
  if (!dateString) return null;

  // Compare dates in Pacific Time (most shows release at midnight PT)
  const todayPT = getTodayPacificDate();
  const [targetYear, targetMonth, targetDay] = dateString.split('-').map(Number);
  const [todayYear, todayMonth, todayDay] = todayPT.split('-').map(Number);

  if (!targetYear || !targetMonth || !targetDay) return null;

  const targetDate = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay));
  const todayDate = new Date(Date.UTC(todayYear, todayMonth - 1, todayDay));

  const diffTime = targetDate.getTime() - todayDate.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

export function getCountdownText(dateString: string | null): string | null {
  const days = getDaysUntil(dateString);
  if (days === null) return null;

  if (days < 0) return null;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return `In ${days} days`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `In ${weeks} week${weeks === 1 ? '' : 's'}`;
  }
  return formatAirDate(dateString, true);
}
