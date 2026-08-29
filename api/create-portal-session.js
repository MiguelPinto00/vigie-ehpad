import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Cree une session vers le "Portail client" de Stripe : une page hebergee
// par Stripe ou le client peut lui-meme resilier son abonnement, changer
// de moyen de paiement, ou consulter ses factures, sans que Confia ait
// besoin de construire une interface pour ca.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Methode non autorisee" });
    return;
  }

  const { customerId } = req.body || {};
  if (!customerId) {
    res.status(400).json({ error: "customerId manquant" });
    return;
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: "https://vigie-ehpad.vercel.app/?portal=return",
    });
    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Erreur Stripe portail client:", err);
    res.status(500).json({ error: err.message || "Erreur lors de l'ouverture du portail d'abonnement" });
  }
}
