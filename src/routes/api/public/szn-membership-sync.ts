import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Secure sync endpoint for the external Rork backend.
 *
 * Rork cannot hold this project's service role key, so instead it authenticates
 * with a shared secret (RORK_SYNC_SECRET) and this handler performs the
 * privileged write on its behalf. Nothing here is reachable without the secret.
 */

const isoDate = z.string().datetime({ offset: true }).nullish();

const bodySchema = z.object({
  user_id: z.string().uuid(),
  stripe_customer_id: z.string().min(1).max(255),
  stripe_subscription_id: z.string().min(1).max(255).nullish(),
  status: z.enum([
    "active",
    "trialing",
    "past_due",
    "canceled",
    "incomplete",
    "incomplete_expired",
    "unpaid",
    "paused",
  ]),
  price_id: z.string().min(1).max(255).nullish(),
  current_period_end: isoDate,
  cancel_at_period_end: z.boolean().optional(),
  canceled_at: isoDate,
  ended_at: isoDate,
  last_payment_at: isoDate,
  last_payment_failed_at: isoDate,
});

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function authorize(request: Request): Response | null {
  const expected = process.env["RORK_SYNC_SECRET"];
  if (!expected) return new Response("Not configured", { status: 503 });

  const header = request.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const apiKey = request.headers.get("x-api-key")?.trim() ?? "";
  const presented = bearer || apiKey;

  if (!presented || !timingSafeEqual(presented, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

export const Route = createFileRoute("/api/public/szn-membership-sync")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      // Health / status probe: Rork can confirm the secret and table are live.
      GET: async ({ request }) => {
        const denied = authorize(request);
        if (denied) return denied;

        const url = new URL(request.url);
        const userId = url.searchParams.get("user_id");
        const customerId = url.searchParams.get("stripe_customer_id");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (!userId && !customerId) {
          const { error } = await supabaseAdmin
            .from("szn_memberships")
            .select("user_id", { count: "exact", head: true });
          return Response.json({ ok: !error, membershipTable: !error, secretConfigured: true });
        }

        if (userId && !z.string().uuid().safeParse(userId).success) {
          return new Response("Invalid user_id", { status: 400 });
        }

        let query = supabaseAdmin
          .from("szn_memberships")
          .select(
            "user_id, status, stripe_customer_id, stripe_subscription_id, price_id, current_period_end, cancel_at_period_end, canceled_at, ended_at, last_payment_at, last_payment_failed_at",
          )
          .limit(1);
        query = userId
          ? query.eq("user_id", userId)
          : query.eq("stripe_customer_id", customerId as string);

        const { data, error } = await query.maybeSingle();
        if (error) {
          console.error("[szn-membership-sync] read failed", error);
          return new Response("Read failed", { status: 500 });
        }
        if (!data) return Response.json({ found: false, active: false });

        const active =
          (data.status === "active" || data.status === "trialing") &&
          (!data.current_period_end || new Date(data.current_period_end).getTime() > Date.now());

        return Response.json({ found: true, active, membership: data });
      },

      // Upsert a member's subscription state.
      POST: async ({ request }) => {
        const denied = authorize(request);
        if (denied) return denied;

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const parsed = bodySchema.safeParse(raw);
        if (!parsed.success) {
          return Response.json(
            { error: "Invalid payload", issues: parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message) },
            { status: 400 },
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // The user must exist in this project's auth before we mirror their pass.
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(
          parsed.data.user_id,
        );
        if (authError || !authUser?.user) {
          return new Response("Unknown user", { status: 404 });
        }

        const row = {
          ...parsed.data,
          stripe_subscription_id: parsed.data.stripe_subscription_id ?? null,
          price_id: parsed.data.price_id ?? null,
          current_period_end: parsed.data.current_period_end ?? null,
          canceled_at: parsed.data.canceled_at ?? null,
          ended_at: parsed.data.ended_at ?? null,
          last_payment_at: parsed.data.last_payment_at ?? null,
          last_payment_failed_at: parsed.data.last_payment_failed_at ?? null,
          cancel_at_period_end: parsed.data.cancel_at_period_end ?? false,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabaseAdmin
          .from("szn_memberships")
          .upsert(row, { onConflict: "user_id" });

        if (error) {
          console.error("[szn-membership-sync] upsert failed", error);
          return new Response("Write failed", { status: 500 });
        }

        return Response.json({ ok: true, user_id: parsed.data.user_id, status: parsed.data.status });
      },
    },
  },
});
