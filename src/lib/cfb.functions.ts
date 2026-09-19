import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Refreshes the AP Top 25 and the ranked-team slate, then regrades college picks. */
export const refreshCfb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { week?: number | null } | undefined) => input ?? {})
  .handler(async ({ data }) => {
    const { syncCfb, TOTAL_CFB_WEEKS } = await import("@/lib/cfb-sync.server");
    const week = data.week;
    const result = await syncCfb(
      week && week >= 1 && week <= TOTAL_CFB_WEEKS ? [Math.trunc(week)] : undefined,
    );
    return { ok: true as const, ...result };
  });
