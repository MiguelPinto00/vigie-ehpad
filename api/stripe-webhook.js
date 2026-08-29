import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL = "https://uhyiwqsyyikwguvlfira.supabase.co";

// Necessaire pour que Vercel nous laisse lire le corps brut de la requete,
// indispensable pour verifier la signature Stripe.
export const config = {
  api: {
    bodyParser: false,
  },
};

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

async function updateOrganization(organizationId, updates) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/organizations?id=eq." + organizationId, {
    method: "PATCH",
    headers: {
      apikey: process.env.SUPABASE_SERVICE_KEY,
      Authorization: "Bearer " + process.env.SUPABASE_SERVICE_KEY,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error("Echec de la mise a jour Supabase : " + res.status + " - " + body.slice(0, 200));
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Methode non autorisee" });
    return;
  }

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Signature webhook invalide:", err.message);
    res.status(400).json({ error: "Signature invalide" });
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const organizationId = session.client_reference_id;
        const plan = session.metadata?.plan;
        const period = session.metadata?.period;
        if (organizationId) {
          await updateOrganization(organizationId, {
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            subscription_status: "active",
            subscription_plan: plan || null,
            subscription_period: period || null,
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const organizationId = subscription.metadata?.organizationId;
        if (organizationId) {
          await updateOrganization(organizationId, {
            subscription_status: subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const organizationId = subscription.metadata?.organizationId;
        if (organizationId) {
          await updateOrganization(organizationId, {
            subscription_status: "canceled",
          });
        }
        break;
      }

      default:
        // Evenement non gere, on l'ignore simplement.
        break;
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("Erreur de traitement du webhook:", err);
    res.status(500).json({ error: err.message || "Erreur serveur" });
  }
}
