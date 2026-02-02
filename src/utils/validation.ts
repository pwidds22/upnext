// Username validation constants and utilities

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

/**
 * Validates a username and returns an error message if invalid, or null if valid.
 */
export function validateUsername(username: string): string | null {
  if (!username.trim()) {
    return 'Username is required';
  }
  if (username.length < USERNAME_MIN_LENGTH) {
    return `Username must be at least ${USERNAME_MIN_LENGTH} characters`;
  }
  if (username.length > USERNAME_MAX_LENGTH) {
    return `Username must be ${USERNAME_MAX_LENGTH} characters or less`;
  }
  if (!USERNAME_REGEX.test(username)) {
    return 'Username can only contain letters, numbers, and underscores';
  }
  return null;
}

/**
 * Cleans a username by removing invalid characters and truncating to max length.
 * Use this when the user is typing to prevent invalid characters from being entered.
 */
export function cleanUsername(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, USERNAME_MAX_LENGTH);
}
