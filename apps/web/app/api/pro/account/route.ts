import { isActivePro, proStatus } from "@lens/core";
import { getRuntime } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const handle = url.searchParams.get("handle") ?? "";
  const wallet = url.searchParams.get("wallet") ?? "";
  if (!handle && !wallet) {
    return Response.json({ error: "Pass a handle or a wallet." }, { status: 400 });
  }
  const rt = await getRuntime();
  const user =
    (wallet ? await rt.store.findUser({ wallet }) : null) ??
    (handle ? await rt.store.findUser({ xHandle: handle }) : null);
  if (!user) return Response.json({ user: null, watches: [], tier: "free" });
  const watches = await rt.store.listWatches(user.id);
  return Response.json({
    user,
    watches,
    ...proStatus(user),
    active: isActivePro(user),
  });
}
