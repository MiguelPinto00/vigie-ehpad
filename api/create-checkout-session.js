import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ============================================================
// PRICE IDS STRIPE
// ============================================================
// Ci-dessous, les Price IDs actuels du compte Stripe EN MODE TEST.
//
// >>> QUAND TU ACTIVES STRIPE EN PRODUCTION <<<
// 1. Va dans ton dashboard Stripe, en HAUT A DROITE bascule le toggle
//    "Mode test" sur "OFF" (tu passes en mode production/live).
// 2. Recree les memes 3 produits x 2 tarifs (Solo, Croissance, Groupe,
//    chacun en mensuel + annuel) EN MODE PRODUCTION.
// 3. Stripe va te donner 6 NOUVEAUX Price IDs (differents de ceux-ci,
//    ils commenceront quand meme par "price_" mais avec une suite de
//    caracteres differente).
// 4. Remplace UNIQUEMENT les valeurs ci-dessous par les nouveaux IDs
//    de production. Ne touche a rien d'autre dans ce fichier.
// 5. N'oublie pas aussi de remplacer la variable STRIPE_SECRET_KEY
//    dans Vercel par la cle secrete de PRODUCTION (elle commence par
//    "sk_live_" au lieu de "sk_test_").
// ============================================================
const PRICE_IDS = {
  solo: {
    monthly: "price_1U9WG3Iu6RBpaJu5c7rTvDf1", // TEST - a remplacer en production
    annual: "price_1U9jlhIu6RBpaJu5OK6N8eJb",  // TEST - a remplacer en production
  },
  croissance: {
    monthly: "price_1U9jr4Iu6RBpaJu5iNuVRRLu", // TEST - a remplacer en production
    annual: "price_1U9jsBIu6RBpaJu51JLW3QlQ",  // TEST - a remplacer en production
  },
  groupe: {
    monthly: "price_1U9jtaIu6RBpaJu5wTZbFplH", // TEST - a remplacer en production
    annual: "price_1U9juVIu6RBpaJu5cFpiGo5y",  // TEST - a remplacer en production
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
      // Permet de retrouver l'organisation concernee quand le webhook
      // recoit la confirmation de paiement initiale.
      client_reference_id: organizationId,
      metadata: { organizationId, plan, period },
      // Propage ces memes metadonnees sur l'abonnement Stripe lui-meme, pour
      // que les evenements futurs (renouvellement, annulation) permettent
      // aussi de retrouver l'organisation concernee.
      subscription_data: {
        metadata: { organizationId, plan, period },
      },
      success_url: "https://vigie-ehpad.vercel.app/?checkout=success",
      cancel_url: "https://vigie-ehpad.vercel.app/?checkout=canceled",
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Erreur Stripe checkout:", err);
    res.status(500).json({ error: err.message || "Erreur lors de la creation de la session de paiement" });
  }
}
