import { loadConfig } from "@lens/core";
import { ModeBanner } from "@/components/mode-banner";
import { getRuntime } from "@/lib/runtime";

export async function ModeNotice() {
  try {
    const rt = await getRuntime();
    return <ModeBanner dataMode={rt.config.dataMode} proofMode={rt.config.proofMode} />;
  } catch {
    const config = loadConfig();
    return <ModeBanner dataMode={config.dataMode} proofMode={config.proofMode} />;
  }
}
