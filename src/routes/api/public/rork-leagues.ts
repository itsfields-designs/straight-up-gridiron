import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { assertRorkEntitled, authorizeRork, errorResponse, readJson } from "@/lib/rork-sync.server";

/**
 * League creation and joining for the external Rork backend.
 * Secured by the shared RORK_SYNC_SECRET header; nothing works without it.
 */

const createSchema = z.object({
  action: z.literal("create"),
  user_id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  rules: z.string().max(2000).optional().default(""),
  sport: z.enum(["nfl", "ncaa"]).default("nfl"),
});

const joinSchema = z.object({
  action: z.literal("join"),
  user_id: z.string().uuid(),
  code: z.string().trim().min(1).max(16),
});

const bodySchema = z.discriminatedUnion("action", [createSchema, joinSchema]);

export const Route = createFileRoute("/api/public/rork-leagues")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      // List the leagues a member belongs to.
      GET: async ({ request }) => {
        const denied = authorizeRork(request);
        if (denied) return denied;

        const userId = new URL(request.url).searchParams.get("user_id");
        if (!userId || !z.string().uuid().safeParse(userId).success) {
          return new Response("Invalid user_id", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("league_members")
          .select("league_id, leagues(id, name, sport, code, owner_id)")
          .eq("user_id", userId);
        if (error) {
          console.error("[rork-leagues] read failed", error);
          return new Response("Read failed", { status: 500 });
        }
        return Response.json({ leagues: data ?? [] });
      },

      POST: async ({ request }) => {
        const denied = authorizeRork(request);
        if (denied) return denied;

        let parsed;
        try {
          parsed = bodySchema.parse(await readJson(request));
        } catch (err) {
          return errorResponse(err);
        }

        try {
          await assertRorkEntitled(parsed.user_id);
        } catch (err) {
          return errorResponse(err, 403);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (parsed.action === "create") {
          const { data: id, error } = await supabaseAdmin.rpc("admin_create_league", {
            _name: parsed.name,
            _rules: parsed.rules,
            _user_id: parsed.user_id,
            _sport: parsed.sport,
          });
          if (error) return errorResponse(new Error(error.message), 400);

          const { data: league } = await supabaseAdmin
            .from("leagues")
            .select("id, name, sport, code")
            .eq("id", id as string)
            .maybeSingle();
          return Response.json({ ok: true, league_id: id, league });
        }

        const { data: id, error } = await supabaseAdmin.rpc("admin_join_league_by_code", {
          _code: parsed.code,
          _user_id: parsed.user_id,
        });
        if (error) return errorResponse(new Error(error.message), 400);

        const { data: league } = await supabaseAdmin
          .from("leagues")
          .select("id, name, sport, code")
          .eq("id", id as string)
          .maybeSingle();
        return Response.json({ ok: true, league_id: id, league });
      },
    },
  },
});
