import { ModeBanner } from "@/components/mode-banner";
import { publicConfig } from "@/lib/public-config";

export async function ModeNotice() {
  const config = await publicConfig();
  return <ModeBanner dataMode={config.dataMode} proofMode={config.proofMode} cluster={config.solanaCluster} />;
}
