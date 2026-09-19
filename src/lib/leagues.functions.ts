import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertEntitled } from "@/lib/membership.functions";

export const createLeague = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        name: z.string().trim().min(1).max(80),
        rules: z.string().max(2000),
        sport: z.enum(["nfl", "ncaa"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertEntitled(context.userId, context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: id, error } = await supabaseAdmin.rpc("admin_create_league", {
      _name: data.name,
      _rules: data.rules,
      _user_id: context.userId,
      _sport: data.sport,
    });
    if (error) throw new Error(error.message);
    return id as string;
  });

export const joinLeague = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ code: z.string().trim().min(1).max(16) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertEntitled(context.userId, context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: id, error } = await supabaseAdmin.rpc("admin_join_league_by_code", {
      _code: data.code,
      _user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return id as string;
  });
