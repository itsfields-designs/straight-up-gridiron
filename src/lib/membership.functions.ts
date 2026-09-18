import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";


export const SZN_PASS = {
  name: "The SZN Pass",
  priceId: "price_1UFQDrGiGKDpcCCVw7HtznqY",
  productId: "prod_VFw668RyufYXLj",
  priceLabel: "$49.99/year",
} as const;

async function stripeClient() {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("Stripe is not connected yet");
  const { default: Stripe } = await import("stripe");
  return new Stripe(key);
}

function origin(): string {
  const req = getRequest();
  return req?.headers.get("origin") ?? new URL(req?.url ?? "http://localhost").origin;
}

function userEmail(claims: Record<string, unknown>): string {
  const email = claims?.["email"];
  if (typeof email !== "string" || !email) throw new Error("No email on your account");
  return email;
}

export type MembershipStatus = {
  subscribed: boolean;
  subscriptionEnd: string | null;
  /** Account existed before The SZN Pass was required — keeps full access. */
  exempt: boolean;
  /** Allowed to create or join leagues. */
  entitled: boolean;
};

async function isExempt(userId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("membership_exempt")
    .eq("id", userId)
    .maybeSingle();
  return data?.membership_exempt === true;
}

async function membershipStatus(
  userId: string,
  claims: Record<string, unknown>,
): Promise<MembershipStatus> {
  const exempt = await isExempt(userId);
  if (exempt) return { subscribed: false, subscriptionEnd: null, exempt: true, entitled: true };

  const stripe = await stripeClient();
  const email = userEmail(claims);
  const customers = await stripe.customers.list({ email, limit: 1 });
  const customer = customers.data[0];
  const none = { subscribed: false, subscriptionEnd: null, exempt: false, entitled: false };
  if (!customer) return none;

  const subs = await stripe.subscriptions.list({
    customer: customer.id,
    status: "active",
    limit: 1,
  });
  const sub = subs.data[0];
  if (!sub) return none;
  const periodEnd = sub.items.data[0]?.current_period_end;
  return {
    subscribed: true,
    subscriptionEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    exempt: false,
    entitled: true,
  };
}

/** Throws unless the user may create or join leagues. */
export async function assertEntitled(userId: string, claims: Record<string, unknown>) {
  const status = await membershipStatus(userId, claims);
  if (!status.entitled)
    throw new Error("The SZN Pass is required before you can create or join a league.");
}

export const checkMembership = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }): Promise<MembershipStatus> =>
    membershipStatus(context.userId, context.claims as Record<string, unknown>),
  );

export const createSznCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ url: string }> => {
    const stripe = await stripeClient();
    const email = userEmail(context.claims as Record<string, unknown>);
    const customers = await stripe.customers.list({ email, limit: 1 });
    const customer = customers.data[0];

    const session = await stripe.checkout.sessions.create({
      ...(customer ? { customer: customer.id } : { customer_email: email }),
      line_items: [{ price: SZN_PASS.priceId, quantity: 1 }],
      mode: "subscription",
      ui_mode: "hosted_page",
      billing_address_collection: "auto",
      phone_number_collection: { enabled: false },
      automatic_tax: { enabled: false },
      allow_promotion_codes: true,
      payment_method_collection: "always",
      submit_type: "auto",
      saved_payment_method_options: { payment_method_save: "enabled" },
      origin_context: "web",
      success_url: `${origin()}/dashboard?membership=success`,
      cancel_url: `${origin()}/dashboard?membership=cancelled`,
    });
    if (!session.url) throw new Error("Stripe did not return a checkout link");
    return { url: session.url };
  });

export const openCustomerPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ url: string }> => {
    const stripe = await stripeClient();
    const email = userEmail(context.claims as Record<string, unknown>);
    const customers = await stripe.customers.list({ email, limit: 1 });
    const customer = customers.data[0];
    if (!customer) throw new Error("No Stripe customer found for your account");

    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${origin()}/dashboard`,
    });
    return { url: session.url };
  });
