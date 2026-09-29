import { randomBytes } from "node:crypto";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function newId(length = 10): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}

export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function safeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    return parsed.toString();
  } catch {
    return url.split("?")[0] ?? url;
  }
}

export function log(message: string, extra?: unknown): void {
  writeLog("info", message, extra);
}

export function logError(message: string, extra?: unknown): void {
  writeLog("error", message, extra);
}

function writeLog(level: "info" | "error", message: string, extra?: unknown): void {
  const fields =
    extra == null
      ? {}
      : typeof extra === "object" && !Array.isArray(extra)
        ? (extra as Record<string, unknown>)
        : { detail: extra };
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    service: "lens",
    msg: message,
    ...fields,
  });
  if (level === "error") console.error(line);
  else console.log(line);
}
