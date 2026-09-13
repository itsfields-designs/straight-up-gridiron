import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Refreshes the NFL schedule/scores and recalculates every league's standings. */
export const refreshNfl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { week?: number | null } | undefined) => input ?? {})
  .handler(async ({ data }) => {
    const { syncNflSchedule } = await import("@/lib/nfl-sync.server");
    const week = data.week;
    const result = await syncNflSchedule(
      week && week >= 1 && week <= 18 ? [Math.trunc(week)] : undefined,
    );
    return { ok: true as const, ...result };
  });
