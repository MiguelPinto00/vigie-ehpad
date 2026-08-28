import { renderEmailLayout, renderButton, BRAND } from "../lib/emailTemplate.js";
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Methode non autorisee" });
    return;
  }
  const { toEmail, staffName, establishmentName, vaccine, reason } = req.body || {};
  if (!toEmail || !staffName) {
    res.status(400).json({ error: "Parametres manquants" });
    return;
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Cle API email non configuree sur le serveur" });
    return;
  }
  try {
    const bodyHtml =
      `<p style="margin:0 0 16px; font-size:14px; color:${BRAND.ink};">Bonjour,</p>` +
      `<p style="margin:0 0 18px; font-size:14px; color:${BRAND.ink}; line-height:1.6;">` +
      `Ceci est un rappel concernant le suivi vaccinal de <strong>${staffName}</strong> (${establishmentName}).</p>` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px; background:${BRAND.paper}; border-radius:6px;">` +
      `<tr><td style="padding:14px 16px; font-size:13px; color:${BRAND.ink}; line-height:1.7;">` +
      `<strong>Vaccin concerne :</strong> ${vaccine}<br/>` +
      `<strong>Motif :</strong> ${reason}` +
      `</td></tr></table>` +
      `<p style="margin:0 0 24px; font-size:14px; color:${BRAND.ink}; line-height:1.6;">` +
      `Merci de mettre a jour le justificatif correspondant dans Confia des que possible.</p>` +
      renderButton("Ouvrir Confia", "https://vigie-ehpad.vercel.app");
    const textBody =
      "Bonjour,\n\n" +
      "Rappel concernant le suivi vaccinal de " + staffName + " (" + establishmentName + ").\n\n" +
      "Vaccin concerne : " + vaccine + "\n" +
      "Motif : " + reason + "\n\n" +
      "Merci de mettre a jour le justificatif correspondant dans Confia des que possible : https://vigie-ehpad.vercel.app\n";
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Confia <notifications@confia-app.fr>",
        to: [toEmail],
        subject: "Relance conformite vaccinale - " + staffName,
        html: renderEmailLayout({
          title: "Relance conformite vaccinale",
          preheader: "Rappel pour " + staffName + " (" + vaccine + ")",
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
    res.status(200).json({ success: true, id: data.id });
  } catch (err) {
    res.status(500).json({ error: err.message || "Erreur serveur" });
  }
}
