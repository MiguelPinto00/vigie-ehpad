import { renderEmailLayout, renderButton, renderBadge, BRAND } from "../lib/emailTemplate.js";

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
      return { status: "non_renseigne" };
    }
    const lastDate = new Date(lastVaccinationDateStr + "T00:00:00");

    if (vaccine === "Rougeole") {
      return { status: "conforme" };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiryDate = new Date(lastDate);
    expiryDate.setDate(expiryDate.getDate() + GRIPPE_VALIDITE_JOURS);
    const joursRestants = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));

    if (joursRestants < 0) {
      return { status: "non_conforme" };
    }
    if (joursRestants <= GRIPPE_ALERTE_JOURS) {
      return { status: "a_venir" };
    }
    return { status: "conforme" };
  }

  // Ligne de comptage sans aucun nom ni detail nominatif : seule l'app,
  // derriere authentification, donne acces au detail par salarie.
  function countRow(label, count, color, bg) {
    if (count === 0) return "";
    return `<tr>
      <td style="padding:9px 0; border-bottom:1px solid ${BRAND.line}; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size:13px; color:${BRAND.ink};">${label}</td>
      <td style="padding:9px 0; border-bottom:1px solid ${BRAND.line}; text-align:right;">${renderBadge(count + (count > 1 ? " salaries" : " salarie"), color, bg)}</td>
    </tr>`;
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

    // Aplati chaque personne en une entree par vaccin problematique, mais on
    // ne retient que le statut (pas de nom, pas de vaccin precis) puisque ces
    // details ne doivent plus apparaitre dans l'email.
    const flagged = [];
    staffRows.forEach((s) => {
      (s.staff_vaccinations || []).forEach((v) => {
        const computed = computeVaccineStatus(v.vaccine, v.last_vaccination_date);
        if (computed.status !== "conforme") {
          flagged.push({ establishment_id: s.establishment_id, status: computed.status });
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
      const nonConformesCount = estabFlagged.filter((f) => f.status === "non_conforme").length;
      const aVenirCount = estabFlagged.filter((f) => f.status === "a_venir").length;
      const dateManquanteCount = estabFlagged.filter((f) => f.status === "non_renseigne").length;

      if (nonConformesCount === 0 && aVenirCount === 0 && dateManquanteCount === 0) {
        results.push({ establishment: estab.name, skipped: "rien a signaler" });
        continue;
      }

      const transparencyNote =
        "Vous recevez cet email car vous etes designe comme contact de conformite pour " +
        estab.name +
        ". Pour proteger la confidentialite des donnees de sante de vos salaries, le detail nominatif n'apparait pas dans cet email : connectez-vous a Confia pour le consulter.";

      const bodyHtml =
        `<p style="margin:0 0 4px; font-size:16px; font-weight:600; color:${BRAND.ink};">Resume quotidien</p>` +
        `<p style="margin:0 0 22px; font-size:13px; color:${BRAND.inkSoft};">${estab.name} — ${today}</p>` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">` +
        countRow("Non conformes", nonConformesCount, BRAND.danger, BRAND.dangerBg) +
        countRow("Echeances proches", aVenirCount, BRAND.warn, BRAND.warnBg) +
        countRow("Dates manquantes", dateManquanteCount, BRAND.grey, BRAND.greyBg) +
        `</table>` +
        `<div style="margin-bottom:20px;">${renderButton("Voir le detail dans Confia", "https://vigie-ehpad.vercel.app")}</div>` +
        `<p style="margin:0; font-size:11.5px; color:${BRAND.inkSoft}; line-height:1.6;">${transparencyNote}</p>`;

      const textBody =
        "Resume quotidien - " + estab.name + " - " + today + "\n\n" +
        (nonConformesCount ? "Non conformes : " + nonConformesCount + "\n" : "") +
        (aVenirCount ? "Echeances proches : " + aVenirCount + "\n" : "") +
        (dateManquanteCount ? "Dates manquantes : " + dateManquanteCount + "\n" : "") +
        "\nVoir le detail dans Confia : https://vigie-ehpad.vercel.app\n\n" +
        transparencyNote + "\n";

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
            preheader: nonConformesCount + " non conforme(s), " + aVenirCount + " echeance(s) proche(s)",
            bodyHtml,
          }),
          text: textBody,
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
