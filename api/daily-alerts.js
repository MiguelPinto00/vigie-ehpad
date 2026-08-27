import { renderEmailLayout, renderStatusSection, BRAND } from "../lib/emailTemplate.js";

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

  // Memes regles de calcul que dans l'application (src/App.jsx). A garder
  // synchronisees si ces valeurs changent un jour d'un cote ou de l'autre.
  const GRIPPE_VALIDITE_JOURS = 365;
  const GRIPPE_ALERTE_JOURS = 45;

  function computeVaccineStatus(vaccine, lastVaccinationDateStr) {
    if (!lastVaccinationDateStr) {
      return { status: "non_renseigne", label: "Date manquante" };
    }
    const lastDate = new Date(lastVaccinationDateStr + "T00:00:00");

    if (vaccine === "Rougeole") {
      return { status: "conforme", label: "A jour" };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiryDate = new Date(lastDate);
    expiryDate.setDate(expiryDate.getDate() + GRIPPE_VALIDITE_JOURS);
    const joursRestants = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
    const expiryLabel = expiryDate.toLocaleDateString("fr-FR");

    if (joursRestants < 0) {
      return { status: "non_conforme", label: "Echue le " + expiryLabel };
    }
    if (joursRestants <= GRIPPE_ALERTE_JOURS) {
      return { status: "a_venir", label: expiryLabel };
    }
    return { status: "conforme", label: expiryLabel };
  }

  try {
    const headers = { apikey: serviceKey, Authorization: "Bearer " + serviceKey };
    const [estabRes, staffRes] = await Promise.all([
      fetch(SUPABASE_URL + "/rest/v1/establishments?select=*", { headers }),
      fetch(SUPABASE_URL + "/rest/v1/staff?select=*,staff_vaccinations(*)", { headers }),
    ]);
    if (!estabRes.ok || !staffRes.ok) {
      const estabBody = await estabRes.text().catch(() => "");
      const staffBody = await staffRes.text().catch(() => "");
      throw new Error(
        "Erreur de lecture (etab " + estabRes.status + ": " + estabBody.slice(0, 150) +
        " | staff " + staffRes.status + ": " + staffBody.slice(0, 150) + ")"
      );
    }
    const establishments = await estabRes.json();
    const staffRows = await staffRes.json();

    const flagged = [];
    staffRows.forEach((s) => {
      (s.staff_vaccinations || []).forEach((v) => {
        const computed = computeVaccineStatus(v.vaccine, v.last_vaccination_date);
        if (computed.status !== "conforme") {
          flagged.push({
            establishment_id: s.establishment_id,
            name: s.name,
            vaccine: v.vaccine,
            status: computed.status,
            label: computed.label,
          });
        }
      });
    });

    const today = new Date().toLocaleDateString("fr-FR");

    let emailsSent = 0;
    const results = [];
    for (const estab of establishments) {
      const recipient = estab.contact_email || fallbackRecipient;
      if (!recipient) {
        results.push({ establishment: estab.name, skipped: "aucun email configure" });
        continue;
      }
      const estabFlagged = flagged.filter((f) => f.establishment_id === estab.id);
      const nonConformes = estabFlagged.filter((f) => f.status === "non_conforme");
      const aVenir = estabFlagged.filter((f) => f.status === "a_venir");
      const dateManquante = estabFlagged.filter((f) => f.status === "non_renseigne");

      if (nonConformes.length === 0 && aVenir.length === 0 && dateManquante.length === 0) {
        results.push({ establishment: estab.name, skipped: "rien a signaler" });
        continue;
      }

      const bodyHtml =
        `<p style="margin:0 0 4px; font-size:16px; font-weight:600; color:${BRAND.ink};">Resume quotidien</p>` +
        `<p style="margin:0 0 22px; font-size:13px; color:${BRAND.inkSoft};">${estab.name} — ${today}</p>` +
        renderStatusSection("Non conformes", nonConformes, BRAND.danger, BRAND.dangerBg) +
        renderStatusSection("Echeances proches", aVenir, BRAND.warn, BRAND.warnBg) +
        renderStatusSection("Dates manquantes (a completer)", dateManquante, BRAND.grey, BRAND.greyBg);

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + resendKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Confia <onboarding@resend.dev>",
          to: [recipient],
          subject: "Confia - Resume quotidien " + estab.name + " - " + today,
          html: renderEmailLayout({
            title: "Resume quotidien Confia",
            preheader: nonConformes.length + " non conforme(s), " + aVenir.length + " echeance(s) proche(s)",
            bodyHtml,
          }),
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
