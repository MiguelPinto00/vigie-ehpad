export default async function handler(req, res) {
  // Verification que cet appel vient bien de la tache planifiee Vercel (secret partage)
  const authHeader = req.headers["authorization"];
  if (authHeader !== "Bearer " + process.env.CRON_SECRET) {
    res.status(401).json({ error: "Non autorise" });
    return;
  }

  const SUPABASE_URL = "https://uhyiwqsyyikwguvlfira.supabase.co";
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const fallbackRecipient = process.env.ALERT_RECIPIENT_EMAIL;

  if (!serviceKey || !resendKey) {
    res.status(500).json({ error: "Configuration serveur incomplete" });
    return;
  }

  try {
    const headers = { apikey: serviceKey, Authorization: "Bearer " + serviceKey };

    const [estabRes, staffRes] = await Promise.all([
      fetch(SUPABASE_URL + "/rest/v1/establishments?select=*", { headers }),
      fetch(SUPABASE_URL + "/rest/v1/staff?select=*", { headers }),
    ]);

    if (!estabRes.ok || !staffRes.ok) {
      throw new Error("Erreur de lecture de la base de donnees");
    }

    const establishments = await estabRes.json();
    const staff = await staffRes.json();
    const today = new Date().toLocaleDateString("fr-FR");

    const rowsHtml = (list, label) =>
      list.length === 0
        ? ""
        : "<h3>" +
          label +
          " (" +
          list.length +
          ")</h3><ul>" +
          list
            .map(
              (s) =>
                "<li><strong>" +
                s.name +
                "</strong> - " +
                s.vaccine +
                (s.next_label && s.next_label !== "-" ? " (" + s.next_label + ")" : "") +
                "</li>"
            )
            .join("") +
          "</ul>";

    let emailsSent = 0;
    const results = [];

    for (const estab of establishments) {
      const recipient = estab.contact_email || fallbackRecipient;
      if (!recipient) {
        results.push({ establishment: estab.name, skipped: "aucun email configure" });
        continue;
      }

      const estabStaff = staff.filter((s) => s.establishment_id === estab.id);
      const nonConformes = estabStaff.filter((s) => s.status === "non_conforme");
      const aVenir = estabStaff.filter((s) => s.status === "a_venir");

      if (nonConformes.length === 0 && aVenir.length === 0) {
        results.push({ establishment: estab.name, skipped: "rien a signaler" });
        continue;
      }

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + resendKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Vigie <onboarding@resend.dev>",
          to: [recipient],
          subject: "Vigie - Resume quotidien " + estab.name + " - " + today,
          html:
            "<p>Bonjour,</p><p>Voici le point de conformite vaccinale du jour pour <strong>" +
            estab.name +
            "</strong>.</p>" +
            rowsHtml(nonConformes, "Non conformes") +
            rowsHtml(aVenir, "Echeances proches") +
            "<p style='color:#888;font-size:12px;'>Cet email est envoye automatiquement chaque jour par Vigie.</p>",
        }),
      });

      if (emailRes.ok) {
        emailsSent += 1;
        results.push({ establishment: estab.name, sent: true, to: recipient });
      } else {
        const errData = await emailRes.json().catch(() => ({}));
        results.push({ establishment: estab.name, error: errData.message || "echec" });
      }
    }

    res.status(200).json({ success: true, emailsSent, results });
  } catch (err) {
    console.error("Erreur tache planifiee:", err);
    res.status(500).json({ error: err.message || "Erreur serveur" });
  }
}
