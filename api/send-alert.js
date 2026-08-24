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
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Vigie <onboarding@resend.dev>",
        to: [toEmail],
        subject: "Relance conformite vaccinale - " + staffName,
        html:
          "<p>Bonjour,</p>" +
          "<p>Ceci est un rappel concernant le suivi vaccinal de <strong>" +
          staffName +
          "</strong> (" +
          establishmentName +
          ").</p>" +
          "<p><strong>Vaccin concerne :</strong> " +
          vaccine +
          "<br/><strong>Motif :</strong> " +
          reason +
          "</p>" +
          "<p>Merci de mettre a jour le justificatif correspondant dans Vigie des que possible.</p>" +
          "<p style='color:#888;font-size:12px;'>Cet email a ete envoye automatiquement par l'application Vigie.</p>",
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
