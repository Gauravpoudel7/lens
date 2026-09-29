import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";
import { buildDoctorReport, formatDoctorReport, probeJupiter, probeRpc, probeXUser, redactSecrets } from "./doctor.js";

const readyEnv = {
  HELIUS_API_KEY: "helius-test",
  DATA_RPC_URL: "https://rpc.example.test",
  X_AUTH_MODE: "oauth2",
  X_OAUTH2_CLIENT_ID: "cid",
  X_OAUTH2_CLIENT_SECRET: "csecret",
  X_OAUTH2_REFRESH_TOKEN: "refresh",
  X_OAUTH2_ACCESS_TOKEN: "access",
  X_BOT_USER_ID: "2100996843262169088",
  X_REPLY_LINKS: "false",
  POLL_INTERVAL_MS: "180000",
  MAX_X_REPLIES_PER_DAY: "50",
  SOLANA_KEYPAIR: "[1,2,3]",
};

describe("doctor report", () => {
  it("lists ready when config and probes pass, and skips the X call by default", () => {
    const config = loadConfig(readyEnv);
    const report = buildDoctorReport(config, {
      rpc: { ok: true, detail: "answered" },
      jupiter: { ok: true, detail: "answered" },
      xToken: "skipped",
      keypairPresent: true,
    });
    expect(report.ready).toBe(true);
    const text = formatDoctorReport(report);
    expect(text).toContain("ready");
    expect(text).toContain("X_REPLY_LINKS=false");
    expect(text).toContain("X_BOT_USER_ID is set");
    expect(text).toContain("180000");
    expect(text).toContain("MAX_X_REPLIES_PER_DAY is 50");
    expect(text).toContain("Ready.");
    expect(text).not.toContain("csecret");
    expect(text).not.toContain("refresh");
  });

  it("lists not-ready for missing keys, links on, a short poll, and a failed probe", () => {
    const config = loadConfig({
      X_AUTH_MODE: "oauth2",
      X_REPLY_LINKS: "true",
      POLL_INTERVAL_MS: "60000",
    });
    const report = buildDoctorReport(config, {
      rpc: null,
      jupiter: { ok: false, detail: "HTTP 401" },
      xToken: { ok: false, detail: "HTTP 401" },
      keypairPresent: false,
    });
    expect(report.ready).toBe(false);
    const text = formatDoctorReport(report);
    expect(text).toContain("not-ready HELIUS_API_KEY is not set");
    expect(text).toContain("not-ready Jupiter failed: HTTP 401");
    expect(text).toContain("X_OAUTH2_CLIENT_ID");
    expect(text).toContain("X_REPLY_LINKS=true");
    expect(text).toContain("X_BOT_USER_ID is not set");
    expect(text).toContain("under the 180000");
    expect(text).toContain("Not ready.");
  });
});

describe("doctor probes", () => {
  it("treats a healthy RPC and a Jupiter 200 as ready, and redacts the key", async () => {
    const fetchImpl = (async (url: string | URL | Request) => {
      const href = String(url);
      if (href.includes("rpc")) {
        return new Response(JSON.stringify({ jsonrpc: "2.0", result: "ok" }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    const rpc = await probeRpc("https://rpc.example/rpc?api-key=helius-test", fetchImpl, ["helius-test"]);
    const jupiter = await probeJupiter("https://api.jup.ag", undefined, fetchImpl);
    expect(rpc.ok).toBe(true);
    expect(jupiter.ok).toBe(true);
    expect(redactSecrets("failed https://rpc/?api-key=helius-test", ["helius-test"])).not.toContain("helius-test");
  });

  it("calls users/me once and does not follow a failed token with another request", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return new Response(JSON.stringify({ data: { id: "99" } }), { status: 200 });
    }) as typeof fetch;
    const ok = await probeXUser("access-token", fetchImpl);
    expect(ok).toEqual({ ok: true, detail: "users/me 99" });
    expect(calls).toBe(1);
    const missing = await probeXUser(undefined, fetchImpl);
    expect(missing.ok).toBe(false);
    expect(calls).toBe(1);
  });
});
