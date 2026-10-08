/**
 * Defaults shared by `loadConfig` and the static landing page. No imports, so the landing can read it without
 * pulling in Node-only code.
 */
export const DEFAULTS = {
  xBotHandle: "justasklens",
  proPriceUsdc: 10,
  proPeriodDays: 30,
  rateLimitPerUserPerDay: 5,
  jupiterFeeBps: 50,
  alertDmsPerUserPerDay: 10,
  alertDmsPerDay: 100,
} as const;
