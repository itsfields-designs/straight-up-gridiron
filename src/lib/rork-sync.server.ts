/**
 * Shared helpers for the external Rork backend's secure endpoints.
 *
 * Rork cannot hold this project's service role key, so it authenticates with a
 * shared secret (RORK_SYNC_SECRET) and these handlers perform the privileged
 * work on its behalf.
 */

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Returns an error Response when the caller did not present the shared secret. */
export function authorizeRork(request: Request): Response | null {
  const expected = process.env["RORK_SYNC_SECRET"];
  if (!expected) return new Response("Not configured", { status: 503 });

  const header = request.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const apiKey = request.headers.get("x-api-key")?.trim() ?? "";
  const presented = bearer || apiKey;

  if (!presented || !constantTimeEqual(presented, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

/** Turns a thrown error into a clean JSON error response. */
export function errorResponse(err: unknown, status = 400): Response {
  const message = err instanceof Error ? err.message : "Request failed";
  return Response.json({ error: message }, { status });
}

/** Reads and JSON-parses the request body, or throws a readable error. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new Error("Invalid JSON body");
  }
}

/**
 * Confirms the user exists here and holds an active SZN Pass.
 * Checks the synced membership table, the founding-member exemption, then
 * Stripe directly (so passes that have not synced yet still work).
 */
export async function assertRorkEntitled(userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (authError || !authUser?.user) throw new Error("Unknown user");

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("membership_exempt")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.membership_exempt === true) return;

  const { data: membership } = await supabaseAdmin
    .from("szn_memberships")
    .select("status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (
    membership &&
    (membership.status === "active" || membership.status === "trialing") &&
    (!membership.current_period_end ||
      new Date(membership.current_period_end).getTime() > Date.now())
  ) {
    return;
  }

  const email = authUser.user.email;
  const key = process.env["STRIPE_SECRET_KEY"];
  if (email && key) {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(key);
    const customers = await stripe.customers.list({ email, limit: 1 });
    const customer = customers.data[0];
    if (customer) {
      const subs = await stripe.subscriptions.list({
        customer: customer.id,
        status: "active",
        limit: 1,
      });
      if (subs.data[0]) return;
    }
  }

  throw new Error("The SZN Pass is required for this action.");
}

/** A rule error with the HTTP status the Rork backend should receive. */
export class RorkError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** JSON body helper that always sets the application/json content type. */
export function rorkJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Turns any thrown value into the JSON error envelope Rork expects. */
export function rorkError(err: unknown): Response {
  if (err instanceof RorkError) return rorkJson({ error: err.message }, err.status);
  if (err && typeof err === "object" && "issues" in err) {
    const issues = (err as { issues: { path: (string | number)[]; message: string }[] }).issues;
    const first = issues[0];
    const where = first?.path?.length ? `${first.path.join(".")}: ` : "";
    return rorkJson({ error: `${where}${first?.message ?? "Invalid request"}` }, 400);
  }
  const message = err instanceof Error ? err.message : "Request failed";
  return rorkJson({ error: message }, 400);
}

/** Confirms the account exists in auth. Rork has already verified the identity. */
export async function assertRorkUserExists(userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data?.user) throw new RorkError("Account not found.", 404);
}
