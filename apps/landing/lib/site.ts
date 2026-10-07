const trim = (url: string) => url.replace(/\/+$/, "");

export const SITE_URL = trim(process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3848");
// Scorecard app (apps/web). Falls back to the page itself when unset.
export const APP_URL = trim(process.env.NEXT_PUBLIC_APP_URL || "");
export const X_HANDLE = process.env.NEXT_PUBLIC_X_HANDLE || "justasklens";
export const X_URL = `https://x.com/${X_HANDLE}`;

export function appUrl(path = "") {
  return APP_URL ? `${APP_URL}${path}` : "#";
}
