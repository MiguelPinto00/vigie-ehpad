import { renderEmailLayout, renderButton, BRAND } from "../lib/emailTemplate.js";
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Methode non autorisee" });
    return;
  }
  const { toEmail, organizationName, inviterEmail } = req.body || {};
  if (!toEmail) {
    res.status(400).json({ error: "Email manquant" });
    return;
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Cle API email non configuree" });
    return;
  }
  try {
    const bodyHtml =
      `<p style="margin:0 0 16px; font-size:14px; color:${BRAND.ink};">Bonjour,</p>` +
      `<p style="margin:0 0 16px; font-size:14px; color:${BRAND.ink}; line-height:1.6;">` +
      `<strong>${inviterEmail || "Un collègue"}</strong> vous invite à rejoindre <strong>${organizationName || "son organisation"}</strong> sur Confia, l'outil de suivi de conformité vaccinale pour le secteur médico-social.</p>` +
      `<p style="margin:0 0 26px; font-size:14px; color:${BRAND.ink}; line-height:1.6;">` +
      `Pour rejoindre l'équipe, créez votre compte avec <strong>cette même adresse email</strong> (${toEmail}).</p>` +
      renderButton("Rejoindre l'organisation", "https://vigie-ehpad.vercel.app");
    const textBody =
      "Bonjour,\n\n" +
      (inviterEmail || "Un collègue") +
      " vous invite à rejoindre " +
      (organizationName || "son organisation") +
      " sur Confia, l'outil de suivi de conformité vaccinale pour le secteur médico-social.\n\n" +
      "Pour rejoindre l'équipe, créez votre compte avec cette même adresse email (" +
      toEmail +
      ") sur https://vigie-ehpad.vercel.app\n";
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Confia <notifications@confia-app.fr>",
        to: [toEmail],
        // Si l'invite repond a cet email, sa reponse part directement vers
        // la personne qui l'a invite plutot que vers une adresse morte.
        reply_to: inviterEmail || undefined,
        subject: "Invitation à rejoindre " + (organizationName || "une organisation") + " sur Confia",
        html: renderEmailLayout({
          title: "Invitation Confia",
          preheader: (inviterEmail || "Un collègue") + " vous invite sur Confia",
          bodyHtml,
        }),
        text: textBody,
      }),
    });
    const data = await emailRes.json();
    if (!emailRes.ok) {
      res.status(emailRes.status).json({ error: data.message || "Echec de l'envoi" });
      return;
    }
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Erreur serveur" });
  }
}
