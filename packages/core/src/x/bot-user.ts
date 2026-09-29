import { log } from "../ids.js";
import type { LensStore } from "../store/types.js";

export const BOT_USER_CURSOR = "x_bot_user_id";

const HINT = (id: string) => `Set X_BOT_USER_ID=${id} so the next start does not call /2/users/me.`;

/**
 * Prefer X_BOT_USER_ID. Otherwise reuse the id saved in BotCursor, and only
 * call /2/users/me when neither is set. The caller keeps the result in memory.
 */
export async function resolveBotUserId(input: {
  envUserId?: string;
  store: Pick<LensStore, "getCursor" | "setCursor">;
  fetchMe: () => Promise<string>;
  logHint?: (message: string) => void;
}): Promise<string> {
  const hint = input.logHint ?? ((message: string) => log(message));
  if (input.envUserId) return input.envUserId;

  const cached = await input.store.getCursor(BOT_USER_CURSOR);
  if (cached) {
    hint(HINT(cached));
    return cached;
  }

  const id = (await input.fetchMe()).trim();
  if (!id) throw new Error("X /2/users/me returned an empty user id.");
  await input.store.setCursor(BOT_USER_CURSOR, id);
  hint(HINT(id));
  return id;
}
