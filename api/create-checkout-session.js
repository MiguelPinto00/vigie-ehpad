import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICE_IDS = {
  solo: {
    monthly: "price_1U9WG3Iu6RBpaJu5c7rTvDf1",
    annual: "price_1U9jlhIu6RBpaJu5OK6N8eJb",
  },
  croissance: {
    monthly: "price_1U9jr4Iu6RBpaJu5iNuVRRLu",
    annual: "price_1U9jsBIu6RBpaJu51JLW3QlQ",
  },
  groupe: {
    monthly: "price_1U9jtaIu6RBpaJu5wTZbFplH",
    annual: "price_1U9juVIu6RBpaJu5cFpiGo5y",
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Methode non autorisee" });
    return;
  }

  const { plan, period, organizationId, customerEmail } = req.body || {};

  const priceId = PRICE_IDS[plan]?.[period];
  if (!priceId) {
    res.status(400).json({ error: "Plan ou periode invalide" });
    return;
  }
  if (!organizationId) {
    res.status(400).json({ error: "organizationId manquant" });
    return;
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: customerEmail || undefined,
      client_reference_id: organizationId,
      metadata: { organizationId, plan, period },
      success_url: "https://vigie-ehpad.vercel.app/?checkout=success",
      cancel_url: "https://vigie-ehpad.vercel.app/?checkout=canceled",
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Erreur Stripe checkout:", err);
    res.status(500).json({ error: err.message || "Erreur lors de la creation de la session de paiement" });
  }
}
