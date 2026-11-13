const TOKEN_KEY = 'ghp.token';
const HOUSEHOLD_KEY = 'ghp.household';
const THEME_KEY = 'ghp.theme';

export const DEMO_TOKEN = 'demo-public-token';

export function getOwnerToken(): string {
  try {
    const existing = localStorage.getItem(TOKEN_KEY);
    if (existing) return existing;
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(TOKEN_KEY, token);
    return token;
  } catch {
    return 'session-only-token';
  }
}

export function getSavedHousehold(): string | null {
  try {
    return localStorage.getItem(HOUSEHOLD_KEY);
  } catch {
    return null;
  }
}

export function rememberHousehold(id: string): void {
  try {
    localStorage.setItem(HOUSEHOLD_KEY, id);
  } catch {
    /* storage is optional */
  }
}

export function forgetHousehold(): void {
  try {
    localStorage.removeItem(HOUSEHOLD_KEY);
  } catch {
    /* storage is optional */
  }
}

export function initialTheme(): 'dark' | 'light' {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    /* storage is optional */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: 'dark' | 'light'): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* storage is optional */
  }
}
