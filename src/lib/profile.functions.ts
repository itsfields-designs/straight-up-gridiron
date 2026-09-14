import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const changeUsername = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        username: z
          .string()
          .trim()
          .min(3, "Username must be at least 3 characters.")
          .max(24, "Username must be 24 characters or fewer.")
          .regex(/^[A-Za-z0-9_.-]+$/, "Letters, numbers, dots, dashes and underscores only."),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const next = data.username.trim();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: taken, error: lookupError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("username", next)
      .neq("id", context.userId)
      .limit(1);
    if (lookupError) throw new Error(lookupError.message);
    if (taken && taken.length > 0) throw new Error("That username is taken. Try another one.");

    const { error } = await context.supabase
      .from("profiles")
      .update({ username: next })
      .eq("id", context.userId);
    if (error) {
      if (error.code === "23505") throw new Error("That username is taken. Try another one.");
      throw new Error(error.message);
    }
    return { username: next };
  });
