// Template email partage par tous les emails automatiques de Confia
// (resume quotidien, invitation d'equipe, relance manuelle).
// Centraliser ce template ici garantit que les trois emails restent
// visuellement coherents et que toute future evolution du design
// (couleurs, logo) ne se fasse qu'a un seul endroit.

export const BRAND = {
  teal: "#0D9488",
  ink: "#0F172A",
  inkSoft: "#64748B",
  paper: "#EEF1F5",
  line: "#E2E8F0",
  danger: "#DC2626",
  dangerBg: "#FEE2E2",
  warn: "#B45309",
  warnBg: "#FEF3C7",
  grey: "#64748B",
  greyBg: "#EEF1F5",
};

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

// Enrobe le contenu HTML fourni dans la mise en page commune : en-tete avec
// le logo Confia, carte blanche centree, pied de page avec mention legale.
export function renderEmailLayout({ title, bodyHtml, preheader }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
</head>
<body style="margin:0; padding:0; background-color:${BRAND.paper}; font-family:${FONT_STACK};">
${preheader ? `<div style="display:none; max-height:0; overflow:hidden; opacity:0;">${preheader}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.paper};">
  <tr>
    <td align="center" style="padding: 32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color:#ffffff; border-radius: 10px; overflow: hidden; border: 1px solid ${BRAND.line};">
        <tr>
          <td style="padding: 22px 32px; border-bottom: 1px solid ${BRAND.line};">
            <span style="font-family:${FONT_STACK}; font-size:17px; font-weight:700; color:${BRAND.teal}; letter-spacing:0.06em; text-transform:uppercase;">Confia</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 28px 32px; font-family:${FONT_STACK};">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding: 16px 32px; background-color:${BRAND.paper}; border-top: 1px solid ${BRAND.line};">
            <p style="margin:0; font-size:11.5px; line-height:1.6; color:${BRAND.inkSoft}; font-family:${FONT_STACK};">
              Confia — Suivi de conformité vaccinale pour le secteur médico-social.<br/>
              Cet email a été envoyé automatiquement, merci de ne pas y répondre directement.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// Bouton d'action stylise (fond teal, texte blanc), utilisable dans n'importe quel email.
export function renderButton(label, url) {
  return `<table role="presentation" cellpadding="0" cellspacing="0">
    <tr>
      <td style="border-radius:6px; background:${BRAND.teal};">
        <a href="${url}" style="display:inline-block; padding:12px 24px; font-family:${FONT_STACK}; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none;">${label}</a>
      </td>
    </tr>
  </table>`;
}

// Petit badge colore (ex. "Non conforme", "Echeance proche") pour les listes.
export function renderBadge(label, color, bg) {
  return `<span style="display:inline-block; padding:3px 9px; border-radius:4px; font-family:${FONT_STACK}; font-size:11px; font-weight:600; color:${color}; background:${bg}; white-space:nowrap;">${label}</span>`;
}

// Section listant des personnes avec un badge de statut (utilise par le resume quotidien).
export function renderStatusSection(title, items, color, bg) {
  if (!items.length) return "";
  const rows = items
    .map(
      (f) => `<tr>
        <td style="padding:9px 0; border-bottom:1px solid ${BRAND.line}; font-family:${FONT_STACK}; font-size:13px; color:${BRAND.ink};">
          <strong>${f.name}</strong> — ${f.vaccine}
        </td>
        <td style="padding:9px 0; border-bottom:1px solid ${BRAND.line}; text-align:right;">
          ${renderBadge(f.label, color, bg)}
        </td>
      </tr>`
    )
    .join("");
  return `<div style="margin-bottom:22px;">
    <div style="font-family:${FONT_STACK}; font-size:13px; font-weight:700; color:${BRAND.ink}; margin-bottom:8px;">${title} (${items.length})</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
  </div>`;
}
