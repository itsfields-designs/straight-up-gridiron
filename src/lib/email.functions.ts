import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Emails a league invite link to a friend, from the member who invited them. */
export const emailLeagueInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        leagueId: z.string().uuid(),
        to: z.string().trim().email().max(200),
        link: z.string().trim().url().max(500),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ sent: boolean }> => {
    const { data: membership } = await context.supabase
      .from("league_members")
      .select("league_id")
      .eq("league_id", data.leagueId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!membership) throw new Error("You are not a member of this league");

    const { data: league } = await context.supabase
      .from("leagues")
      .select("name")
      .eq("id", data.leagueId)
      .maybeSingle();
    const leagueName = league?.name ?? "our league";

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("username")
      .eq("id", context.userId)
      .maybeSingle();
    const inviter = profile?.username ?? "A friend";

    const React = await import("react");
    const { InviteEmail } = await import("@/lib/email-templates/invite");
    const { sendEmail } = await import("@/lib/email.server");

    await sendEmail({
      to: data.to,
      subject: `${inviter} invited you to ${leagueName} on Gridiron Gods`,
      element: React.createElement(InviteEmail, {
        siteName: "Gridiron Gods",
        siteUrl: "https://gridirongods.app",
        confirmationUrl: data.link,
      }),
    });

    return { sent: true };
  });
