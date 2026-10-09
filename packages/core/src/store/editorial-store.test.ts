import { describe, expect, it } from "vitest";
import type { EditorialRecord } from "../types.js";
import { MemoryStore } from "./memory.js";

function record(patch: Partial<EditorialRecord>): EditorialRecord {
  return {
    id: "e1",
    kind: "tip",
    day: "2026-10-09",
    text: "🛡️ Safety tip",
    contentHash: "h",
    payload: "lens:v1:h",
    txSignature: "mock_1",
    cluster: "mock",
    xPostId: null,
    status: "proved",
    recapSource: null,
    error: null,
    attempts: 0,
    createdAt: "2026-10-09T13:00:00.000Z",
    updatedAt: "2026-10-09T13:00:00.000Z",
    ...patch,
  };
}

describe("editorial store", () => {
  it("keeps one record per kind and day", async () => {
    const store = new MemoryStore();
    await store.saveEditorial(record({}));
    await expect(store.saveEditorial(record({ id: "e2" }))).rejects.toThrow(/already exists/);
    await store.saveEditorial(record({ id: "e3", day: "2026-10-10", createdAt: "2026-10-10T13:00:00.000Z" }));
    await store.updateEditorial("e1", { status: "posted", xPostId: "x_1" });
    expect(await store.getEditorial("tip", "2026-10-09")).toMatchObject({ status: "posted", xPostId: "x_1" });
    expect((await store.listEditorial()).map((row) => row.id)).toEqual(["e3", "e1"]);
    expect((await store.listEditorial({ status: "posted" })).map((row) => row.id)).toEqual(["e1"]);
    expect((await store.listEditorial({ day: "2026-10-10" })).map((row) => row.id)).toEqual(["e3"]);
  });
});
