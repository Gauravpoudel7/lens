import { utcDay } from "../ids.js";
import type { EditorialKind, EditorialRecord, LensConfig } from "../types.js";

export type ScheduleConfig = Pick<LensConfig, "editorialKinds" | "editorialHours" | "editorialMaxLateHours">;

const HOUR_MS = 3_600_000;

/** Start of a kind's slot on a UTC day, in ms. */
export function slotStart(day: string, kind: EditorialKind, config: Pick<LensConfig, "editorialHours">): number {
  return Date.parse(`${day}T${String(config.editorialHours[kind]).padStart(2, "0")}:00:00.000Z`);
}

/** True from the slot hour until EDITORIAL_MAX_LATE_HOURS after it. */
export function inSlotWindow(kind: EditorialKind, now: Date, config: ScheduleConfig): boolean {
  const start = slotStart(utcDay(now), kind, config);
  const late = now.getTime() - start;
  return late >= 0 && late <= config.editorialMaxLateHours * HOUR_MS;
}

/**
 * At most one kind per poll: the earliest enabled slot that has started, is not
 * too late, and has no record today in any status.
 */
export function dueEditorial(now: Date, config: ScheduleConfig, todays: EditorialRecord[]): EditorialKind | null {
  const day = utcDay(now);
  const done = new Set(todays.filter((row) => row.day === day).map((row) => row.kind));
  const kinds = [...config.editorialKinds].sort((a, b) => config.editorialHours[a] - config.editorialHours[b]);
  return kinds.find((kind) => !done.has(kind) && inSlotWindow(kind, now, config)) ?? null;
}
