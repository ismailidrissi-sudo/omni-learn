/**
 * Omnilearn mobile config
 * Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in .env or app.config.js
 * (Use the Web client ID from Google Cloud Console - same as frontend)
 */
export const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
