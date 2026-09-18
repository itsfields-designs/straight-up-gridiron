import { createFileRoute } from "@tanstack/react-router";

/**
 * Stripe tells us here when an SZN Pass purchase succeeds. Only a verified,
 * paid event issues the two $5 SZN Credits, and every event id is recorded so
 * a repeated delivery never pays twice.
 */
export const Route = createFileRoute("/api/public/stripe-webhook")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["STRIPE_WEBHOOK_SECRET"];
        const key = process.env["STRIPE_SECRET_KEY"];
        if (!secret || !key) return new Response("Not configured", { status: 500 });

        const signature = request.headers.get("stripe-signature");
        if (!signature) return new Response("Missing signature", { status: 400 });
        const body = await request.text();

        const { default: Stripe } = await import("stripe");
        const stripe = new Stripe(key);

        let event: import("stripe").Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(body, signature, secret);
        } catch {
          return new Response("Invalid signature", { status: 400 });
        }

        if (
          event.type !== "checkout.session.completed" &&
          event.type !== "checkout.session.async_payment_succeeded"
        ) {
          return Response.json({ received: true });
        }

        const session = event.data.object as import("stripe").Stripe.Checkout.Session;
        const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
        const meta = session.metadata ?? {};
        if (!paid || meta["product"] !== "szn_pass" || !meta["user_id"]) {
          return Response.json({ received: true, rewarded: false });
        }

        const { alreadyProcessed, claimStripeEvent, rewardReferral } = await import(
          "@/lib/referrals.server"
        );
        if (await alreadyProcessed(event.id)) {
          return Response.json({ received: true, duplicate: true });
        }

        try {
          const result = await rewardReferral({
            referredUserId: meta["user_id"],
            sessionId: session.id,
            eventId: event.id,
          });
          await claimStripeEvent(event.id, event.type);
          return Response.json({ received: true, rewarded: result.rewarded });
        } catch (err) {
          console.error("[stripe-webhook] reward failed", err);
          return new Response("Reward failed", { status: 500 });
        }

      },
    },
  },
});
