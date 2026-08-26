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
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Vigie <onboarding@resend.dev>",
        to: [toEmail],
        subject: "Invitation a rejoindre " + (organizationName || "une organisation") + " sur Vigie",
        html:
          "<p>Bonjour,</p>" +
          "<p><strong>" + (inviterEmail || "Un collegue") + "</strong> vous invite a rejoindre <strong>" +
          (organizationName || "son organisation") +
          "</strong> sur Vigie, l'outil de suivi de conformite vaccinale.</p>" +
          "<p>Pour rejoindre l'equipe, creez votre compte avec <strong>cette meme adresse email</strong> (" + toEmail + ") sur :</p>" +
          "<p><a href='https://vigie-ehpad.vercel.app'>https://vigie-ehpad.vercel.app</a></p>" +
          "<p style='color:#888;font-size:12px;'>Cet email a ete envoye automatiquement par Vigie.</p>",
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
