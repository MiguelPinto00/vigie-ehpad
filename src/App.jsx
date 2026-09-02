import React, { useState, useMemo, useEffect } from "react";
import { jsPDF } from "jspdf";
import {
  LayoutDashboard,
  Users,
  BellRing,
  FileDown,
  Search,
  Plus,
  X,
  Menu,
  ChevronRight,
  Building2,
  Loader2,
  Settings,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  ShieldCheck,
  ClipboardCheck,
  CreditCard,
  Upload,
  History,
  Camera,
} from "lucide-react";

const TOKENS = {
  paper: "#EEF1F5",
  paperDim: "#EEF1F5",
  ink: "#0F172A",
  inkSoft: "#64748B",
  brand: "#0D9488",
  ok: "#059669",
  okBg: "#D1FAE5",
  warn: "#B45309",
  warnBg: "#FEF3C7",
  danger: "#DC2626",
  dangerBg: "#FEE2E2",
  line: "#E2E8F0",
};

const FONTS_LINK =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap";

// Liste des offres Confia, partagee entre la page d'accueil publique
// (avant inscription) et la page Parametres (apres inscription), pour
// n'avoir qu'un seul endroit a modifier si les prix ou fonctionnalites changent.
const PLANS = [
  {
    key: "solo",
    name: "Solo",
    monthly: "39\u20ac",
    annual: "390\u20ac",
    tagline: "Pour un établissement isolé",
    features: ["1 établissement", "Salariés illimités", "Alertes automatiques quotidiennes", "Export PDF", "Upload de justificatifs", "2 membres d'équipe"],
  },
  {
    key: "croissance",
    name: "Croissance",
    monthly: "99\u20ac",
    annual: "990\u20ac",
    tagline: "Pour les petits groupes",
    features: ["Jusqu'à 3 établissements", "Alertes automatiques quotidiennes", "Jusqu'à 6 membres d'équipe", "Tout Solo inclus"],
    highlighted: true,
  },
  {
    key: "groupe",
    name: "Groupe",
    monthly: "249\u20ac",
    annual: "2490\u20ac",
    tagline: "Pour les grands groupes",
    features: ["Jusqu'à 10 établissements", "Membres d'équipe illimités", "Support prioritaire", "Tout Croissance inclus"],
  },
];

function LogoMark({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <path
        d="M 5 24 L 13 24 L 18 8 L 23 33 L 28 24 L 35 24"
        stroke="#0D9488"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

const SUPABASE_URL = "https://uhyiwqsyyikwguvlfira.supabase.co";
const SUPABASE_KEY = "sb_publishable_ggavuXHi0hGp1KSAS2edUw_jHIHY8Bf";
const SESSION_KEY = "vigie_session";

function getStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveSession(session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (e) {
    console.error("Impossible d'enregistrer la session:", e);
  }
}

function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (e) {
    // ignore
  }
}

function authHeaders(accessToken) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: "Bearer " + (accessToken || SUPABASE_KEY),
    "Content-Type": "application/json",
  };
}

// Effectue une mise a jour (PATCH) et s'assure qu'elle a reellement modifie
// une ligne. Sans ce controle, une regle de securite (RLS) manquante en
// base de donnees peut bloquer silencieusement une sauvegarde : la requete
// repond "200 OK" mais avec un tableau vide, ce qui donnait auparavant
// l'illusion trompeuse d'un succes alors que rien n'avait ete enregistre.
// Centraliser ce controle ici garantit qu'aucune future fonctionnalite ne
// pourra reproduire ce bug par oubli.
async function patchAndExpectRow(url, body, token, actionLabel) {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { ...authHeaders(token), Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error("Erreur lors de " + actionLabel + " : " + res.status + " - " + errBody.slice(0, 150));
  }
  const data = await res.json();
  if (!data || data.length === 0) {
    throw new Error(
      "La modification n'a pas ete enregistree (droits d'accès insuffisants pour : " + actionLabel + "). Contactez le support."
    );
  }
  return data[0];
}

async function signUp(email, password, orgName) {
  const res = await fetch(SUPABASE_URL + "/auth/v1/signup", {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, data: { org_name: orgName } }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.error_description || "Erreur d'inscription");
  return data;
}

async function signIn(email, password) {
  const res = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Identifiants incorrects");
  return data;
}

async function requestPasswordReset(email) {
  const res = await fetch(SUPABASE_URL + "/auth/v1/recover", {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.msg || data.error_description || "Erreur lors de l'envoi");
  }
  return true;
}

// Renvoie l'email de confirmation d'inscription, pour les cas ou il n'est
// jamais arrive ou a ete supprime par erreur. Supabase renvoie un succes
// meme si le compte n'existe pas ou est deja confirme (pour ne pas reveler
// si un email est enregistre), donc on affiche toujours un message neutre.
async function resendConfirmationEmail(email) {
  const res = await fetch(SUPABASE_URL + "/auth/v1/resend", {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "signup", email }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.msg || data.error_description || "Erreur lors de l'envoi");
  }
  return true;
}

async function updatePasswordWithToken(accessToken, newPassword) {
  const res = await fetch(SUPABASE_URL + "/auth/v1/user", {
    method: "PUT",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password: newPassword }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.error_description || "Erreur lors du changement de mot de passe");
  return data;
}

// Demande le changement d'adresse email du compte connecte. Supabase envoie
// un email de confirmation a la nouvelle adresse (et parfois aussi a
// l'ancienne, selon la configuration du projet) avant que le changement soit
// definitivement applique : rien ne change immediatement cote affichage.
async function updateEmailWithToken(accessToken, newEmail) {
  const res = await fetch(SUPABASE_URL + "/auth/v1/user", {
    method: "PUT",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: newEmail }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.error_description || "Erreur lors du changement d'email");
  return data;
}

async function fetchEstablishments(token) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/establishments?select=*", {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error("establishments " + res.status + " - " + body.slice(0, 200));
  }
  return res.json();
}

async function fetchStaff(token) {
  const res = await fetch(
    SUPABASE_URL + "/rest/v1/staff?select=*,staff_vaccinations(*),staff_history(*)",
    { headers: authHeaders(token) }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error("staff " + res.status + " - " + body.slice(0, 200));
  }
  return res.json();
}

async function insertStaffPerson(row, token) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/staff", {
    method: "POST",
    headers: { ...authHeaders(token), Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error("Erreur d'enregistrement du salarié");
  const data = await res.json();
  return data[0];
}

async function updateStaffPerson(id, updates, token) {
  return patchAndExpectRow(SUPABASE_URL + "/rest/v1/staff?id=eq." + id, updates, token, "la mise à jour du salarié");
}

async function deleteStaffPerson(id, token) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/staff?id=eq." + id, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Erreur de suppression");
  return true;
}

// Cree ou met a jour le suivi d'un vaccin precis pour un salarie donne.
// Si vaccinationId est fourni, met a jour la fiche existante ; sinon en cree une nouvelle.
async function upsertVaccination(payload, vaccinationId, token) {
  if (vaccinationId) {
    const res = await fetch(SUPABASE_URL + "/rest/v1/staff_vaccinations?id=eq." + vaccinationId, {
      method: "PATCH",
      headers: { ...authHeaders(token), Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Erreur de mise à jour du suivi vaccinal");
    const data = await res.json();
    return data[0];
  }
  const res = await fetch(SUPABASE_URL + "/rest/v1/staff_vaccinations", {
    method: "POST",
    headers: { ...authHeaders(token), Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Erreur de creation du suivi vaccinal");
  const data = await res.json();
  return data[0];
}

// Enregistre un evenement dans l'historique d'un salarie (creation, import,
// mise a jour d'un justificatif...). Ces entrees ne sont jamais modifiees ni
// supprimees : elles servent de journal chronologique consultable en cas de
// controle, pour prouver le suivi dans le temps et pas seulement l'etat present.
async function insertHistoryEvent(payload, token) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/staff_history", {
    method: "POST",
    headers: { ...authHeaders(token), Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    // On ne bloque jamais l'action principale (ajout/import d'un salarie) si
    // seul le journal d'historique echoue : on log l'erreur et on continue.
    console.error("Erreur d'enregistrement de l'historique:", await res.text().catch(() => ""));
    return null;
  }
  const data = await res.json();
  return data[0];
}

async function fetchHistoryForStaff(staffId, token) {
  const res = await fetch(
    SUPABASE_URL + "/rest/v1/staff_history?staff_id=eq." + staffId + "&select=*&order=created_at.desc",
    { headers: authHeaders(token) }
  );
  if (!res.ok) throw new Error("Erreur de lecture de l'historique");
  return res.json();
}


async function fetchOrganizationMembers(organizationId, token) {
  const res = await fetch(
    SUPABASE_URL + "/rest/v1/organization_members?organization_id=eq." + organizationId + "&select=*",
    { headers: authHeaders(token) }
  );
  if (!res.ok) throw new Error("Erreur de lecture des membres");
  return res.json();
}

async function fetchInvitations(organizationId, token) {
  const res = await fetch(
    SUPABASE_URL + "/rest/v1/invitations?organization_id=eq." + organizationId + "&accepted=eq.false&select=*",
    { headers: authHeaders(token) }
  );
  if (!res.ok) throw new Error("Erreur de lecture des invitations");
  return res.json();
}

async function createInvitation(email, organizationId, token) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/invitations", {
    method: "POST",
    headers: { ...authHeaders(token), Prefer: "return=representation" },
    body: JSON.stringify({ email, organization_id: organizationId }),
  });
  if (!res.ok) throw new Error("Erreur de creation de l'invitation");
  const data = await res.json();
  return data[0];
}

async function deleteInvitation(id, token) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/invitations?id=eq." + id, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Erreur de suppression de l'invitation");
  return true;
}

async function checkAndInvite(email, organizationId) {
  const res = await fetch("/api/check-and-invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, organizationId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur lors de la vérification du compte");
  return data;
}

async function removeOrganizationMember(userId, organizationId, token) {
  const res = await fetch(
    SUPABASE_URL +
      "/rest/v1/organization_members?user_id=eq." +
      userId +
      "&organization_id=eq." +
      organizationId,
    {
      method: "DELETE",
      headers: authHeaders(token),
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error("Erreur lors du retrait du membre : " + res.status + " - " + body.slice(0, 150));
  }
  return true;
}

async function renameOrganization(organizationId, newName, token) {
  return patchAndExpectRow(
    SUPABASE_URL + "/rest/v1/organizations?id=eq." + organizationId,
    { name: newName },
    token,
    "le renommage de l'organisation"
  );
}

// Met a jour le nom affiche du membre courant au sein d'une organisation.
// Filtre a la fois par organization_id et user_id pour ne jamais pouvoir
// modifier le nom affiche d'un autre membre.
async function updateMemberDisplayName(organizationId, userId, displayName, token) {
  return patchAndExpectRow(
    SUPABASE_URL + "/rest/v1/organization_members?organization_id=eq." + organizationId + "&user_id=eq." + userId,
    { display_name: displayName },
    token,
    "la mise à jour du nom affiché"
  );
}

// Recupere le role, le nom affiche et la photo de profil du membre courant
// au sein de son organisation. Utilise pour afficher les bonnes infos
// personnelles dans l'en-tete de l'application, independamment du nom de
// l'organisation elle-meme.
async function fetchOwnMembership(organizationId, userId, token) {
  const res = await fetch(
    SUPABASE_URL +
      "/rest/v1/organization_members?organization_id=eq." + organizationId + "&user_id=eq." + userId +
      "&select=display_name,avatar_url,role&limit=1",
    { headers: authHeaders(token) }
  );
  if (!res.ok) throw new Error("Erreur de lecture du profil");
  const data = await res.json();
  return data[0] || null;
}

// Envoie une photo de profil dans le bucket public "avatars", sous un
// chemin propre a l'utilisateur (userId/avatar.<extension>). Le meme chemin
// est toujours reutilise (x-upsert) pour qu'une nouvelle photo remplace
// l'ancienne au lieu d'accumuler des fichiers orphelins. Un parametre
// "t=" est ajoute a l'URL pour forcer le navigateur a recharger l'image
// plutot que d'afficher une ancienne version mise en cache.
async function uploadAvatarImage(file, userId, token) {
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = userId + "/avatar." + ext;
  const uploadRes = await fetch(SUPABASE_URL + "/storage/v1/object/avatars/" + path, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: "Bearer " + token,
      "Content-Type": file.type || "application/octet-stream",
      "x-upsert": "true",
    },
    body: file,
  });
  if (!uploadRes.ok) {
    const body = await uploadRes.text().catch(() => "");
    throw new Error("Echec de l'upload de la photo : " + uploadRes.status + " - " + body.slice(0, 150));
  }
  return SUPABASE_URL + "/storage/v1/object/public/avatars/" + path + "?t=" + Date.now();
}

async function updateMemberAvatarUrl(organizationId, userId, avatarUrl, token) {
  return patchAndExpectRow(
    SUPABASE_URL + "/rest/v1/organization_members?organization_id=eq." + organizationId + "&user_id=eq." + userId,
    { avatar_url: avatarUrl },
    token,
    "la mise à jour de la photo de profil"
  );
}

async function updateAlertThreshold(organizationId, days, token) {
  return patchAndExpectRow(
    SUPABASE_URL + "/rest/v1/organizations?id=eq." + organizationId,
    { alert_threshold_days: days },
    token,
    "la mise à jour du seuil d'alerte"
  );
}

async function updateEstablishmentDetails(establishmentId, updates, token) {
  return patchAndExpectRow(
    SUPABASE_URL + "/rest/v1/establishments?id=eq." + establishmentId,
    updates,
    token,
    "la mise à jour de l'établissement"
  );
}

async function deleteEstablishment(establishmentId, token) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/establishments?id=eq." + establishmentId, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Erreur de suppression");
  return true;
}

async function fetchMyOrganization(token) {
  const res = await fetch(
    SUPABASE_URL +
      "/rest/v1/organization_members?select=organization_id,organizations(id,name,subscription_status,subscription_plan,subscription_period,current_period_end,stripe_customer_id,alert_threshold_days,trial_ends_at)&limit=1",
    { headers: authHeaders(token) }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error("organization " + res.status + " - " + body.slice(0, 150));
  }
  const data = await res.json();
  const row = data[0];
  return {
    id: row?.organization_id || null,
    name: row?.organizations?.name || null,
    subscriptionStatus: row?.organizations?.subscription_status || "inactive",
    subscriptionPlan: row?.organizations?.subscription_plan || null,
    subscriptionPeriod: row?.organizations?.subscription_period || null,
    currentPeriodEnd: row?.organizations?.current_period_end || null,
    stripeCustomerId: row?.organizations?.stripe_customer_id || null,
    alertThresholdDays: row?.organizations?.alert_threshold_days ?? 45,
    trialEndsAt: row?.organizations?.trial_ends_at || null,
  };
}

async function createPortalSession(customerId) {
  const res = await fetch("/api/create-portal-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customerId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur lors de l'ouverture du portail d'abonnement");
  return data.url;
}

async function createCheckoutSession(plan, period, organizationId, customerEmail) {
  const res = await fetch("/api/create-checkout-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, period, organizationId, customerEmail }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur lors de la creation du paiement");
  return data.url;
}

async function insertEstablishment(name, city, organizationId, token) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/establishments", {
    method: "POST",
    headers: { ...authHeaders(token), Prefer: "return=representation" },
    body: JSON.stringify({ name, city, organization_id: organizationId }),
  });
  if (!res.ok) throw new Error("Erreur de creation de l'établissement");
  const data = await res.json();
  return data[0];
}

async function uploadJustificatif(file, token) {
  const safeName = Date.now() + "-" + file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const uploadRes = await fetch(SUPABASE_URL + "/storage/v1/object/justificatifs/" + safeName, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: "Bearer " + token,
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });
  if (!uploadRes.ok) {
    const body = await uploadRes.text().catch(() => "");
    throw new Error("Echec de l'upload : " + uploadRes.status + " - " + body.slice(0, 150));
  }

  // Genere un lien signe valable 1 an pour pouvoir consulter le document plus tard
  const signRes = await fetch(SUPABASE_URL + "/storage/v1/object/sign/justificatifs/" + safeName, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 365 }),
  });
  if (!signRes.ok) throw new Error("Echec de la génération du lien du document");
  const signData = await signRes.json();
  return SUPABASE_URL + "/storage/v1" + signData.signedURL;
}

// Calcule le statut/echeance de chaque suivi vaccinal d'une personne
function computePersonVaccinations(row, alertThresholdDays) {
  return (row.staff_vaccinations || []).map((v) => {
    // Si aucune vraie date n'est enregistree, on ne devine jamais un statut
    // a partir d'une ancienne valeur saisie a la main : on l'affiche
    // clairement comme "Date manquante" plutot que de risquer d'afficher
    // "Non conforme" ou "À jour" de facon trompeuse.
    if (!v.last_vaccination_date) {
      return {
        id: v.id,
        vaccine: v.vaccine,
        lastVaccinationDate: "",
        documentUrl: v.document_url,
        status: "non_renseigne",
        updated: "-",
        next: "",
      };
    }
    const computed = computeVaccineCompliance(v.vaccine, v.last_vaccination_date, alertThresholdDays);
    return {
      id: v.id,
      vaccine: v.vaccine,
      lastVaccinationDate: v.last_vaccination_date,
      documentUrl: v.document_url,
      status: computed.status,
      updated: computed.updatedLabel,
      next: computed.nextLabel,
    };
  });
}

// Statut global d'une personne = le pire statut parmi ses vaccins suivis.
// Une date manquante compte comme un probleme a regler (on ne peut pas
// prouver la conformite sans date), au meme titre qu'une non-conformite averee.
// Aucun vaccin suivi du tout => consideree non conforme (rien sur le dossier).
function computeOverallStatus(vaccinations) {
  if (vaccinations.length === 0) return "non_conforme";
  if (vaccinations.some((v) => v.status === "non_conforme" || v.status === "non_renseigne")) return "non_conforme";
  if (vaccinations.some((v) => v.status === "a_venir")) return "a_venir";
  return "conforme";
}

// Convertit une ligne Supabase (personne + ses suivis vaccinaux imbriques)
// vers le format utilise par l'interface
function mapPersonRow(row, alertThresholdDays) {
  const vaccinations = computePersonVaccinations(row, alertThresholdDays);
  const history = (row.staff_history || [])
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map((h) => ({
      id: h.id,
      eventType: h.event_type,
      description: h.description,
      createdAt: h.created_at,
    }));
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    site: row.establishment_id,
    vaccinations,
    history,
    status: computeOverallStatus(vaccinations),
  };
}

const STATUS_META = {
  conforme: { label: "À jour", color: TOKENS.ok, bg: TOKENS.okBg },
  a_venir: { label: "Échéance proche", color: TOKENS.warn, bg: TOKENS.warnBg },
  non_conforme: { label: "Non conforme", color: TOKENS.danger, bg: TOKENS.dangerBg },
  non_renseigne: { label: "Date manquante", color: TOKENS.inkSoft, bg: TOKENS.paperDim },
};

function Seal({ status }) {
  const meta = STATUS_META[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 500,
        color: meta.color,
        background: meta.bg,
        border: "1px solid " + meta.color + "22",
        fontFamily: "'Inter', sans-serif",
        letterSpacing: "0.01em",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: meta.color }} />
      {meta.label}
    </span>
  );
}

function NonSuiviBadge() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 500,
        color: TOKENS.inkSoft,
        background: TOKENS.paperDim,
        border: "1px solid " + TOKENS.line,
        fontFamily: "'Inter', sans-serif",
        letterSpacing: "0.01em",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: TOKENS.inkSoft, opacity: 0.5 }} />
      Non suivi
    </span>
  );
}

// Cellule compacte pour un vaccin donne : badge de statut + echeance + lien
// justificatif explicite, empiles verticalement.
function VaccineCell({ vaccination }) {
  if (!vaccination) return <NonSuiviBadge />;
  return (
    <div>
      <Seal status={vaccination.status} />
      {vaccination.next && (
        <div
          style={{
            fontSize: 11.5,
            marginTop: 4,
            fontFamily: "'IBM Plex Mono', monospace",
            color: vaccination.status === "non_conforme" ? TOKENS.danger : TOKENS.inkSoft,
          }}
        >
          {vaccination.next}
        </div>
      )}
      {vaccination.documentUrl && (
        <a
          href={vaccination.documentUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "block", marginTop: 3, fontSize: 11, color: TOKENS.brand, textDecoration: "underline" }}
        >
          Voir le justificatif
        </a>
      )}
    </div>
  );
}

function BeamGauge({ percent }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  return (
    <div style={{ position: "relative", width: 132, height: 132 }}>
      <svg width={132} height={132} viewBox="0 0 132 132">
        <circle cx={66} cy={66} r={r} fill="none" stroke={TOKENS.line} strokeWidth={10} />
        <circle
          cx={66}
          cy={66}
          r={r}
          fill="none"
          stroke={TOKENS.brand}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 66 66)"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 30, fontWeight: 600, color: TOKENS.ink, lineHeight: 1 }}>
          {percent}%
        </div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: TOKENS.inkSoft, marginTop: 4 }}>
          conformité
        </div>
      </div>
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "9px 12px",
        borderRadius: 7,
        border: "none",
        background: active ? TOKENS.brand + "14" : "transparent",
        color: active ? TOKENS.brand : TOKENS.inkSoft,
        fontFamily: "'Inter', sans-serif",
        fontSize: 13.5,
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        textAlign: "left",
        transition: "background 0.15s ease, color 0.15s ease",
      }}
    >
      <Icon size={16} strokeWidth={2} />
      {label}
    </button>
  );
}

// Le menu lateral. Sur ordinateur, il reste affiche en permanence sur le
// cote, comme avant. Sur mobile (isMobile = true), il est cache par defaut
// et s'affiche en superposition (par-dessus le contenu, pas a cote) quand
// on ouvre le bouton menu (icone hamburger) situe dans l'en-tete.
function Sidebar({ view, setView, establishmentCount, isMobile, open, onNavigate }) {
  const baseStyle = {
    width: 224,
    flexShrink: 0,
    background: "#FFFFFF",
    borderRight: "1px solid " + TOKENS.line,
    padding: "20px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minHeight: "100%",
  };

  const mobileStyle = {
    ...baseStyle,
    position: "fixed",
    top: 0,
    left: 0,
    height: "100vh",
    minHeight: "100vh",
    zIndex: 110,
    boxShadow: "2px 0 20px rgba(15, 23, 42, 0.18)",
    transform: open ? "translateX(0)" : "translateX(-100%)",
    transition: "transform 0.25s ease",
  };

  const handleNav = (v) => {
    setView(v);
    if (isMobile && onNavigate) onNavigate();
  };

  return (
    <>
      {isMobile && open && (
        <div
          onClick={onNavigate}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.4)",
            zIndex: 105,
          }}
        />
      )}
      <div style={isMobile ? mobileStyle : baseStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 10px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: TOKENS.paperDim,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <LogoMark size={17} />
            </div>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 17, fontWeight: 700, color: TOKENS.ink, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Confia
            </span>
          </div>
          {isMobile && (
            <button
              onClick={onNavigate}
              aria-label="Fermer le menu"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 28,
                height: 28,
                borderRadius: 6,
                border: "none",
                background: "transparent",
                color: TOKENS.inkSoft,
                cursor: "pointer",
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>
        <NavItem icon={LayoutDashboard} label="Tableau de bord" active={view === "dashboard"} onClick={() => handleNav("dashboard")} />
        <NavItem icon={Users} label="Salariés" active={view === "staff"} onClick={() => handleNav("staff")} />
        <NavItem icon={BellRing} label="Alertes" active={view === "alerts"} onClick={() => handleNav("alerts")} />
        <NavItem icon={FileDown} label="Rapports" active={view === "reports"} onClick={() => handleNav("reports")} />
        <NavItem icon={CreditCard} label="Abonnement" active={view === "abonnement"} onClick={() => handleNav("abonnement")} />
        <NavItem icon={Settings} label="Paramètres" active={view === "settings"} onClick={() => handleNav("settings")} />
        <div style={{ marginTop: 20, padding: "12px 10px 4px", borderTop: "1px solid " + TOKENS.line }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, color: TOKENS.inkSoft }}>
            {establishmentCount} établissement{establishmentCount === 1 ? "" : "s"} suivi{establishmentCount === 1 ? "" : "s"}
          </div>
        </div>
      </div>
    </>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
        borderRadius: 8,
        padding: "16px 18px",
        flex: 1,
      }}
    >
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: TOKENS.inkSoft, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 26, fontWeight: 600, color: accent || TOKENS.ink }}>
          {value}
        </span>
      </div>
    </div>
  );
}

// Ecran affiche a la place du tableau de bord habituel tant qu'aucun
// etablissement n'a ete cree. Un tableau de bord vide (jauge a 0%, aucune
// donnee) ressemble a une erreur pour un nouveau client ; ce message guide
// explicitement les 3 premieres etapes a suivre.
function OnboardingWelcome({ setView, organizationName }) {
  const steps = [
    {
      icon: Building2,
      title: "Ajoutez votre premier établissement",
      description: "Chaque EHPAD ou site que vous gérez doit d'abord être créé dans Paramètres.",
      action: "Aller dans Paramètres",
      view: "settings",
    },
    {
      icon: Users,
      title: "Ajoutez vos salariés",
      description: "Une fois un établissement créé, ajoutez-y vos salariés un par un ou en important un fichier CSV.",
      action: "Aller dans Salariés",
      view: "staff",
    },
    {
      icon: CreditCard,
      title: "Choisissez votre abonnement",
      description: "Sélectionnez l'offre adaptée à votre organisation pour activer le suivi complet.",
      action: "Voir les offres",
      view: "abonnement",
    },
  ];

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid " + TOKENS.line,
        boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
        borderRadius: 8,
        padding: "32px 28px",
        maxWidth: 640,
        margin: "0 auto",
      }}
    >
      <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 20, fontWeight: 600, color: TOKENS.ink, margin: "0 0 6px" }}>
        Bienvenue sur Confia{organizationName ? ", " + organizationName : ""} !
      </h2>
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, color: TOKENS.inkSoft, margin: "0 0 26px", lineHeight: 1.6 }}>
        Votre compte est créé. Il ne reste que quelques étapes avant de pouvoir suivre la conformité
        vaccinale de vos équipes.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {steps.map((step, idx) => (
          <div
            key={step.view}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 16,
              padding: "16px 18px",
              background: TOKENS.paperDim,
              borderRadius: 8,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: TOKENS.brand,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Inter', sans-serif",
                fontSize: 14,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {idx + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <step.icon size={15} color={TOKENS.brand} />
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 14.5, fontWeight: 600, color: TOKENS.ink }}>
                  {step.title}
                </span>
              </div>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: TOKENS.inkSoft, margin: "0 0 10px", lineHeight: 1.55 }}>
                {step.description}
              </p>
              <button
                onClick={() => setView(step.view)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 12px",
                  borderRadius: 6,
                  border: "1px solid " + TOKENS.brand,
                  background: "#fff",
                  color: TOKENS.brand,
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {step.action} <ChevronRight size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Dashboard({ staff, establishments, setView, subscriptionStatus, organizationName, trialDaysLeft, bannerDismissed, onDismissBanner }) {
  const total = staff.length;
  const conforme = staff.filter((s) => s.status === "conforme").length;
  const aVenir = staff.filter((s) => s.status === "a_venir").length;
  const nonConforme = staff.filter((s) => s.status === "non_conforme").length;
  const percent = total ? Math.round((conforme / total) * 100) : 0;
  const isInTrial = subscriptionStatus !== "active" && trialDaysLeft !== null && trialDaysLeft !== undefined;
  const isTrialEndingSoon = isInTrial && trialDaysLeft <= 3;

  // Extrait en variable pour etre affiche aussi bien sur l'ecran de
  // bienvenue (aucun etablissement encore cree) que sur le tableau de bord
  // complet : un nouveau compte doit voir son compte a rebours des le
  // premier ecran, pas seulement une fois l'onboarding termine.
  const subscriptionBanner = subscriptionStatus !== "active" && !bannerDismissed && (
    <div
      style={{
        background: isTrialEndingSoon ? TOKENS.warnBg : TOKENS.okBg,
        border: "1px solid " + (isTrialEndingSoon ? TOKENS.warn : TOKENS.ok) + "44",
        borderRadius: 8,
        padding: "14px 18px",
        marginBottom: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, color: TOKENS.ink }}>
        {isInTrial ? (
          <>
            <strong>
              {trialDaysLeft === 0
                ? "Dernier jour d'essai gratuit."
                : trialDaysLeft === 1
                ? "Il vous reste 1 jour d'essai gratuit."
                : "Il vous reste " + trialDaysLeft + " jours d'essai gratuit."}
            </strong>{" "}
            Choisissez une offre pour continuer sans interruption à la fin de votre essai.
          </>
        ) : (
          <>
            <strong>Aucun abonnement actif.</strong> Choisissez une offre pour continuer à utiliser Confia sans
            interruption.
          </>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => setView("abonnement")}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "none",
            background: isTrialEndingSoon ? TOKENS.warn : TOKENS.ok,
            color: "#fff",
            fontFamily: "'Inter', sans-serif",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Voir les offres
        </button>
        <button
          onClick={onDismissBanner}
          title="Masquer pour cette session"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 26,
            height: 26,
            borderRadius: 5,
            border: "none",
            background: "transparent",
            color: TOKENS.inkSoft,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );

  if (establishments.length === 0) {
    return (
      <div>
        {subscriptionBanner}
        <OnboardingWelcome setView={setView} organizationName={organizationName} />
      </div>
    );
  }

  return (
    <div>
      {subscriptionBanner}
      <div
        style={{
          background: "#fff",
          border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
          borderRadius: 8,
          padding: "24px 28px",
          display: "flex",
          alignItems: "center",
          gap: 32,
          marginBottom: 20,
        }}
      >
        <BeamGauge percent={percent} />
        <div style={{ flex: 1 }}>
          <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 19, fontWeight: 600, color: TOKENS.ink, margin: 0 }}>
            Obligation vaccinale grippe — en vigueur depuis le 1er janvier 2026
          </h2>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, color: TOKENS.inkSoft, marginTop: 6, lineHeight: 1.55, maxWidth: 460 }}>
            {nonConforme} salarié{nonConforme > 1 ? "s" : ""} sur {total} n'a pas de justificatif à jour (grippe ou rougeole). L'article L.3111-4 du code de la santé publique s'applique déjà à votre personnel soignant.
          </p>
          <button
            onClick={() => setView("alerts")}
            style={{
              marginTop: 14,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: TOKENS.brand,
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "8px 14px",
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Voir les non-conformités <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 130px" }}><StatCard label="Salariés suivis" value={total} /></div>
        <div style={{ flex: "1 1 130px" }}><StatCard label="À jour" value={conforme} accent={TOKENS.ok} /></div>
        <div style={{ flex: "1 1 130px" }}><StatCard label="Échéance proche" value={aVenir} accent={TOKENS.warn} /></div>
        <div style={{ flex: "1 1 130px" }}><StatCard label="Non conformes" value={nonConforme} accent={TOKENS.danger} /></div>
      </div>

      <div style={{ background: "#fff", border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, fontWeight: 600, color: TOKENS.ink, margin: 0 }}>
            Détail par établissement
          </h3>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: TOKENS.inkSoft, fontStyle: "italic" }}>
            Faites glisser vers la gauche pour voir toutes les colonnes →
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
          <thead>
            <tr style={{ background: TOKENS.paperDim, borderTop: "1px solid " + TOKENS.line, borderBottom: "1px solid " + TOKENS.line }}>
              {["Établissement", "Salariés", "À jour", "Échéance proche", "Non conformes", "Conformité"].map((h, i) => (
                <th
                  key={h}
                  style={{
                    textAlign: i === 0 ? "left" : "center",
                    padding: "9px 16px",
                    fontSize: 11,
                    fontWeight: 600,
                    color: TOKENS.inkSoft,
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {establishments.map((e) => {
              const siteStaff = staff.filter((s) => s.site === e.id);
              const siteTotal = siteStaff.length;
              const ok = siteStaff.filter((s) => s.status === "conforme").length;
              const upcoming = siteStaff.filter((s) => s.status === "a_venir").length;
              const bad = siteStaff.filter((s) => s.status === "non_conforme").length;
              const pct = siteTotal ? Math.round((ok / siteTotal) * 100) : 0;
              return (
                <tr key={e.id} style={{ borderBottom: "1px solid " + TOKENS.line }}>
                  <td style={{ padding: "12px 16px", fontFamily: "'Inter', sans-serif", fontSize: 13.5, fontWeight: 500, color: TOKENS.ink }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Building2 size={14} color={TOKENS.inkSoft} style={{ flexShrink: 0 }} />
                      {e.name}
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: TOKENS.ink }}>
                    {siteTotal}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: TOKENS.ok, fontWeight: 600 }}>
                    {ok}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: upcoming > 0 ? TOKENS.warn : TOKENS.inkSoft, fontWeight: upcoming > 0 ? 600 : 400 }}>
                    {upcoming}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: bad > 0 ? TOKENS.danger : TOKENS.inkSoft, fontWeight: bad > 0 ? 600 : 400 }}>
                    {bad}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: TOKENS.paperDim, borderRadius: 3, overflow: "hidden", minWidth: 60 }}>
                        <div style={{ width: pct + "%", height: "100%", background: TOKENS.brand, borderRadius: 3 }} />
                      </div>
                      <span style={{ width: 36, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: TOKENS.inkSoft, textAlign: "right", flexShrink: 0 }}>
                        {pct}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {establishments.length > 1 && (
              <tr style={{ background: TOKENS.paperDim }}>
                <td style={{ padding: "12px 16px", fontFamily: "'Inter', sans-serif", fontSize: 13.5, fontWeight: 700, color: TOKENS.ink }}>
                  Total
                </td>
                <td style={{ padding: "12px 16px", textAlign: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 700, color: TOKENS.ink }}>
                  {total}
                </td>
                <td style={{ padding: "12px 16px", textAlign: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 700, color: TOKENS.ok }}>
                  {conforme}
                </td>
                <td style={{ padding: "12px 16px", textAlign: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 700, color: TOKENS.warn }}>
                  {aVenir}
                </td>
                <td style={{ padding: "12px 16px", textAlign: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 700, color: TOKENS.danger }}>
                  {nonConforme}
                </td>
                <td style={{ padding: "12px 16px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 700, color: TOKENS.ink }}>
                  {percent}%
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

// Duree de validite du vaccin grippe (en jours) avant qu'une nouvelle
// injection soit recommandee. Ajustable ici si la recommandation change.
const GRIPPE_VALIDITE_JOURS = 365;
// Valeur par défaut du nombre de jours avant l'echeance a partir duquel le
// statut passe en "Echeance proche". Chaque organisation peut desormais
// personnaliser ce seuil depuis Parametres ; cette constante ne sert que de
// valeur de repli si aucun reglage n'a encore ete enregistre.
const GRIPPE_ALERTE_JOURS_DEFAUT = 45;

function formatDateFr(date) {
  return date.toLocaleDateString("fr-FR");
}

// Calcule automatiquement le statut de conformite, la date de derniere mise
// a jour affichee et le libelle d'echeance, a partir de la date reelle de la
// derniere vaccination. Ce calcul est refait a chaque affichage : un salarie
// "a jour" aujourd'hui repassera automatiquement en "Echeance proche" puis
// "Non conforme" avec le temps, sans intervention manuelle.
function computeVaccineCompliance(vaccine, lastVaccinationDateStr, alertThresholdDays = GRIPPE_ALERTE_JOURS_DEFAUT) {
  if (!lastVaccinationDateStr) {
    return { status: "non_conforme", updatedLabel: "-", nextLabel: "Aucun justificatif" };
  }

  const lastDate = new Date(lastVaccinationDateStr + "T00:00:00");
  const updatedLabel = formatDateFr(lastDate);

  if (vaccine === "Rougeole") {
    // Immunite consideree comme durable : pas de rappel periodique attendu.
    return { status: "conforme", updatedLabel, nextLabel: "Aucune échéance (immunité durable)" };
  }

  // Grippe (et par defaut pour tout autre vaccin a rappel annuel)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryDate = new Date(lastDate);
  expiryDate.setDate(expiryDate.getDate() + GRIPPE_VALIDITE_JOURS);
  const joursRestants = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));

  if (joursRestants < 0) {
    return {
      status: "non_conforme",
      updatedLabel,
      nextLabel: "Echue le " + formatDateFr(expiryDate),
    };
  }
  if (joursRestants <= alertThresholdDays) {
    return { status: "a_venir", updatedLabel, nextLabel: formatDateFr(expiryDate) };
  }
  return { status: "conforme", updatedLabel, nextLabel: formatDateFr(expiryDate) };
}

const VACCINE_TYPES = [
  { key: "Grippe", label: "Grippe (obligatoire depuis 01/01/2026)" },
  { key: "Rougeole", label: "Rougeole (LFSS 2026, décret a venir)" },
];

function VaccineSection({ vaccineKey, label, date, onDateChange, file, onFileChange, existingDocumentUrl, alertThresholdDays }) {
  const inputStyle = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 6,
    border: "1px solid " + TOKENS.line,
    boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
    fontFamily: "'Inter', sans-serif",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
    marginBottom: 10,
  };
  const preview = computeVaccineCompliance(vaccineKey, date || null, alertThresholdDays);
  const meta = STATUS_META[preview.status];

  return (
    <div style={{ border: "1px solid " + TOKENS.line, borderRadius: 8, padding: "12px 14px", marginBottom: 14 }}>
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, fontWeight: 600, color: TOKENS.ink, marginBottom: 8 }}>
        {label}
      </div>
      <input
        type="date"
        style={inputStyle}
        value={date}
        onChange={(e) => onDateChange(e.target.value)}
        max={new Date().toISOString().slice(0, 10)}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 10px",
          borderRadius: 6,
          background: meta.bg,
          marginBottom: 10,
        }}
      >
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, color: meta.color, fontWeight: 600 }}>
          {meta.label}
        </span>
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: TOKENS.inkSoft }}>
          {preview.nextLabel}
        </span>
      </div>
      <label style={{ display: "block", fontFamily: "'Inter', sans-serif", fontSize: 11.5, color: TOKENS.inkSoft, marginBottom: 5 }}>
        Justificatif {existingDocumentUrl ? "(remplacer)" : "(optionnel)"}
      </label>
      <input
        type="file"
        accept="application/pdf,image/*"
        onChange={(e) => onFileChange(e.target.files?.[0] || null)}
        style={{ ...inputStyle, padding: "6px 8px", marginBottom: 0 }}
      />
    </div>
  );
}

function StaffModal({ onClose, onSave, establishments, token, editingStaff, alertThresholdDays }) {
  const isEditing = !!editingStaff;
  const [name, setName] = useState(editingStaff?.name || "");
  const [role, setRole] = useState(editingStaff?.role || "");
  const [site, setSite] = useState(editingStaff?.site || establishments[0]?.id || "");

  const findExisting = (vaccineKey) =>
    (editingStaff?.vaccinations || []).find((v) => v.vaccine === vaccineKey);

  const [dates, setDates] = useState(() =>
    Object.fromEntries(VACCINE_TYPES.map((v) => [v.key, findExisting(v.key)?.lastVaccinationDate || ""]))
  );
  const [files, setFiles] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const inputStyle = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 6,
    border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
    fontFamily: "'Inter', sans-serif",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
    marginBottom: 12,
  };
  const labelStyle = {
    display: "block",
    fontFamily: "'Inter', sans-serif",
    fontSize: 12,
    fontWeight: 500,
    color: TOKENS.inkSoft,
    marginBottom: 5,
  };

  const submit = async () => {
    if (!name.trim() || !role.trim()) return;
    setSaving(true);
    setUploadError(null);
    try {
      let personId = editingStaff?.id;
      const personPayload = { name: name.trim(), role: role.trim(), establishment_id: site };
      if (isEditing) {
        await updateStaffPerson(personId, personPayload, token);
      } else {
        const created = await insertStaffPerson(personPayload, token);
        personId = created.id;
        await insertHistoryEvent(
          { staff_id: personId, event_type: "creation", description: "Salarié ajoute a Confia." },
          token
        );
      }

      // Pour chaque vaccin renseigne avec une date, on cree ou met a jour son suivi.
      // Si le champ date est laisse vide, on ne touche pas a un suivi deja existant.
      for (const v of VACCINE_TYPES) {
        const date = dates[v.key];
        if (!date) continue;
        const existing = findExisting(v.key);
        // On ne journalise que si la date a reellement change, pour eviter de
        // creer une entree d'historique inutile a chaque simple reenregistrement.
        const dateChanged = !existing || existing.lastVaccinationDate !== date;
        let documentUrl = existing?.documentUrl || null;
        if (files[v.key]) {
          documentUrl = await uploadJustificatif(files[v.key], token);
        }
        const computed = computeVaccineCompliance(v.key, date, alertThresholdDays);
        await upsertVaccination(
          {
            staff_id: personId,
            vaccine: v.key,
            last_vaccination_date: date,
            document_url: documentUrl,
            status: computed.status,
            updated_label: computed.updatedLabel,
            next_label: computed.nextLabel,
          },
          existing?.id,
          token
        );
        if (dateChanged) {
          await insertHistoryEvent(
            {
              staff_id: personId,
              event_type: "vaccination",
              description: "Vaccin " + v.key + " : date de vaccination enregistree (" + computed.updatedLabel + ").",
            },
            token
          );
        }
      }

      await onSave();
      onClose();
    } catch (err) {
      console.error("Erreur:", err);
      setUploadError(err.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(22,35,31,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        overflowY: "auto",
        padding: "24px 0",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 10,
          padding: 24,
          width: 400,
          boxShadow: "0 12px 40px rgba(22,35,31,0.18)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 17, fontWeight: 600, color: TOKENS.ink, margin: 0 }}>
            {isEditing ? "Modifier le salarié" : "Ajouter un salarié"}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: TOKENS.inkSoft }}>
            <X size={18} />
          </button>
        </div>

        <label style={labelStyle}>Nom complet</label>
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Marie Dupont" />

        <label style={labelStyle}>Fonction</label>
        <input style={inputStyle} value={role} onChange={(e) => setRole(e.target.value)} placeholder="Ex. Auxiliaire de puericulture" />

        <label style={labelStyle}>Établissement</label>
        <select style={inputStyle} value={site} onChange={(e) => setSite(e.target.value)}>
          {establishments.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>

        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, fontWeight: 600, color: TOKENS.ink, margin: "4px 0 10px" }}>
          Suivi vaccinal (renseignez un ou plusieurs vaccins)
        </div>

        {VACCINE_TYPES.map((v) => (
          <VaccineSection
            key={v.key}
            vaccineKey={v.key}
            label={v.label}
            date={dates[v.key]}
            onDateChange={(val) => setDates((prev) => ({ ...prev, [v.key]: val }))}
            file={files[v.key]}
            onFileChange={(f) => setFiles((prev) => ({ ...prev, [v.key]: f }))}
            existingDocumentUrl={findExisting(v.key)?.documentUrl}
            alertThresholdDays={alertThresholdDays}
          />
        ))}

        {uploadError && (
          <div style={{ color: TOKENS.danger, fontSize: 12, marginBottom: 10 }}>{uploadError}</div>
        )}

        <button
          onClick={submit}
          disabled={saving}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: 6,
            border: "none",
            background: TOKENS.brand,
            color: "#fff",
            fontFamily: "'Inter', sans-serif",
            fontSize: 13.5,
            fontWeight: 500,
            cursor: saving ? "default" : "pointer",
            opacity: saving ? 0.7 : 1,
            marginTop: 4,
          }}
        >
          {saving ? "Enregistrement..." : isEditing ? "Enregistrer les modifications" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

// Modele de colonnes attendu pour le fichier d'import : chaque ligne est un
// salarie, avec ses deux dates de vaccin optionnelles. Garde ici pour
// n'avoir qu'un seul endroit a modifier si l'ordre des colonnes change un jour.
const IMPORT_CSV_HEADERS = [
  "Nom",
  "Fonction",
  "Établissement",
  "Date vaccination Grippe (AAAA-MM-JJ)",
  "Date vaccination Rougeole (AAAA-MM-JJ)",
];

function csvCellEscape(value) {
  const str = String(value ?? "");
  if (/[",;\n]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// Parseur CSV volontairement simple : detecte automatiquement le separateur
// (point-virgule ou virgule) a partir de l'en-tete, et gere les guillemets
// pour les valeurs contenant elles-memes le separateur.
function parseImportCSV(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const delimiter = firstLine.includes(";") ? ";" : ",";
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return lines.map((line) => {
    const cells = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        cells.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current);
    return cells.map((c) => c.trim());
  });
}

function ImportStaffModal({ onClose, onSave, establishments, token, alertThresholdDays }) {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);

  const downloadTemplate = () => {
    const example = [
      "Marie Dupont",
      "Aide-soignante",
      establishments[0]?.name || "Nom exact de l'établissement",
      "2025-10-01",
      "",
    ];
    const rows = [IMPORT_CSV_HEADERS, example];
    const csvContent = rows.map((row) => row.map(csvCellEscape).join(";")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "modele-import-salaries.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setResults(null);
    try {
      const text = await file.text();
      const rows = parseImportCSV(text);
      if (rows.length === 0) throw new Error("Le fichier est vide.");

      // La premiere ligne est consideree comme l'en-tete et n'est jamais importee.
      const dataRows = rows.slice(1);
      let successCount = 0;
      const errors = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const lineNumber = i + 2;
        const [name, role, estabName, grippeDate, rougeoleDate] = row;

        if (!name || !name.trim()) {
          errors.push({ line: lineNumber, reason: "Nom manquant, ligne ignoree." });
          continue;
        }
        const establishment = establishments.find(
          (e) => e.name.trim().toLowerCase() === (estabName || "").trim().toLowerCase()
        );
        if (!establishment) {
          errors.push({
            line: lineNumber,
            reason: "Établissement \"" + (estabName || "-") + "\" introuvable (vérifiez l'orthographe exacte).",
          });
          continue;
        }

        try {
          const created = await insertStaffPerson(
            { name: name.trim(), role: (role || "").trim() || "-", establishment_id: establishment.id },
            token
          );
          await insertHistoryEvent(
            { staff_id: created.id, event_type: "creation", description: "Salarié importe via un fichier CSV." },
            token
          );
          for (const [vaccine, dateValue] of [
            ["Grippe", grippeDate],
            ["Rougeole", rougeoleDate],
          ]) {
            if (!dateValue || !dateValue.trim()) continue;
            const computed = computeVaccineCompliance(vaccine, dateValue.trim(), alertThresholdDays);
            await upsertVaccination(
              {
                staff_id: created.id,
                vaccine,
                last_vaccination_date: dateValue.trim(),
                document_url: null,
                status: computed.status,
                updated_label: computed.updatedLabel,
                next_label: computed.nextLabel,
              },
              null,
              token
            );
            await insertHistoryEvent(
              {
                staff_id: created.id,
                event_type: "vaccination",
                description: "Vaccin " + vaccine + " : date de vaccination enregistree (" + computed.updatedLabel + ") via import CSV.",
              },
              token
            );
          }
          successCount++;
        } catch (err) {
          errors.push({ line: lineNumber, reason: err.message || "Erreur d'enregistrement." });
        }
      }

      setResults({ success: successCount, errors });
      if (successCount > 0) await onSave();
    } catch (err) {
      console.error("Erreur d'import CSV:", err);
      setResults({ success: 0, errors: [{ line: "-", reason: err.message || "Erreur lors de la lecture du fichier." }] });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(22,35,31,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        overflowY: "auto",
        padding: "24px 0",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 10,
          padding: 24,
          width: 440,
          maxWidth: "92vw",
          boxShadow: "0 12px 40px rgba(22,35,31,0.18)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 17, fontWeight: 600, color: TOKENS.ink, margin: 0 }}>
            Importer des salariés
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: TOKENS.inkSoft }}>
            <X size={18} />
          </button>
        </div>

        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: TOKENS.inkSoft, lineHeight: 1.6, margin: "0 0 14px" }}>
          Importez plusieurs salariés d'un coup depuis un fichier CSV. Le nom de l'établissement dans le fichier
          doit correspondre exactement à celui déjà créé dans Confia.
        </p>

        <button
          type="button"
          onClick={downloadTemplate}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "1px solid " + TOKENS.line,
            borderRadius: 6,
            padding: "7px 12px",
            fontFamily: "'Inter', sans-serif",
            fontSize: 12,
            color: TOKENS.brand,
            cursor: "pointer",
            marginBottom: 16,
          }}
        >
          <FileDown size={13} /> Télécharger le modèle CSV
        </button>

        <label
          style={{
            display: "block",
            fontFamily: "'Inter', sans-serif",
            fontSize: 12,
            fontWeight: 500,
            color: TOKENS.inkSoft,
            marginBottom: 6,
          }}
        >
          Fichier CSV rempli
        </label>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            setResults(null);
          }}
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid " + TOKENS.line,
            fontFamily: "'Inter', sans-serif",
            fontSize: 13,
            boxSizing: "border-box",
            marginBottom: 16,
          }}
        />

        {results && (
          <div
            style={{
              background: results.errors.length > 0 ? TOKENS.warnBg : TOKENS.okBg,
              borderRadius: 6,
              padding: "10px 12px",
              marginBottom: 16,
              fontFamily: "'Inter', sans-serif",
              fontSize: 12,
              maxHeight: 160,
              overflowY: "auto",
            }}
          >
            <div style={{ fontWeight: 600, color: TOKENS.ink, marginBottom: results.errors.length > 0 ? 6 : 0 }}>
              {results.success} salarié{results.success > 1 ? "s" : ""} importé{results.success > 1 ? "s" : ""} avec succès.
            </div>
            {results.errors.length > 0 && (
              <div>
                <div style={{ fontWeight: 600, color: TOKENS.warn, marginBottom: 4 }}>
                  {results.errors.length} ligne{results.errors.length > 1 ? "s" : ""} en erreur :
                </div>
                <ul style={{ margin: 0, paddingLeft: 16, color: TOKENS.inkSoft }}>
                  {results.errors.map((e, idx) => (
                    <li key={idx}>Ligne {e.line} : {e.reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleImport}
            disabled={!file || importing}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: 6,
              border: "none",
              background: TOKENS.brand,
              color: "#fff",
              fontFamily: "'Inter', sans-serif",
              fontSize: 13.5,
              fontWeight: 500,
              cursor: !file || importing ? "default" : "pointer",
              opacity: !file || importing ? 0.6 : 1,
            }}
          >
            {importing ? "Import en cours..." : "Importer"}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: "10px 16px",
              borderRadius: 6,
              border: "1px solid " + TOKENS.line,
              background: "#fff",
              color: TOKENS.inkSoft,
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// Affiche le journal chronologique des evenements d'un salarie (creation,
// dates de vaccination enregistrees...). Lecture seule : ces entrees ne sont
// jamais modifiees, elles servent de preuve du suivi dans le temps.
function HistoryModal({ person, onClose }) {
  const formatEventDate = (isoString) => {
    try {
      return new Date(isoString).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return isoString;
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(22,35,31,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        overflowY: "auto",
        padding: "24px 0",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 10,
          padding: 24,
          width: 420,
          maxWidth: "92vw",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 12px 40px rgba(22,35,31,0.18)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 17, fontWeight: 600, color: TOKENS.ink, margin: 0 }}>
            Historique
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: TOKENS.inkSoft }}>
            <X size={18} />
          </button>
        </div>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: TOKENS.inkSoft, margin: "0 0 16px" }}>
          {person.name}
        </p>

        <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
          {(person.history || []).length === 0 ? (
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: TOKENS.inkSoft }}>
              Aucun événement enregistré pour ce salarié.
            </p>
          ) : (
            person.history.map((h) => (
              <div
                key={h.id}
                style={{
                  borderLeft: "2px solid " + TOKENS.brand,
                  paddingLeft: 12,
                  paddingBottom: 2,
                }}
              >
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: TOKENS.inkSoft }}>
                  {formatEventDate(h.createdAt)}
                </div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: TOKENS.ink, marginTop: 2 }}>
                  {h.description}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StaffView({ staff, onReload, onDeletePerson, establishments, token, alertThresholdDays, setView }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [siteFilter, setSiteFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [historyStaff, setHistoryStaff] = useState(null);

  const filtered = useMemo(() => {
    return staff.filter((s) => {
      const matchQuery = s.name.toLowerCase().includes(query.toLowerCase());
      const matchFilter = filter === "all" || s.status === filter;
      const matchSite = siteFilter === "all" || s.site === siteFilter;
      return matchQuery && matchFilter && matchSite;
    });
  }, [staff, query, filter, siteFilter]);

  const handleDelete = async (s) => {
    if (!window.confirm("Supprimer " + s.name + " ? Cette action est irréversible et supprimera tous ses suivis vaccinaux.")) return;
    setDeletingId(s.id);
    try {
      await onDeletePerson(s.id);
    } finally {
      setDeletingId(null);
    }
  };

  // Un salarie doit obligatoirement etre rattache a un etablissement : sans
  // cela, impossible d'ajouter ou d'importer qui que ce soit. On bloque
  // clairement les deux actions plutot que de laisser un formulaire avec un
  // menu deroulant vide, qui pourrait creer un salarie orphelin.
  if (establishments.length === 0) {
    return (
      <div
        style={{
          background: "#fff",
          border: "1px solid " + TOKENS.line,
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
          borderRadius: 8,
          padding: "32px",
          textAlign: "center",
          maxWidth: 480,
          margin: "40px auto",
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 8,
            background: TOKENS.paperDim,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 14px",
          }}
        >
          <Building2 size={20} color={TOKENS.brand} />
        </div>
        <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 17, fontWeight: 600, color: TOKENS.ink, margin: "0 0 8px" }}>
          Créez d'abord un établissement
        </h3>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: TOKENS.inkSoft, lineHeight: 1.6, margin: "0 0 18px" }}>
          Chaque salarié doit être rattaché à un établissement. Ajoutez votre premier établissement dans
          Paramètres avant de pouvoir ajouter ou importer des salariés.
        </p>
        <button
          onClick={() => setView && setView("settings")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "9px 18px",
            borderRadius: 6,
            border: "none",
            background: TOKENS.brand,
            color: "#fff",
            fontFamily: "'Inter', sans-serif",
            fontSize: 13.5,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Aller dans Paramètres <ChevronRight size={14} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 320, minWidth: 180 }}>
          <Search size={14} color={TOKENS.inkSoft} style={{ position: "absolute", left: 10, top: 10 }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un salarié..."
            style={{
              width: "100%",
              padding: "8px 10px 8px 30px",
              borderRadius: 6,
              border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
        {["all", "conforme", "a_venir", "non_conforme"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "7px 12px",
              borderRadius: 6,
              border: "1px solid " + (filter === f ? TOKENS.brand : TOKENS.line),
              background: filter === f ? TOKENS.brand : "#fff",
              color: filter === f ? "#fff" : TOKENS.inkSoft,
              fontFamily: "'Inter', sans-serif",
              fontSize: 12.5,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {f === "all" ? "Tous" : STATUS_META[f].label}
          </button>
        ))}
        {establishments.length > 1 && (
          <select
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value)}
            style={{
              padding: "7px 10px",
              borderRadius: 6,
              border: "1px solid " + TOKENS.line,
              background: "#fff",
              color: siteFilter === "all" ? TOKENS.inkSoft : TOKENS.ink,
              fontFamily: "'Inter', sans-serif",
              fontSize: 12.5,
              cursor: "pointer",
              outline: "none",
            }}
          >
            <option value="all">Tous les établissements</option>
            {establishments.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={() => setShowImportModal(true)}
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            borderRadius: 6,
            border: "1px solid " + TOKENS.line,
            background: "#fff",
            color: TOKENS.ink,
            fontFamily: "'Inter', sans-serif",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <Upload size={14} /> Importer
        </button>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            borderRadius: 6,
            border: "none",
            background: TOKENS.brand,
            color: "#fff",
            fontFamily: "'Inter', sans-serif",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          <Plus size={14} /> Ajouter
        </button>
      </div>

      {showModal && (
        <StaffModal
          onClose={() => {
            setShowModal(false);
            setEditingStaff(null);
          }}
          onSave={onReload}
          establishments={establishments}
          token={token}
          editingStaff={editingStaff}
          alertThresholdDays={alertThresholdDays}
        />
      )}

      {showImportModal && (
        <ImportStaffModal
          onClose={() => setShowImportModal(false)}
          onSave={onReload}
          establishments={establishments}
          token={token}
          alertThresholdDays={alertThresholdDays}
        />
      )}

      {historyStaff && (
        <HistoryModal person={historyStaff} onClose={() => setHistoryStaff(null)} />
      )}

      <div style={{ background: "#fff", border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)", borderRadius: 8, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'Inter', sans-serif" }}>
          <thead>
            <tr style={{ background: TOKENS.paperDim, borderBottom: "1px solid " + TOKENS.line }}>
              {["Nom", "Fonction", "Établissement", "Statut global", "Grippe", "Rougeole", "Actions"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "10px 16px",
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: TOKENS.inkSoft,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    whiteSpace: "nowrap",
                    position: h === "Nom" ? "sticky" : undefined,
                    left: h === "Nom" ? 0 : undefined,
                    background: h === "Nom" ? TOKENS.paperDim : undefined,
                    zIndex: h === "Nom" ? 1 : undefined,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const grippe = s.vaccinations.find((v) => v.vaccine === "Grippe");
              const rougeole = s.vaccinations.find((v) => v.vaccine === "Rougeole");
              return (
                <tr key={s.id} style={{ borderBottom: "1px solid " + TOKENS.line }}>
                  <td style={{ padding: "11px 16px", fontSize: 13.5, color: TOKENS.ink, fontWeight: 500, whiteSpace: "nowrap", position: "sticky", left: 0, background: "#fff", zIndex: 1 }}>{s.name}</td>
                  <td style={{ padding: "11px 16px", fontSize: 13, color: TOKENS.inkSoft, whiteSpace: "nowrap" }}>{s.role}</td>
                  <td style={{ padding: "11px 16px", fontSize: 13, color: TOKENS.inkSoft, whiteSpace: "nowrap" }}>
                    {establishments.find((e) => e.id === s.site)?.name}
                  </td>
                  <td style={{ padding: "11px 16px" }}>
                    <Seal status={s.status} />
                  </td>
                  <td style={{ padding: "11px 16px" }}>
                    <VaccineCell vaccination={grippe} />
                  </td>
                  <td style={{ padding: "11px 16px" }}>
                    <VaccineCell vaccination={rougeole} />
                  </td>
                  <td style={{ padding: "11px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => setHistoryStaff(s)}
                        title="Voir l'historique"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 26,
                          height: 26,
                          borderRadius: 5,
                          border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
                          background: "#fff",
                          color: TOKENS.inkSoft,
                          cursor: "pointer",
                        }}
                      >
                        <History size={13} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingStaff(s);
                          setShowModal(true);
                        }}
                        title="Modifier"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 26,
                          height: 26,
                          borderRadius: 5,
                          border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
                          background: "#fff",
                          color: TOKENS.inkSoft,
                          cursor: "pointer",
                        }}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(s)}
                        disabled={deletingId === s.id}
                        title="Supprimer"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 26,
                          height: 26,
                          borderRadius: 5,
                          border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
                          background: "#fff",
                          color: TOKENS.danger,
                          cursor: deletingId === s.id ? "default" : "pointer",
                          opacity: deletingId === s.id ? 0.5 : 1,
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AlertsView({ staff, establishments, userEmail }) {
  // Aplati chaque personne en une entree par vaccin non conforme, puisqu'une
  // meme personne peut avoir une alerte grippe ET une alerte rougeole distinctes.
  const alerts = useMemo(() => {
    const rows = [];
    staff.forEach((s) => {
      s.vaccinations.forEach((v) => {
        if (v.status !== "conforme") {
          rows.push({
            alertId: s.id + "-" + v.id,
            staffId: s.id,
            name: s.name,
            site: s.site,
            vaccine: v.vaccine,
            status: v.status,
            next: v.next,
          });
        }
      });
      if (s.vaccinations.length === 0) {
        rows.push({
          alertId: s.id + "-aucun-suivi",
          staffId: s.id,
          name: s.name,
          site: s.site,
          vaccine: null,
          status: "non_conforme",
          next: "-",
        });
      }
    });
    return rows;
  }, [staff]);
  const [sendState, setSendState] = useState({});

  const sendAlert = async (a) => {
    setSendState((prev) => ({ ...prev, [a.alertId]: "sending" }));
    try {
      const res = await fetch("/api/send-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toEmail: userEmail,
          staffName: a.name,
          establishmentName: establishments.find((e) => e.id === a.site)?.name || "-",
          vaccine: a.vaccine,
          reason: a.status === "non_conforme" ? "Aucun justificatif enregistre" : "Échéance proche (" + a.next + ")",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Echec de l'envoi");
      setSendState((prev) => ({ ...prev, [a.alertId]: "sent" }));
    } catch (err) {
      console.error("Erreur d'envoi:", err);
      setSendState((prev) => ({ ...prev, [a.alertId]: "error" }));
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {alerts.map((a) => {
        const isOverdue = a.status === "non_conforme";
        const state = sendState[a.alertId];
        return (
          <div
            key={a.alertId}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              background: "#fff",
              border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
              borderLeft: "3px solid " + (isOverdue ? TOKENS.danger : TOKENS.warn),
              borderRadius: 6,
              padding: "14px 18px",
            }}
          >
            <BellRing size={16} color={isOverdue ? TOKENS.danger : TOKENS.warn} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, fontWeight: 500, color: TOKENS.ink }}>
                {a.name} - {establishments.find((e) => e.id === a.site)?.name}
              </div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: TOKENS.inkSoft, marginTop: 2 }}>
                {!a.vaccine
                  ? "Aucun suivi vaccinal enregistre pour cette personne."
                  : a.status === "non_renseigne"
                  ? `Date de vaccination ${a.vaccine.toLowerCase()} non renseignee : impossible de vérifier la conformité.`
                  : isOverdue
                  ? `Aucun justificatif d'immunisation ${a.vaccine.toLowerCase()} valide enregistre.`
                  : `Échéance de contrôle (${a.vaccine}) : ${a.next}.`}
              </div>
              {state === "sent" && (
                <div style={{ fontSize: 11.5, color: TOKENS.ok, marginTop: 4 }}>Email envoye</div>
              )}
              {state === "error" && (
                <div style={{ fontSize: 11.5, color: TOKENS.danger, marginTop: 4 }}>Echec de l'envoi, reessayez</div>
              )}
            </div>
            <button
              onClick={() => sendAlert(a)}
              disabled={state === "sending" || !a.vaccine}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
                background: TOKENS.paperDim,
                color: TOKENS.ink,
                fontFamily: "'Inter', sans-serif",
                fontSize: 12.5,
                cursor: state === "sending" ? "default" : "pointer",
                whiteSpace: "nowrap",
                opacity: state === "sending" || !a.vaccine ? 0.6 : 1,
              }}
            >
              {state === "sending" ? "Envoi..." : "Relancer par email"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function AbonnementView({ token, organizationId, establishments, staffCount, currentUserEmail, subscriptionStatus, subscriptionPlan, subscriptionPeriod, currentPeriodEnd, stripeCustomerId }) {
  const [billingPeriod, setBillingPeriod] = useState("monthly");
  const [checkoutLoadingKey, setCheckoutLoadingKey] = useState(null);
  const [checkoutError, setCheckoutError] = useState(null);
  const [membersCount, setMembersCount] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState(null);

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const url = await createPortalSession(stripeCustomerId);
      window.location.href = url;
    } catch (err) {
      console.error("Erreur d'ouverture du portail:", err);
      setPortalError(err.message || "Erreur lors de l'ouverture du portail d'abonnement");
      setPortalLoading(false);
    }
  };

  useEffect(() => {
    if (!organizationId) return;
    fetchOrganizationMembers(organizationId, token)
      .then((m) => setMembersCount(m.length))
      .catch((err) => console.error("Erreur de chargement des membres:", err));
  }, [organizationId, token]);

  const plans = PLANS;

  const handleSubscribe = async (planKey, period) => {
    setCheckoutLoadingKey(planKey + period);
    setCheckoutError(null);
    try {
      const url = await createCheckoutSession(planKey, period, organizationId, currentUserEmail);
      window.location.href = url;
    } catch (err) {
      console.error("Erreur de paiement:", err);
      setCheckoutError(err.message || "Erreur lors de la création du paiement");
      setCheckoutLoadingKey(null);
    }
  };

  const periodLabelFr = subscriptionPeriod === "annual" ? "annuel" : subscriptionPeriod === "monthly" ? "mensuel" : null;
  const planLabelFr = plans.find((p) => p.key === subscriptionPlan)?.name || subscriptionPlan;
  const isActiveSubscription = subscriptionStatus === "active";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 640 }}>
      <div style={{ background: "#fff", border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)", borderRadius: 8, padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, fontWeight: 600, color: TOKENS.ink, margin: 0 }}>
            Abonnement
          </h3>
          <span
            style={{
              padding: "3px 10px",
              borderRadius: 4,
              fontSize: 11.5,
              fontWeight: 500,
              color: isActiveSubscription ? TOKENS.ok : TOKENS.danger,
              background: isActiveSubscription ? TOKENS.okBg : TOKENS.dangerBg,
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {isActiveSubscription ? "Actif" : "Aucun abonnement"}
          </span>
        </div>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: TOKENS.inkSoft, margin: "0 0 16px" }}>
          {isActiveSubscription
            ? "Plan " + (planLabelFr || "-") + (periodLabelFr ? " (" + periodLabelFr + ")" : "") +
              (currentPeriodEnd ? " — renouvellement le " + new Date(currentPeriodEnd).toLocaleDateString("fr-FR") : "") + "."
            : "Choisissez une offre ci-dessous pour activer votre abonnement."}
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1, padding: "12px 14px", background: TOKENS.paperDim, borderRadius: 6, textAlign: "center" }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 22, fontWeight: 600, color: TOKENS.ink }}>
              {establishments.length}
            </div>
            <div style={{ fontSize: 11.5, color: TOKENS.inkSoft, marginTop: 2 }}>Établissements</div>
          </div>
          <div style={{ flex: 1, padding: "12px 14px", background: TOKENS.paperDim, borderRadius: 6, textAlign: "center" }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 22, fontWeight: 600, color: TOKENS.ink }}>
              {staffCount}
            </div>
            <div style={{ fontSize: 11.5, color: TOKENS.inkSoft, marginTop: 2 }}>Salariés suivis</div>
          </div>
          <div style={{ flex: 1, padding: "12px 14px", background: TOKENS.paperDim, borderRadius: 6, textAlign: "center" }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 22, fontWeight: 600, color: TOKENS.ink }}>
              {membersCount ?? "-"}
            </div>
            <div style={{ fontSize: 11.5, color: TOKENS.inkSoft, marginTop: 2 }}>Membres d'équipe</div>
          </div>
        </div>
        {stripeCustomerId && (
          <div style={{ marginTop: 16 }}>
            <button
              onClick={handleManageSubscription}
              disabled={portalLoading}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 18px",
                borderRadius: 7,
                border: "none",
                background: TOKENS.brand,
                color: "#fff",
                fontFamily: "'Inter', sans-serif",
                cursor: portalLoading ? "default" : "pointer",
                opacity: portalLoading ? 0.7 : 1,
                boxShadow: "0 1px 3px rgba(15, 23, 42, 0.12)",
              }}
            >
              <CreditCard size={17} style={{ flexShrink: 0 }} />
              <span style={{ textAlign: "left" }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, lineHeight: 1.3 }}>
                  {portalLoading ? "Ouverture..." : "Gérer mon abonnement"}
                </span>
                {!portalLoading && (
                  <span style={{ display: "block", fontSize: 11, fontWeight: 400, opacity: 0.85, marginTop: 1, lineHeight: 1.3 }}>
                    Résiliation, facture, moyen de paiement
                  </span>
                )}
              </span>
            </button>
            {portalError && (
              <div style={{ fontSize: 11.5, color: TOKENS.danger, marginTop: 8 }}>{portalError}</div>
            )}
          </div>
        )}
      </div>

      <div style={{ background: "#fff", border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)", borderRadius: 8, padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 10 }}>
          <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, fontWeight: 600, color: TOKENS.ink, margin: 0 }}>
            Nos offres
          </h3>
          <div style={{ display: "flex", background: TOKENS.paperDim, borderRadius: 6, padding: 3 }}>
            {["monthly", "annual"].map((period) => (
              <button
                key={period}
                onClick={() => setBillingPeriod(period)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 5,
                  border: "none",
                  background: billingPeriod === period ? TOKENS.brand : "transparent",
                  color: billingPeriod === period ? "#fff" : TOKENS.inkSoft,
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {period === "monthly" ? "Mensuel" : "Annuel (2 mois offerts)"}
              </button>
            ))}
          </div>
        </div>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: TOKENS.inkSoft, margin: "0 0 18px" }}>
          Choisissez l'offre adaptée à votre organisation. Paiement sécurisé par carte bancaire, sans engagement.
        </p>
        {checkoutError && (
          <div style={{ fontSize: 12, color: TOKENS.danger, marginBottom: 14 }}>{checkoutError}</div>
        )}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {plans.map((plan) => {
            const isCurrentPlan =
              isActiveSubscription && subscriptionPlan === plan.key && subscriptionPeriod === billingPeriod;
            const loadingThisButton = checkoutLoadingKey === plan.key + billingPeriod;
            return (
              <div
                key={plan.key}
                style={{
                  flex: "1 1 200px",
                  border: "1px solid " + (plan.highlighted ? TOKENS.brand : TOKENS.line),
                  borderRadius: 8,
                  padding: "16px 16px",
                  position: "relative",
                  background: plan.highlighted ? TOKENS.okBg : "#fff",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {plan.highlighted && (
                  <span
                    style={{
                      position: "absolute",
                      top: -9,
                      left: 14,
                      background: TOKENS.brand,
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 500,
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    Populaire
                  </span>
                )}
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 600, color: TOKENS.ink, marginTop: 4 }}>
                  {plan.name}
                </div>
                <div style={{ fontSize: 11.5, color: TOKENS.inkSoft, marginBottom: 10 }}>{plan.tagline}</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 22, fontWeight: 600, color: TOKENS.ink }}>
                  {billingPeriod === "monthly" ? plan.monthly : plan.annual}
                  <span style={{ fontSize: 12, fontWeight: 400, color: TOKENS.inkSoft }}>
                    {billingPeriod === "monthly" ? "/mois" : "/an"}
                  </span>
                </div>
                <ul style={{ margin: "12px 0 16px", padding: "0 0 0 16px", fontSize: 12, color: TOKENS.inkSoft, lineHeight: 1.8, flex: 1 }}>
                  {plan.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSubscribe(plan.key, billingPeriod)}
                  disabled={isCurrentPlan || loadingThisButton}
                  style={{
                    width: "100%",
                    padding: "9px",
                    borderRadius: 6,
                    border: "none",
                    background: isCurrentPlan ? TOKENS.paperDim : TOKENS.brand,
                    color: isCurrentPlan ? TOKENS.inkSoft : "#fff",
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: isCurrentPlan || loadingThisButton ? "default" : "pointer",
                    opacity: loadingThisButton ? 0.7 : 1,
                  }}
                >
                  {isCurrentPlan ? "Abonnement actif" : loadingThisButton ? "Redirection..." : "S'abonner"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SettingsView({ establishments, token, onUpdate, organizationId, onAddEstablishment, onDeleteEstablishment, organizationName, onRenameOrganization, currentUserEmail, currentUserId, avatarUrl, onUpdateProfile, onDeleteAccount, staffCount, subscriptionStatus, subscriptionPlan, subscriptionPeriod, currentPeriodEnd, alertThresholdDays, onUpdateAlertThreshold }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState(null);

  const handleChangePassword = async () => {
    setPasswordChanged(false);
    setPasswordChangeError(null);
    if (newPassword.length < 6) {
      setPasswordChangeError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordChangeError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setChangingPassword(true);
    try {
      // Le meme endpoint Supabase que celui utilise apres un clic sur le lien
      // "mot de passe oublie" fonctionne aussi avec le token de la session en
      // cours : pas besoin de repasser par un email pour changer son mot de
      // passe quand on est deja connecte.
      await updatePasswordWithToken(token, newPassword);
      setPasswordChanged(true);
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err) {
      console.error("Erreur de changement de mot de passe:", err);
      setPasswordChangeError(err.message || "Erreur lors du changement de mot de passe");
    } finally {
      setChangingPassword(false);
    }
  };

  const [newEmail, setNewEmail] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);
  const [emailChangeRequested, setEmailChangeRequested] = useState(false);
  const [emailChangeError, setEmailChangeError] = useState(null);

  const handleChangeEmail = async () => {
    setEmailChangeRequested(false);
    setEmailChangeError(null);
    const trimmed = newEmail.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setEmailChangeError("Merci de saisir une adresse email valide.");
      return;
    }
    if (trimmed.toLowerCase() === (currentUserEmail || "").toLowerCase()) {
      setEmailChangeError("C'est déjà votre adresse email actuelle.");
      return;
    }
    setChangingEmail(true);
    try {
      await updateEmailWithToken(token, trimmed);
      setEmailChangeRequested(true);
      setNewEmail("");
    } catch (err) {
      console.error("Erreur de changement d'email:", err);
      setEmailChangeError(err.message || "Erreur lors du changement d'email");
    } finally {
      setChangingEmail(false);
    }
  };

  const [orgNameDraft, setOrgNameDraft] = useState(organizationName || "");
  const [renamingOrg, setRenamingOrg] = useState(false);
  const [orgRenamed, setOrgRenamed] = useState(false);
  const [orgRenameError, setOrgRenameError] = useState(null);

  const [alertThresholdDraft, setAlertThresholdDraft] = useState(alertThresholdDays ?? 45);
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [thresholdSaved, setThresholdSaved] = useState(false);
  const [thresholdError, setThresholdError] = useState(null);

  useEffect(() => {
    setAlertThresholdDraft(alertThresholdDays ?? 45);
  }, [alertThresholdDays]);

  const saveAlertThreshold = async () => {
    const days = parseInt(alertThresholdDraft, 10);
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      setThresholdError("Merci de saisir un nombre de jours entre 1 et 365.");
      return;
    }
    setSavingThreshold(true);
    setThresholdSaved(false);
    setThresholdError(null);
    try {
      await updateAlertThreshold(organizationId, days, token);
      await onUpdateAlertThreshold(days);
      setThresholdSaved(true);
    } catch (err) {
      console.error("Erreur de mise à jour du seuil:", err);
      setThresholdError(err.message || "Erreur lors de l'enregistrement");
    } finally {
      setSavingThreshold(false);
    }
  };

  const [members, setMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteResultMessage, setInviteResultMessage] = useState(null);
  const [removingMemberId, setRemovingMemberId] = useState(null);
  const [resendingInviteId, setResendingInviteId] = useState(null);
  const [resendResult, setResendResult] = useState({});
  const [removeMemberError, setRemoveMemberError] = useState(null);

  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [displayNameSaved, setDisplayNameSaved] = useState(false);
  const [displayNameError, setDisplayNameError] = useState(null);

  useEffect(() => {
    if (organizationName) setOrgNameDraft(organizationName);
  }, [organizationName]);

  useEffect(() => {
    if (!organizationId) return;
    Promise.all([fetchOrganizationMembers(organizationId, token), fetchInvitations(organizationId, token)])
      .then(([m, i]) => {
        setMembers(m);
        setPendingInvites(i);
        const ownRow = m.find((row) => row.email === currentUserEmail);
        setDisplayNameDraft(ownRow?.display_name || "");
      })
      .catch((err) => console.error("Erreur de chargement équipe:", err));
  }, [organizationId, token]);

  const saveDisplayName = async () => {
    setSavingDisplayName(true);
    setDisplayNameSaved(false);
    setDisplayNameError(null);
    try {
      const trimmed = displayNameDraft.trim() || null;
      await updateMemberDisplayName(organizationId, currentUserId, trimmed, token);
      setMembers((prev) =>
        prev.map((m) => (m.email === currentUserEmail ? { ...m, display_name: trimmed } : m))
      );
      if (onUpdateProfile) onUpdateProfile({ displayName: trimmed });
      setDisplayNameSaved(true);
    } catch (err) {
      console.error("Erreur de mise à jour du nom affiché:", err);
      setDisplayNameError(err.message || "Erreur lors de l'enregistrement");
    } finally {
      setSavingDisplayName(false);
    }
  };

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState(null);

  const handleAvatarUpload = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarError("Merci de choisir un fichier image (JPG, PNG...).");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setAvatarError("L'image doit faire moins de 3 Mo.");
      return;
    }
    setUploadingAvatar(true);
    setAvatarError(null);
    try {
      const url = await uploadAvatarImage(file, currentUserId, token);
      await updateMemberAvatarUrl(organizationId, currentUserId, url, token);
      setMembers((prev) =>
        prev.map((m) => (m.email === currentUserEmail ? { ...m, avatar_url: url } : m))
      );
      if (onUpdateProfile) onUpdateProfile({ avatarUrl: url });
    } catch (err) {
      console.error("Erreur d'upload de la photo de profil:", err);
      setAvatarError(err.message || "Erreur lors de l'envoi de la photo");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const currentUserRole = members.find((m) => m.email === currentUserEmail)?.role;
  const isOwner = currentUserRole === "owner";

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError(null);
    setInviteSent(false);
    setInviteResultMessage(null);
    try {
      const email = inviteEmail.trim();

      // Etape 1 : verifie si un compte existe deja avec cet email.
      // Si oui, la personne est ajoutee directement (pas d'invitation fantome).
      const check = await checkAndInvite(email, organizationId);

      if (check.status === "already_member") {
        setInviteError(check.message);
        return;
      }

      if (check.status === "added_existing") {
        const refreshedMembers = await fetchOrganizationMembers(organizationId, token);
        setMembers(refreshedMembers);
        setInviteResultMessage(check.message);
        setInviteSent(true);
        setInviteEmail("");
        return;
      }

      // Etape 2 : aucun compte existant, on envoie une invitation classique par email
      const invitation = await createInvitation(email, organizationId, token);
      if (!invitation) throw new Error("Aucune donnée retournee");
      setPendingInvites((prev) => [...prev, invitation]);
      await fetch("/api/send-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toEmail: email,
          organizationName,
          inviterEmail: currentUserEmail,
        }),
      });
      setInviteResultMessage("Invitation envoyee par email.");
      setInviteSent(true);
      setInviteEmail("");
    } catch (err) {
      console.error("Erreur d'invitation:", err);
      setInviteError(err.message || "Erreur lors de l'invitation");
    } finally {
      setInviting(false);
    }
  };

  const cancelInvite = async (id) => {
    try {
      await deleteInvitation(id, token);
      setPendingInvites((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.error("Erreur d'annulation:", err);
    }
  };

  const resendInvite = async (inv) => {
    setResendingInviteId(inv.id);
    setResendResult((prev) => ({ ...prev, [inv.id]: null }));
    try {
      const res = await fetch("/api/send-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toEmail: inv.email,
          organizationName,
          inviterEmail: currentUserEmail,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Echec de l'envoi");
      }
      setResendResult((prev) => ({ ...prev, [inv.id]: "sent" }));
      // Le message de confirmation s'efface tout seul apres quelques secondes,
      // pour ne pas rester colle en permanence a cote du bouton "Renvoyer".
      setTimeout(() => {
        setResendResult((prev) => ({ ...prev, [inv.id]: null }));
      }, 2500);
    } catch (err) {
      console.error("Erreur de renvoi d'invitation:", err);
      setResendResult((prev) => ({ ...prev, [inv.id]: "error" }));
    } finally {
      setResendingInviteId(null);
    }
  };

  const handleRemoveMember = async (member) => {
    const confirmed = window.confirm(
      "Retirer " + member.email + " de l'organisation ? Cette personne perdra immédiatement l'accès a toutes les données."
    );
    if (!confirmed) return;
    setRemovingMemberId(member.user_id);
    setRemoveMemberError(null);
    try {
      await removeOrganizationMember(member.user_id, organizationId, token);
      setMembers((prev) => prev.filter((m) => m.user_id !== member.user_id));
    } catch (err) {
      console.error("Erreur de retrait:", err);
      setRemoveMemberError(err.message || "Erreur lors du retrait du membre");
    } finally {
      setRemovingMemberId(null);
    }
  };

  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(
      establishments.map((e) => [e.id, { name: e.name || "", city: e.city || "", contact_email: e.contact_email || "" }])
    )
  );
  const [saving, setSaving] = useState({});
  const [saved, setSaved] = useState({});
  const [errors, setErrors] = useState({});
  const [deletingEstabId, setDeletingEstabId] = useState(null);
  const [newName, setNewName] = useState("");
  const [newCity, setNewCity] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState(null);

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim() !== currentUserEmail) return;
    setDeletingAccount(true);
    setDeleteAccountError(null);
    try {
      const res = await fetch("/api/delete-account", {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de la suppression");
      onDeleteAccount();
    } catch (err) {
      console.error("Erreur suppression compte:", err);
      setDeleteAccountError(err.message || "Erreur lors de la suppression");
    } finally {
      setDeletingAccount(false);
    }
  };

  const inputStyle = {
    flex: 1,
    minWidth: 0,
    width: "100%",
    boxSizing: "border-box",
    padding: "8px 10px",
    borderRadius: 6,
    border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
    fontFamily: "'Inter', sans-serif",
    fontSize: 13,
    outline: "none",
  };

  const saveOrgName = async () => {
    if (!orgNameDraft.trim()) return;
    setRenamingOrg(true);
    setOrgRenamed(false);
    setOrgRenameError(null);
    try {
      const updated = await renameOrganization(organizationId, orgNameDraft.trim(), token);
      if (!updated) throw new Error("Aucune donnée retournee");
      onRenameOrganization(updated.name);
      setOrgRenamed(true);
    } catch (err) {
      console.error("Erreur de renommage:", err);
      setOrgRenameError(err.message || "Erreur lors du renommage");
    } finally {
      setRenamingOrg(false);
    }
  };

  const createEstablishment = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await insertEstablishment(newName.trim(), newCity.trim(), organizationId, token);
      if (!created) throw new Error("Aucune donnée retournee");
      onAddEstablishment(created);
      setNewName("");
      setNewCity("");
    } catch (err) {
      console.error("Erreur de creation:", err);
      setCreateError(err.message || "Erreur lors de la creation");
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      establishments.forEach((e) => {
        if (!next[e.id]) {
          next[e.id] = { name: e.name || "", city: e.city || "", contact_email: e.contact_email || "" };
        }
      });
      return next;
    });
  }, [establishments]);

  const save = async (id) => {
    setSaving((prev) => ({ ...prev, [id]: true }));
    setSaved((prev) => ({ ...prev, [id]: false }));
    setErrors((prev) => ({ ...prev, [id]: null }));
    try {
      const d = drafts[id];
      const updated = await updateEstablishmentDetails(
        id,
        { name: d.name.trim(), city: d.city.trim(), contact_email: d.contact_email.trim() },
        token
      );
      if (!updated) {
        throw new Error("Aucune donnée retournee (droits d'accès manquants sur la base ?)");
      }
      onUpdate(updated);
      setSaved((prev) => ({ ...prev, [id]: true }));
    } catch (err) {
      console.error("Erreur de sauvegarde:", err);
      setErrors((prev) => ({ ...prev, [id]: err.message || "Erreur lors de l'enregistrement" }));
    } finally {
      setSaving((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleDeleteEstablishment = async (e) => {
    const confirmed = window.confirm(
      "Supprimer \"" + e.name + "\" ? Tous les salariés rattaches a cet établissement seront également supprimes définitivement."
    );
    if (!confirmed) return;
    setDeletingEstabId(e.id);
    try {
      await deleteEstablishment(e.id, token);
      onDeleteEstablishment(e.id);
    } catch (err) {
      console.error("Erreur de suppression:", err);
      setErrors((prev) => ({ ...prev, [e.id]: err.message || "Erreur lors de la suppression" }));
    } finally {
      setDeletingEstabId(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 640 }}>
      <div style={{ background: "#fff", border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)", borderRadius: 8, padding: "20px 24px" }}>
        <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, fontWeight: 600, color: TOKENS.ink, margin: "0 0 4px" }}>
          Mon profil
        </h3>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: TOKENS.inkSoft, margin: "0 0 16px" }}>
          Email de connexion : <strong>{currentUserEmail}</strong>
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              flexShrink: 0,
              overflow: "hidden",
              background: TOKENS.brand,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 600,
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Photo de profil" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              (displayNameDraft || currentUserEmail || "?")
                .split(/\s+/)
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()
            )}
          </div>
          <div>
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 12px",
                borderRadius: 6,
                border: "1px solid " + TOKENS.line,
                background: "#fff",
                color: TOKENS.ink,
                fontFamily: "'Inter', sans-serif",
                fontSize: 12,
                fontWeight: 500,
                cursor: uploadingAvatar ? "default" : "pointer",
                opacity: uploadingAvatar ? 0.6 : 1,
              }}
            >
              <Camera size={13} /> {uploadingAvatar ? "Envoi..." : "Changer la photo"}
              <input
                type="file"
                accept="image/*"
                disabled={uploadingAvatar}
                onChange={(e) => handleAvatarUpload(e.target.files?.[0] || null)}
                style={{ display: "none" }}
              />
            </label>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 10.5, color: TOKENS.inkSoft, margin: "6px 0 0" }}>
              JPG ou PNG, 3 Mo maximum.
            </p>
          </div>
        </div>
        {avatarError && <div style={{ fontSize: 11.5, color: TOKENS.danger, marginBottom: 14 }}>{avatarError}</div>}

        <label style={{ display: "block", fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 500, color: TOKENS.inkSoft, marginBottom: 5 }}>
          Nom affiche (facultatif)
        </label>
        <div style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Ex. Marie Dupont"
            value={displayNameDraft}
            onChange={(e) => setDisplayNameDraft(e.target.value)}
            style={{
              flex: "1 1 200px",
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid " + TOKENS.line,
              boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <button
            onClick={saveDisplayName}
            disabled={savingDisplayName}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "none",
              background: TOKENS.brand,
              color: "#fff",
              fontFamily: "'Inter', sans-serif",
              fontSize: 12.5,
              fontWeight: 500,
              cursor: savingDisplayName ? "default" : "pointer",
              opacity: savingDisplayName ? 0.6 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {savingDisplayName ? "..." : "Enregistrer"}
          </button>
        </div>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: TOKENS.inkSoft, margin: "0 0 14px", lineHeight: 1.5 }}>
          S'affiche à la place de votre email dans la liste des membres de l'équipe. Laissez vide pour continuer à afficher votre email.
        </p>
        {displayNameSaved && <div style={{ fontSize: 11.5, color: TOKENS.ok, marginBottom: 14 }}>Enregistré.</div>}
        {displayNameError && <div style={{ fontSize: 11.5, color: TOKENS.danger, marginBottom: 14 }}>{displayNameError}</div>}

        <div style={{ borderTop: "1px solid " + TOKENS.line, margin: "4px 0 16px" }} />

        <label style={{ display: "block", fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 500, color: TOKENS.inkSoft, marginBottom: 5 }}>
          Nouvelle adresse email
        </label>
        <div style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
          <input
            type="email"
            placeholder="nouvelle.adresse@exemple.fr"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            autoComplete="off"
            name="confia-new-email"
            style={{
              flex: "1 1 200px",
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid " + TOKENS.line,
              boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <button
            onClick={handleChangeEmail}
            disabled={changingEmail || !newEmail.trim()}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "none",
              background: TOKENS.brand,
              color: "#fff",
              fontFamily: "'Inter', sans-serif",
              fontSize: 12.5,
              fontWeight: 500,
              cursor: changingEmail ? "default" : "pointer",
              opacity: changingEmail || !newEmail.trim() ? 0.6 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {changingEmail ? "..." : "Changer l'email"}
          </button>
        </div>
        {emailChangeRequested && (
          <div style={{ fontSize: 11.5, color: TOKENS.ok, marginBottom: 14, lineHeight: 1.5 }}>
            Un email de confirmation a été envoyé à la nouvelle adresse. Le changement ne sera effectif
            qu'après avoir clique sur le lien recu.
          </div>
        )}
        {emailChangeError && <div style={{ fontSize: 11.5, color: TOKENS.danger, marginBottom: 14 }}>{emailChangeError}</div>}

        <div style={{ borderTop: "1px solid " + TOKENS.line, margin: "4px 0 16px" }} />

        <label style={{ display: "block", fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 500, color: TOKENS.inkSoft, marginBottom: 5 }}>
          Nouveau mot de passe
        </label>
        <PasswordInput
          placeholder="Au moins 6 caracteres"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid " + TOKENS.line,
            boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
            fontFamily: "'Inter', sans-serif",
            fontSize: 13,
            outline: "none",
            boxSizing: "border-box",
            marginBottom: 10,
          }}
        />
        <label style={{ display: "block", fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 500, color: TOKENS.inkSoft, marginBottom: 5 }}>
          Confirmer le nouveau mot de passe
        </label>
        <PasswordInput
          placeholder="Confirmer"
          value={confirmNewPassword}
          onChange={(e) => setConfirmNewPassword(e.target.value)}
          autoComplete="new-password"
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid " + TOKENS.line,
            boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
            fontFamily: "'Inter', sans-serif",
            fontSize: 13,
            outline: "none",
            boxSizing: "border-box",
            marginBottom: 4,
          }}
        />
        <button
          onClick={handleChangePassword}
          disabled={changingPassword || !newPassword || !confirmNewPassword}
          style={{
            marginTop: 10,
            padding: "8px 16px",
            borderRadius: 6,
            border: "none",
            background: TOKENS.brand,
            color: "#fff",
            fontFamily: "'Inter', sans-serif",
            fontSize: 12.5,
            fontWeight: 500,
            cursor: changingPassword ? "default" : "pointer",
            opacity: changingPassword || !newPassword || !confirmNewPassword ? 0.6 : 1,
          }}
        >
          {changingPassword ? "..." : "Changer le mot de passe"}
        </button>
        {passwordChanged && <div style={{ fontSize: 11.5, color: TOKENS.ok, marginTop: 8 }}>Mot de passe modifie avec succes.</div>}
        {passwordChangeError && <div style={{ fontSize: 11.5, color: TOKENS.danger, marginTop: 8 }}>{passwordChangeError}</div>}
      </div>

      <div style={{ background: "#fff", border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)", borderRadius: 8, padding: "20px 24px" }}>
        <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, fontWeight: 600, color: TOKENS.ink, margin: "0 0 4px" }}>
          Nom de votre organisation
        </h3>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: TOKENS.inkSoft, margin: "0 0 14px" }}>
          Ce nom est affiche en haut de l'application et sur vos rapports PDF.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={orgNameDraft}
            onChange={(e) => setOrgNameDraft(e.target.value)}
            style={{
              flex: 1,
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              outline: "none",
            }}
          />
          <button
            onClick={saveOrgName}
            disabled={renamingOrg || !orgNameDraft.trim()}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "none",
              background: TOKENS.brand,
              color: "#fff",
              fontFamily: "'Inter', sans-serif",
              fontSize: 12.5,
              fontWeight: 500,
              cursor: renamingOrg ? "default" : "pointer",
              opacity: renamingOrg || !orgNameDraft.trim() ? 0.6 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {renamingOrg ? "..." : "Enregistrer"}
          </button>
        </div>
        {orgRenamed && <div style={{ fontSize: 11.5, color: TOKENS.ok, marginTop: 8 }}>Enregistré</div>}
        {orgRenameError && <div style={{ fontSize: 11.5, color: TOKENS.danger, marginTop: 8 }}>{orgRenameError}</div>}
      </div>

      <div style={{ background: "#fff", border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)", borderRadius: 8, padding: "20px 24px" }}>
        <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, fontWeight: 600, color: TOKENS.ink, margin: "0 0 4px" }}>
          Seuil d'alerte "Échéance proche"
        </h3>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: TOKENS.inkSoft, margin: "0 0 14px" }}>
          Nombre de jours avant l'échéance du vaccin grippe à partir duquel un salarié passe au statut
          "Échéance proche" plutôt que "À jour". Valeur par défaut : 45 jours.
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="number"
            min={1}
            max={365}
            value={alertThresholdDraft}
            onChange={(e) => setAlertThresholdDraft(e.target.value)}
            style={{
              width: 90,
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: TOKENS.inkSoft }}>jours</span>
          <button
            onClick={saveAlertThreshold}
            disabled={savingThreshold}
            style={{
              marginLeft: 8,
              padding: "8px 16px",
              borderRadius: 6,
              border: "none",
              background: TOKENS.brand,
              color: "#fff",
              fontFamily: "'Inter', sans-serif",
              fontSize: 12.5,
              fontWeight: 500,
              cursor: savingThreshold ? "default" : "pointer",
              opacity: savingThreshold ? 0.6 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {savingThreshold ? "..." : "Enregistrer"}
          </button>
        </div>
        {thresholdSaved && <div style={{ fontSize: 11.5, color: TOKENS.ok, marginTop: 8 }}>Enregistré. Les statuts ont été recalculés.</div>}
        {thresholdError && <div style={{ fontSize: 11.5, color: TOKENS.danger, marginTop: 8 }}>{thresholdError}</div>}
      </div>

      <div style={{ background: "#fff", border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)", borderRadius: 8, padding: "20px 24px" }}>
        <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, fontWeight: 600, color: TOKENS.ink, margin: "0 0 4px" }}>
          Membres de l'équipe
        </h3>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: TOKENS.inkSoft, margin: "0 0 14px" }}>
          Invitez des collègues à rejoindre votre organisation. Ils devront s'inscrire avec la même adresse email que celle invitée.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input
            type="email"
            placeholder="email@collegue.fr"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            autoComplete="off"
            name="confia-invite-email"
            style={{
              flex: 1,
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              outline: "none",
            }}
          />
          <button
            onClick={sendInvite}
            disabled={inviting || !inviteEmail.trim()}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "none",
              background: TOKENS.brand,
              color: "#fff",
              fontFamily: "'Inter', sans-serif",
              fontSize: 12.5,
              fontWeight: 500,
              cursor: inviting ? "default" : "pointer",
              opacity: inviting || !inviteEmail.trim() ? 0.6 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {inviting ? "..." : "Inviter"}
          </button>
        </div>
        {inviteSent && (
          <div style={{ fontSize: 11.5, color: TOKENS.ok, marginBottom: 10 }}>
            {inviteResultMessage || "Invitation envoyee"}
          </div>
        )}
        {inviteError && <div style={{ fontSize: 11.5, color: TOKENS.danger, marginBottom: 10 }}>{inviteError}</div>}
        {removeMemberError && <div style={{ fontSize: 11.5, color: TOKENS.danger, marginBottom: 10 }}>{removeMemberError}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {members.map((m) => {
            const canRemove = isOwner && m.email !== currentUserEmail;
            return (
              <div
                key={m.user_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: TOKENS.paperDim,
                  borderRadius: 6,
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 13,
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {m.avatar_url ? (
                    <img
                      src={m.avatar_url}
                      alt=""
                      style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                    />
                  ) : (
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: TOKENS.brand,
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 9,
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {(m.display_name || m.email).slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  {m.display_name ? m.display_name : m.email}
                  {m.email === currentUserEmail ? " (vous)" : ""}
                  {m.display_name && (
                    <span style={{ color: TOKENS.inkSoft, fontSize: 11 }}>({m.email})</span>
                  )}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, color: TOKENS.inkSoft, textTransform: "uppercase" }}>{m.role}</span>
                  {canRemove && (
                    <button
                      onClick={() => handleRemoveMember(m)}
                      disabled={removingMemberId === m.user_id}
                      title="Retirer ce membre"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 24,
                        height: 24,
                        borderRadius: 5,
                        border: "1px solid " + TOKENS.line,
                        background: "#fff",
                        color: TOKENS.danger,
                        cursor: removingMemberId === m.user_id ? "default" : "pointer",
                        opacity: removingMemberId === m.user_id ? 0.5 : 1,
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {pendingInvites.map((inv) => (
            <div
              key={inv.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                background: TOKENS.warnBg,
                borderRadius: 6,
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.email}</span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: TOKENS.warn,
                    background: "#fff",
                    border: "1px solid " + TOKENS.warn + "44",
                    borderRadius: 4,
                    padding: "2px 7px",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  EN ATTENTE
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                {resendResult[inv.id] === "error" && (
                  <span style={{ fontSize: 11, color: TOKENS.danger, marginRight: 2 }}>Echec</span>
                )}
                <button
                  onClick={() => resendInvite(inv)}
                  disabled={resendingInviteId === inv.id}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "5px 10px",
                    borderRadius: 5,
                    border: "1px solid " + (resendResult[inv.id] === "sent" ? TOKENS.ok : TOKENS.line),
                    background: "#fff",
                    color: resendResult[inv.id] === "sent" ? TOKENS.ok : TOKENS.ink,
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 11.5,
                    fontWeight: 500,
                    cursor: resendingInviteId === inv.id ? "default" : "pointer",
                    opacity: resendingInviteId === inv.id ? 0.6 : 1,
                    whiteSpace: "nowrap",
                  }}
                >
                  {resendingInviteId === inv.id
                    ? "Envoi..."
                    : resendResult[inv.id] === "sent"
                    ? "Envoyee"
                    : "Renvoyer"}
                </button>
                <button
                  onClick={() => cancelInvite(inv.id)}
                  title="Annuler l'invitation"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 26,
                    height: 26,
                    borderRadius: 5,
                    border: "1px solid " + TOKENS.line,
                    background: "#fff",
                    color: TOKENS.danger,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)", borderRadius: 8, padding: "20px 24px" }}>
        <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, fontWeight: 600, color: TOKENS.ink, margin: "0 0 4px" }}>
          Ajouter un établissement
        </h3>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: TOKENS.inkSoft, margin: "0 0 14px" }}>
          Chaque établissement que vous ajoutez ici est visible uniquement par votre organisation.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            placeholder="Nom de l'établissement"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ ...inputStyle, flex: "2 1 180px" }}
          />
          <input
            placeholder="Ville (optionnel)"
            value={newCity}
            onChange={(e) => setNewCity(e.target.value)}
            style={{ ...inputStyle, flex: "1 1 120px" }}
          />
          <button
            onClick={createEstablishment}
            disabled={creating || !newName.trim()}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "none",
              background: TOKENS.brand,
              color: "#fff",
              fontFamily: "'Inter', sans-serif",
              fontSize: 12.5,
              fontWeight: 500,
              cursor: creating ? "default" : "pointer",
              opacity: creating || !newName.trim() ? 0.6 : 1,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {creating ? "..." : "Ajouter"}
          </button>
        </div>
        {createError && (
          <div style={{ fontSize: 11.5, color: TOKENS.danger, marginTop: 8 }}>{createError}</div>
        )}
      </div>

      <div style={{ background: "#fff", border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)", borderRadius: 8, padding: "20px 24px" }}>
      <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, fontWeight: 600, color: TOKENS.ink, margin: "0 0 4px" }}>
        Vos établissements
      </h3>
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: TOKENS.inkSoft, margin: "0 0 18px" }}>
        Modifiez le nom, la ville ou l'email de contact de chaque établissement, ou supprimez-le.
      </p>
      {establishments.length === 0 ? (
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: TOKENS.inkSoft }}>
          Ajoutez d'abord un établissement ci-dessus.
        </p>
      ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {establishments.map((e) => {
          const d = drafts[e.id] || { name: "", city: "", contact_email: "" };
          const setField = (field, value) =>
            setDrafts((prev) => ({ ...prev, [e.id]: { ...prev[e.id], [field]: value } }));
          return (
            <div key={e.id} style={{ padding: "14px", background: TOKENS.paperDim, borderRadius: 8 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <div style={{ flex: "2 1 180px", minWidth: 0 }}>
                  <label style={{ display: "block", fontSize: 11.5, color: TOKENS.inkSoft, marginBottom: 4 }}>Nom</label>
                  <input
                    value={d.name}
                    onChange={(ev) => setField("name", ev.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: "1 1 120px", minWidth: 0 }}>
                  <label style={{ display: "block", fontSize: 11.5, color: TOKENS.inkSoft, marginBottom: 4 }}>Ville</label>
                  <input
                    value={d.city}
                    onChange={(ev) => setField("city", ev.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
              <label style={{ display: "block", fontSize: 11.5, color: TOKENS.inkSoft, marginBottom: 4 }}>
                Email de contact (pour le résumé quotidien)
              </label>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="email"
                  placeholder="email@établissement.fr"
                  value={d.contact_email}
                  onChange={(ev) => setField("contact_email", ev.target.value)}
                  autoComplete="off"
                  name={"contact-email-" + e.id}
                  style={{ ...inputStyle, flex: "3 1 180px" }}
                />
                <button
                  onClick={() => save(e.id)}
                  disabled={saving[e.id]}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 6,
                    border: "none",
                    background: TOKENS.brand,
                    color: "#fff",
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 12.5,
                    fontWeight: 500,
                    cursor: saving[e.id] ? "default" : "pointer",
                    opacity: saving[e.id] ? 0.6 : 1,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {saving[e.id] ? "..." : "Enregistrer"}
                </button>
                <button
                  onClick={() => handleDeleteEstablishment(e)}
                  disabled={deletingEstabId === e.id}
                  title="Supprimer cet établissement"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 34,
                    height: 34,
                    borderRadius: 6,
                    border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
                    background: "#fff",
                    color: TOKENS.danger,
                    cursor: deletingEstabId === e.id ? "default" : "pointer",
                    opacity: deletingEstabId === e.id ? 0.5 : 1,
                    flexShrink: 0,
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {saved[e.id] && (
                <div style={{ fontSize: 11.5, color: TOKENS.ok, marginTop: 4 }}>Enregistre</div>
              )}
              {errors[e.id] && (
                <div style={{ fontSize: 11.5, color: TOKENS.danger, marginTop: 4 }}>{errors[e.id]}</div>
              )}
            </div>
          );
        })}
      </div>
      )}
      </div>

      <div style={{ background: "#fff", border: "1px solid " + TOKENS.danger + "44", borderRadius: 8, padding: "20px 24px" }}>
        <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, fontWeight: 600, color: TOKENS.danger, margin: "0 0 4px" }}>
          Zone de danger
        </h3>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: TOKENS.inkSoft, margin: "0 0 14px" }}>
          Supprimer votre compte est définitif et irréversible. Vos établissements et salariés resteront liés à votre organisation mais vous n'y aurez plus accès.
        </p>
        <label style={{ display: "block", fontSize: 12, color: TOKENS.ink, marginBottom: 6 }}>
          Tapez votre email (<strong>{currentUserEmail}</strong>) pour confirmer :
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder={currentUserEmail}
            style={{
              flex: "1 1 200px",
              minWidth: 0,
              width: "100%",
              boxSizing: "border-box",
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              outline: "none",
            }}
          />
          <button
            onClick={handleDeleteAccount}
            disabled={deletingAccount || deleteConfirmText.trim() !== currentUserEmail}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "none",
              background: TOKENS.danger,
              color: "#fff",
              fontFamily: "'Inter', sans-serif",
              fontSize: 12.5,
              fontWeight: 500,
              cursor: deletingAccount || deleteConfirmText.trim() !== currentUserEmail ? "default" : "pointer",
              opacity: deletingAccount || deleteConfirmText.trim() !== currentUserEmail ? 0.5 : 1,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {deletingAccount ? "Suppression..." : "Supprimer mon compte"}
          </button>
        </div>
        {deleteAccountError && (
          <div style={{ fontSize: 11.5, color: TOKENS.danger, marginTop: 8 }}>{deleteAccountError}</div>
        )}
      </div>
    </div>
  );
}

function ReportsView({ staff, establishments, organizationName }) {
  const [generating, setGenerating] = useState(false);
  const [generatingCsv, setGeneratingCsv] = useState(false);

  // Echappe une valeur pour l'inserer proprement dans une cellule CSV
  // (encadre de guillemets et double les guillemets internes des qu'un
  // caractere special est present, pour rester compatible Excel/LibreOffice).
  const csvEscape = (value) => {
    const str = String(value ?? "");
    if (/[",;\n]/.test(str)) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const generateCSV = () => {
    setGeneratingCsv(true);
    try {
      const today = new Date().toLocaleDateString("fr-FR");
      const headers = ["Nom", "Fonction", "Établissement", "Vaccin", "Statut", "Dernière mise à jour", "Échéance"];
      const rows = [headers];

      staff.forEach((s) => {
        const estabName = establishments.find((e) => e.id === s.site)?.name || "-";
        const vaccinRows = s.vaccinations.length > 0
          ? s.vaccinations
          : [{ vaccine: "-", status: "non_conforme", updated: "-", next: "Aucun suivi" }];
        vaccinRows.forEach((v) => {
          const statusLabel = STATUS_META[v.status]?.label || v.status;
          rows.push([
            s.name,
            s.role || "-",
            estabName,
            v.vaccine || "-",
            statusLabel,
            v.updated || "-",
            v.next || "-",
          ]);
        });
      });

      // Le point-virgule est le separateur standard pour qu'Excel en version
      // francaise ouvre le fichier directement dans des colonnes distinctes.
      const csvContent = rows.map((row) => row.map(csvEscape).join(";")).join("\r\n");
      // Le prefixe BOM assure que les caracteres accentues (e, a...) s'affichent
      // correctement dans Excel plutot que d'apparaitre comme des symboles errones.
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "rapport-conformite-vaccinale-" + today.replace(/\//g, "-") + ".csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Erreur de génération CSV:", err);
      alert("Erreur lors de la génération du CSV. Reessayez.");
    } finally {
      setGeneratingCsv(false);
    }
  };

  const generatePDF = () => {
    setGenerating(true);
    try {
      const doc = new jsPDF();
      const today = new Date().toLocaleDateString("fr-FR");
      const total = staff.length;
      const conforme = staff.filter((s) => s.status === "conforme").length;
      const percent = total ? Math.round((conforme / total) * 100) : 0;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Rapport de conformité vaccinale", 14, 18);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(organizationName || "Confia", 14, 26);
      doc.text("Généré le " + today, 14, 32);
      doc.text("Taux de conformité global : " + percent + "% (" + conforme + "/" + total + ")", 14, 40);

      let y = 52;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Détail par salarié", 14, y);
      y += 8;

      doc.setFontSize(9);
      doc.text("Nom", 14, y);
      doc.text("Établissement", 65, y);
      doc.text("Vaccin", 120, y);
      doc.text("Statut", 145, y);
      doc.text("Échéance", 172, y);
      y += 5;
      doc.setLineWidth(0.2);
      doc.line(14, y, 196, y);
      y += 6;

      doc.setFont("helvetica", "normal");
      staff.forEach((s) => {
        const estabName = establishments.find((e) => e.id === s.site)?.name || "-";
        const rows = s.vaccinations.length > 0
          ? s.vaccinations
          : [{ vaccine: "-", status: "non_conforme", next: "Aucun suivi" }];
        rows.forEach((v) => {
          if (y > 280) {
            doc.addPage();
            y = 20;
          }
          const statusLabel = STATUS_META[v.status]?.label || v.status;
          doc.text(s.name.slice(0, 26), 14, y);
          doc.text(estabName.slice(0, 26), 65, y);
          doc.text(v.vaccine || "-", 120, y);
          doc.text(statusLabel, 145, y);
          doc.text(v.next || "-", 172, y);
          y += 6;
        });
      });

      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        "Document généré automatiquement par Confia - à des fins de suivi interne.",
        14,
        290
      );

      doc.save("rapport-conformite-vaccinale-" + today.replace(/\//g, "-") + ".pdf");
    } catch (err) {
      console.error("Erreur de génération PDF:", err);
      alert("Erreur lors de la génération du PDF. Reessayez.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
        borderRadius: 8,
        padding: "32px",
        textAlign: "center",
        maxWidth: 480,
        margin: "40px auto",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 8,
          background: TOKENS.paperDim,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 14px",
        }}
      >
        <FileDown size={20} color={TOKENS.brand} />
      </div>
      <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 17, fontWeight: 600, color: TOKENS.ink, margin: "0 0 8px" }}>
        Rapport de conformité
      </h3>
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: TOKENS.inkSoft, lineHeight: 1.6, margin: "0 0 18px" }}>
        Générez un export horodaté, prêt à présenter lors d'un contrôle ou d'un renouvellement d'agrément.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <button
          onClick={generatePDF}
          disabled={generating || staff.length === 0}
          style={{
            padding: "9px 18px",
            borderRadius: 6,
            border: "none",
            background: TOKENS.brand,
            color: "#fff",
            fontFamily: "'Inter', sans-serif",
            fontSize: 13.5,
            fontWeight: 500,
            cursor: generating ? "default" : "pointer",
            opacity: generating || staff.length === 0 ? 0.6 : 1,
          }}
        >
          {generating ? "Génération..." : "Générer le PDF"}
        </button>
        <button
          onClick={generateCSV}
          disabled={generatingCsv || staff.length === 0}
          style={{
            padding: "9px 18px",
            borderRadius: 6,
            border: "1px solid " + TOKENS.line,
            background: "#fff",
            color: TOKENS.ink,
            fontFamily: "'Inter', sans-serif",
            fontSize: 13.5,
            fontWeight: 500,
            cursor: generatingCsv ? "default" : "pointer",
            opacity: generatingCsv || staff.length === 0 ? 0.6 : 1,
          }}
        >
          {generatingCsv ? "Génération..." : "Exporter en CSV"}
        </button>
      </div>
    </div>
  );
}

function LandingPricingCard({ plan, billingPeriod, onGetStarted }) {
  return (
    <div
      style={{
        flex: "1 1 220px",
        border: "1px solid " + (plan.highlighted ? TOKENS.brand : TOKENS.line),
        borderRadius: 10,
        padding: "22px 20px",
        position: "relative",
        background: plan.highlighted ? TOKENS.okBg : "#fff",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {plan.highlighted && (
        <span
          style={{
            position: "absolute",
            top: -10,
            left: 18,
            background: TOKENS.brand,
            color: "#fff",
            fontSize: 11,
            fontWeight: 500,
            padding: "2px 10px",
            borderRadius: 4,
          }}
        >
          Populaire
        </span>
      )}
      <div style={{ fontSize: 17, fontWeight: 600, color: TOKENS.ink, marginTop: 4 }}>{plan.name}</div>
      <div style={{ fontSize: 12.5, color: TOKENS.inkSoft, marginBottom: 12 }}>{plan.tagline}</div>
      <div style={{ fontSize: 26, fontWeight: 600, color: TOKENS.ink }}>
        {billingPeriod === "monthly" ? plan.monthly : plan.annual}
        <span style={{ fontSize: 13, fontWeight: 400, color: TOKENS.inkSoft }}>
          {billingPeriod === "monthly" ? "/mois" : "/an"}
        </span>
      </div>
      <ul style={{ margin: "14px 0 18px", padding: "0 0 0 18px", fontSize: 12.5, color: TOKENS.inkSoft, lineHeight: 1.85, flex: 1 }}>
        {plan.features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <button
        onClick={onGetStarted}
        style={{
          width: "100%",
          padding: "10px",
          borderRadius: 6,
          border: "none",
          background: TOKENS.brand,
          color: "#fff",
          fontFamily: "'Inter', sans-serif",
          fontSize: 13.5,
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        Commencer
      </button>
    </div>
  );
}

function LandingFeatureCard({ icon: Icon, title, description }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid " + TOKENS.line,
        boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
        borderRadius: 10,
        padding: "22px 22px",
        flex: "1 1 220px",
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 8,
          background: TOKENS.paperDim,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 14,
        }}
      >
        <Icon size={19} color={TOKENS.brand} />
      </div>
      <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, fontWeight: 600, color: TOKENS.ink, margin: "0 0 6px" }}>
        {title}
      </h3>
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: TOKENS.inkSoft, lineHeight: 1.6, margin: 0 }}>
        {description}
      </p>
    </div>
  );
}

function LandingPage({ onGetStarted, onLogin, onNavigateBlog }) {
  const [billingPeriod, setBillingPeriod] = useState("monthly");
  const [legalModal, setLegalModal] = useState(null); // null | "mentions" | "confidentialite"

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: TOKENS.ink }}>
      {/* Barre de navigation */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 4px",
          maxWidth: 1040,
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 7,
              background: TOKENS.paperDim,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LogoMark size={18} />
          </div>
          <span style={{ fontSize: 17, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Confia
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <button
            onClick={onNavigateBlog}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              fontWeight: 500,
              color: TOKENS.inkSoft,
              cursor: "pointer",
            }}
          >
            Blog
          </button>
          <button
            onClick={onLogin}
            style={{
              background: "none",
              border: "1px solid " + TOKENS.line,
              borderRadius: 6,
              padding: "8px 16px",
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              fontWeight: 500,
              color: TOKENS.ink,
              cursor: "pointer",
            }}
          >
            Se connecter
          </button>
        </div>
      </div>

      {/* Hero */}
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "56px 20px 40px", textAlign: "center" }}>
        <span
          style={{
            display: "inline-block",
            padding: "5px 14px",
            borderRadius: 20,
            background: TOKENS.okBg,
            color: TOKENS.ok,
            fontSize: 12.5,
            fontWeight: 600,
            marginBottom: 20,
          }}
        >
          Loi de financement de la sécurité sociale 2026 — obligation vaccinale médico-social
        </span>
        <h1 style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.25, margin: "0 0 18px" }}>
          La conformité vaccinale de votre EHPAD,
          <br />
          enfin maîtrisée.
        </h1>
        <p style={{ fontSize: 15.5, color: TOKENS.inkSoft, lineHeight: 1.65, maxWidth: 620, margin: "0 auto 30px" }}>
          Depuis le 1er janvier 2026, l'obligation vaccinale contre la grippe s'applique à l'ensemble du
          personnel soignant en EHPAD (article L.3111-4 du code de la santé publique). Une nouvelle
          obligation rougeole est prévue par la LFSS 2026. Confia centralise le suivi de votre personnel,
          automatise les relances et génère vos justificatifs de conformité.
        </p>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <button
            onClick={onGetStarted}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: TOKENS.brand,
              color: "#fff",
              border: "none",
              borderRadius: 7,
              padding: "13px 26px",
              fontFamily: "'Inter', sans-serif",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Créer mon compte <ChevronRight size={16} />
          </button>
          <span style={{ fontSize: 12, color: TOKENS.inkSoft }}>
            Sans engagement — annulation possible à tout moment.
          </span>
        </div>
      </div>

      {/* Fonctionnalites */}
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "20px 20px 60px" }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <LandingFeatureCard
            icon={Users}
            title="Suivi centralise du personnel"
            description="Visualisez en un coup d'œil le statut vaccinal de chaque salarié, établissement par établissement."
          />
          <LandingFeatureCard
            icon={BellRing}
            title="Alertes automatiques"
            description="Recevez chaque jour un résumé de conformité par email, sans avoir à vérifier manuellement."
          />
          <LandingFeatureCard
            icon={FileDown}
            title="Rapports prêts pour un contrôle"
            description="Générez en un clic un rapport PDF horodaté à présenter lors d'une inspection ou d'un renouvellement d'agrément."
          />
          <LandingFeatureCard
            icon={Building2}
            title="Multi-établissements"
            description="Gérez plusieurs EHPAD et invitez votre équipe au sein d'une seule organisation."
          />
        </div>
      </div>

      {/* Tarifs */}
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "20px 20px 60px" }}>
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 10px" }}>Nos tarifs</h2>
          <p style={{ fontSize: 14, color: TOKENS.inkSoft, margin: "0 0 18px" }}>
            Choisissez l'offre adaptée à votre organisation. Sans engagement, résiliable à tout moment.
          </p>
          <div
            style={{
              display: "inline-flex",
              background: TOKENS.paperDim,
              borderRadius: 6,
              padding: 3,
            }}
          >
            {["monthly", "annual"].map((period) => (
              <button
                key={period}
                onClick={() => setBillingPeriod(period)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 5,
                  border: "none",
                  background: billingPeriod === period ? TOKENS.brand : "transparent",
                  color: billingPeriod === period ? "#fff" : TOKENS.inkSoft,
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 12.5,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {period === "monthly" ? "Mensuel" : "Annuel (2 mois offerts)"}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {PLANS.map((plan) => (
            <LandingPricingCard key={plan.key} plan={plan} billingPeriod={billingPeriod} onGetStarted={onGetStarted} />
          ))}
        </div>
      </div>

      {/* Section réglementaire */}
      <div style={{ background: "#fff", borderTop: "1px solid " + TOKENS.line, borderBottom: "1px solid " + TOKENS.line }}>
        <div style={{ maxWidth: 780, margin: "0 auto", padding: "44px 20px", textAlign: "center" }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 9,
              background: TOKENS.paperDim,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <ShieldCheck size={21} color={TOKENS.brand} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 12px" }}>
            Une obligation légale, un outil pensé pour y répondre
          </h2>
          <p style={{ fontSize: 13.5, color: TOKENS.inkSoft, lineHeight: 1.7, margin: 0 }}>
            L'obligation vaccinale grippe pour le personnel soignant en EHPAD est en vigueur depuis le 1er
            janvier 2026. La LFSS 2026 prévoit également une nouvelle obligation vaccinale rougeole pour le
            personnel du secteur médico-social, dont le décret d'application est attendu. Confia est un
            outil de suivi interne qui vous aide à anticiper ces échéances ; il ne remplace pas un avis
            juridique ou médical.
          </p>
        </div>
      </div>

      {/* Section sécurité des données */}
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "44px 20px" }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 24px", textAlign: "center" }}>
          Sécurité et confidentialité des données
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <h3 style={{ fontSize: 14.5, fontWeight: 600, color: TOKENS.ink, margin: "0 0 6px" }}>
              Hébergement et infrastructure
            </h3>
            <p style={{ fontSize: 13.5, color: TOKENS.inkSoft, lineHeight: 1.7, margin: 0 }}>
              Vos données sont hébergées sur des infrastructures cloud sécurisées (chiffrement au repos
              et en transit, sauvegardes automatiques quotidiennes). Nous sommes actuellement engagés
              dans une démarche de migration vers un hébergement certifié HDS (Hébergement de Données
              de Santé), conformément aux exigences de l'article L.1111-8 du Code de la santé publique.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: 14.5, fontWeight: 600, color: TOKENS.ink, margin: "0 0 6px" }}>
              Accès et confidentialité
            </h3>
            <p style={{ fontSize: 13.5, color: TOKENS.inkSoft, lineHeight: 1.7, margin: 0 }}>
              Chaque établissement n'a accès qu'à ses propres données. Les résumés envoyés par email
              sont anonymisés (aucun nom de salarié n'y figure). L'accès à la plateforme est protégé
              par authentification individuelle.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: 14.5, fontWeight: 600, color: TOKENS.ink, margin: "0 0 6px" }}>
              Conformité RGPD
            </h3>
            <p style={{ fontSize: 13.5, color: TOKENS.inkSoft, lineHeight: 1.7, margin: 0 }}>
              Confia respecte les principes du RGPD : minimisation des données collectées, droit
              d'accès et de suppression sur demande, durée de conservation limitée aux besoins de
              conformité réglementaire.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: 14.5, fontWeight: 600, color: TOKENS.ink, margin: "0 0 6px" }}>
              Une question sur la sécurité de vos données ?
            </h3>
            <p style={{ fontSize: 13.5, color: TOKENS.inkSoft, lineHeight: 1.7, margin: 0 }}>
              Contactez-nous à{" "}
              <a href="mailto:contact@confia-app.fr" style={{ color: TOKENS.brand }}>
                contact@confia-app.fr
              </a>{" "}
              — nous répondons personnellement à toute question avant signature.
            </p>
          </div>
        </div>
      </div>

      {/* Bandeau final */}
      <div style={{ background: TOKENS.ink }}>
        <div
          style={{
            maxWidth: 780,
            margin: "0 auto",
            padding: "48px 20px",
            textAlign: "center",
          }}
        >
          <ClipboardCheck size={26} color="#fff" style={{ marginBottom: 14 }} />
          <h2 style={{ fontSize: 22, fontWeight: 600, color: "#fff", margin: "0 0 20px" }}>
            Anticipez vos obligations vaccinales des aujourd'hui.
          </h2>
          <button
            onClick={onGetStarted}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: TOKENS.brand,
              color: "#fff",
              border: "none",
              borderRadius: 7,
              padding: "12px 24px",
              fontFamily: "'Inter', sans-serif",
              fontSize: 14.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Créer mon compte <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Footer */}
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "24px 20px", textAlign: "center" }}>
        <span style={{ fontSize: 12, color: TOKENS.inkSoft }}>
          Confia — Suivi de conformité vaccinale pour le secteur médico-social
        </span>
        <div style={{ display: "flex", justifyContent: "center", gap: 18, marginTop: 10, flexWrap: "wrap" }}>
          <button
            onClick={onNavigateBlog}
            style={{ background: "none", border: "none", padding: 0, color: TOKENS.inkSoft, fontSize: 11.5, textDecoration: "underline", cursor: "pointer" }}
          >
            Blog
          </button>
          <button
            onClick={() => setLegalModal("mentions")}
            style={{ background: "none", border: "none", padding: 0, color: TOKENS.inkSoft, fontSize: 11.5, textDecoration: "underline", cursor: "pointer" }}
          >
            Mentions legales
          </button>
          <button
            onClick={() => setLegalModal("confidentialite")}
            style={{ background: "none", border: "none", padding: 0, color: TOKENS.inkSoft, fontSize: 11.5, textDecoration: "underline", cursor: "pointer" }}
          >
            Politique de confidentialite
          </button>
        </div>
      </div>

      {legalModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "24px 16px",
          }}
          onClick={() => setLegalModal(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 10,
              padding: "28px 30px",
              maxWidth: 560,
              maxHeight: "80vh",
              overflowY: "auto",
              boxShadow: "0 12px 40px rgba(15,23,42,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
                {legalModal === "mentions" ? "Mentions legales" : "Politique de confidentialite"}
              </h2>
              <button onClick={() => setLegalModal(null)} style={{ background: "none", border: "none", cursor: "pointer", color: TOKENS.inkSoft }}>
                <X size={18} />
              </button>
            </div>

            {legalModal === "mentions" ? (
              <div style={{ fontSize: 13, color: TOKENS.inkSoft, lineHeight: 1.7 }}>
                <p style={{ background: TOKENS.warnBg, color: TOKENS.warn, padding: "10px 12px", borderRadius: 6, fontSize: 12.5, marginTop: 0 }}>
                  Ces mentions légales sont en cours de finalisation, dans l'attente de l'attribution du
                  numéro SIRET de l'entreprise. Elles seront complétées dès réception.
                </p>
                <p><strong>Éditeur du site</strong><br />Confia — [Forme juridique et SIRET à compléter]<br />[Adresse du siège social à compléter]</p>
                <p><strong>Directeur de la publication</strong><br />[Nom à compléter]</p>
                <p><strong>Hébergement</strong><br />Le site est hébergé par Vercel Inc. L'application et les données sont hébergées sur une infrastructure cloud sécurisée, en cours de migration vers un hébergement certifié HDS (Hébergement de Données de Santé).</p>
                <p><strong>Contact</strong><br />Pour toute question, écrivez à{" "}
                  <a href="mailto:contact@confia-app.fr" style={{ color: TOKENS.brand }}>contact@confia-app.fr</a>.
                </p>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: TOKENS.inkSoft, lineHeight: 1.7 }}>
                <p style={{ marginTop: 0 }}>
                  Confia respecte les principes du Règlement Général sur la Protection des Données (RGPD).
                </p>
                <p><strong>Données collectées</strong><br />Nom, fonction et statut vaccinal des salariés suivis par votre organisation, ainsi que les justificatifs que vous choisissez d'y associer. Ces données ne sont collectées que pour assurer le suivi de conformité réglementaire de votre établissement.</p>
                <p><strong>Finalité</strong><br />Le suivi de l'obligation vaccinale du personnel médico-social, l'envoi d'alertes automatiques, et la génération de rapports de conformité.</p>
                <p><strong>Confidentialité</strong><br />Chaque organisation n'a accès qu'à ses propres données. Les résumés envoyés par email sont anonymisés (aucun nom de salarié n'y figure).</p>
                <p><strong>Conservation</strong><br />Les données sont conservées pour la durée nécessaire au suivi de conformité réglementaire, et supprimées sur demande.</p>
                <p><strong>Vos droits</strong><br />Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et de suppression de vos données. Pour l'exercer, écrivez à{" "}
                  <a href="mailto:contact@confia-app.fr" style={{ color: TOKENS.brand }}>contact@confia-app.fr</a>.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Contenu des articles du blog, sous forme de blocs structures (titre,
// paragraphe, liste...) plutot que du markdown brut : rendu par
// renderBlogSections plus bas, dans le meme style visuel (TOKENS) que le
// reste de l'application, sans dependance a une librairie externe.
const BLOG_POSTS = [
  {
    slug: "obligation-vaccinale-ehpad-2026",
    title: "Obligation vaccinale en EHPAD 2026 : ce que dit vraiment la loi",
    metaDescription:
      "Grippe, rougeole : ce que change la loi en 2026 pour le personnel soignant en EHPAD, et comment rester conforme sans y passer vos soirées.",
    publishedLabel: "Janvier 2026",
    excerpt:
      "Article L.3111-4, LFSS 2026, obligations pour le personnel et les résidents : le point clair sur une situation qui prête souvent à confusion.",
    sections: [
      {
        type: "p",
        text: "Depuis le 1er janvier 2026, une nouvelle obligation légale s'impose au personnel soignant des EHPAD. Entre le texte du code de la santé publique, les débats parlementaires autour du budget de la Sécurité sociale et les informations parfois contradictoires qui circulent, il n'est pas toujours simple de savoir précisément ce qui est exigé, pour qui, et depuis quand. Voici un point clair sur la situation actuelle.",
      },
      { type: "h2", text: "Ce qui est en vigueur depuis le 1er janvier 2026" },
      {
        type: "p",
        text: "L'article L.3111-4 du code de la santé publique impose désormais la vaccination contre la grippe au personnel exerçant dans un établissement hébergeant des personnes âgées, dès lors que son activité l'expose ou expose les résidents à un risque de contamination. Concrètement, cela concerne l'ensemble du personnel soignant en contact avec les résidents : infirmiers, aides-soignants, mais aussi, selon les postes, une partie du personnel paramédical.",
      },
      {
        type: "p",
        text: "Ce n'est pas une mesure isolée : elle s'inscrit dans la même logique que les obligations vaccinales déjà connues des soignants contre l'hépatite B, la diphtérie, le tétanos ou la poliomyélite.",
      },
      { type: "h2", text: "Et du côté des résidents ?" },
      {
        type: "p",
        text: "C'est ici que la situation demande un peu plus de nuance. La loi de financement de la Sécurité sociale (LFSS) pour 2026 a ouvert la possibilité d'étendre une obligation vaccinale contre la grippe aux résidents eux-mêmes, sauf contre-indication médicale, pendant la période épidémique. Le sujet a fait l'objet d'allers-retours entre l'Assemblée nationale et le Sénat, et son application concrète reste conditionnée à une recommandation de la Haute Autorité de Santé (HAS), attendue au premier semestre 2026.",
      },
      {
        type: "p",
        text: "Autrement dit : pour le personnel, l'obligation est effective. Pour les résidents, les textes réglementaires d'application restent à préciser. Un établissement sérieux a tout intérêt à suivre cette actualité de près, car les délais d'adaptation, une fois le texte définitif publié, sont rarement généreux.",
      },
      {
        type: "p",
        text: "La LFSS 2026 introduit également une piste d'obligation d'immunisation contre la rougeole pour certaines catégories de personnels du secteur médico-social, avec les mêmes réserves de calendrier d'application.",
      },
      { type: "h2", text: "Ce que ça change concrètement pour un directeur d'établissement" },
      {
        type: "p",
        text: "Sur le papier, l'obligation existe. Dans la pratique, elle soulève trois questions très concrètes pour qui dirige un EHPAD :",
      },
      {
        type: "list",
        items: [
          "Comment prouver, à tout moment, que chaque membre du personnel est à jour ? Un contrôle ARS, un renouvellement d'agrément ou même une simple inspection interne peuvent demander cette preuve du jour au lendemain.",
          "Comment gérer les renouvellements et les échéances ? Une vaccination antigrippale se renouvelle chaque année, à des dates différentes selon les arrivées de personnel.",
          "Comment documenter les exceptions ? Contre-indications médicales, refus, justificatifs à archiver : chaque cas particulier doit être traçable, pas seulement mémorisé.",
        ],
      },
      { type: "h2", text: "Le risque du suivi manuel" },
      {
        type: "p",
        text: "Beaucoup d'établissements gèrent encore ce suivi via un tableur, complété au fil de l'eau, parfois par plusieurs personnes différentes selon les périodes. Le problème n'est pas la bonne volonté des équipes, mais la nature même de l'exercice : un tableau Excel ne prévient jamais personne quand une échéance approche, ne conserve pas d'historique fiable en cas de modification, et devient rapidement difficile à exploiter en cas de contrôle inopiné.",
      },
      {
        type: "p",
        text: "Or, en matière de conformité réglementaire, ce n'est généralement pas l'absence de vaccination qui pose problème le jour d'un contrôle — c'est l'incapacité à en produire la preuve rapidement et de façon organisée.",
      },
      { type: "h2", text: "Anticiper plutôt que subir" },
      {
        type: "p",
        text: "La bonne nouvelle, c'est que cette obligation, aussi contraignante soit-elle sur le papier, devient très gérable dès lors qu'elle est suivie avec le bon outil : un tableau de bord centralisé, des alertes automatiques avant chaque échéance, et un export en un clic pour tout contrôle ou renouvellement d'agrément.",
      },
      {
        type: "cta",
        title: "Confia centralise ce suivi pour vous",
        text: "Tableau de bord unique, alertes automatiques et export de rapport en un clic, pensé spécifiquement pour la conformité vaccinale en EHPAD.",
      },
      {
        type: "disclaimer",
        text: "Cet article a une visée d'information générale et ne constitue pas un conseil juridique. Pour toute question sur l'application de ces obligations dans votre établissement, il est recommandé de se référer aux textes officiels (Légifrance) et, le cas échéant, de consulter un professionnel du droit ou votre ARS de rattachement.",
      },
    ],
  },
  {
    slug: "controle-conformite-vaccinale-ehpad",
    title: "Contrôle de conformité vaccinale en EHPAD : le guide pratique",
    metaDescription:
      "ARS, renouvellement d'agrément, inspection : comment préparer et réussir un contrôle de conformité vaccinale en EHPAD sans stress.",
    publishedLabel: "Janvier 2026",
    excerpt:
      "Ce qu'un contrôle vérifie réellement, les trois failles les plus courantes, et une checklist simple à suivre avant toute inspection.",
    sections: [
      {
        type: "p",
        text: "Un contrôle de l'ARS, une visite dans le cadre du renouvellement d'un agrément, un audit qualité interne : dans un EHPAD, la question de la conformité vaccinale du personnel peut être posée à peu près n'importe quel jour de l'année, souvent avec peu de préavis. Voici comment s'y préparer sereinement, sans y consacrer des heures de recherche dans des dossiers papier ou des fichiers Excel dispersés.",
      },
      { type: "h2", text: "Ce qu'un contrôle vérifie réellement" },
      {
        type: "p",
        text: "Un contrôle de conformité vaccinale ne se limite pas à vérifier que la vaccination a eu lieu. Dans la grande majorité des cas, ce qui est demandé, c'est la capacité de l'établissement à produire une preuve claire et à jour, pour chaque membre du personnel concerné :",
      },
      {
        type: "list",
        items: [
          "La date de la dernière vaccination contre la grippe (obligatoire depuis le 1er janvier 2026 pour le personnel soignant, en application de l'article L.3111-4 du code de la santé publique)",
          "Les justificatifs correspondants, classés et facilement accessibles",
          "Le traitement des cas particuliers : contre-indications médicales documentées, arrivées récentes de personnel, changements de poste",
          "La cohérence de l'ensemble avec l'effectif réel de l'établissement au moment du contrôle",
        ],
      },
      {
        type: "p",
        text: "Un contrôleur ne cherche pas à piéger un établissement. Mais un dossier incomplet, une information introuvable sur le moment, ou un tableau qui ne reflète pas la réalité actuelle du personnel, transforment une formalité en un moment de stress évitable.",
      },
      { type: "h2", text: "Les trois failles les plus courantes" },
      {
        type: "list",
        items: [
          "Le suivi éclaté entre plusieurs fichiers ou plusieurs personnes. Quand le tableau de suivi vaccinal a été mis à jour tour à tour par la direction, l'IDEC, puis un remplaçant pendant un congé, les versions finissent par diverger.",
          "L'absence d'historique. Un tableur classique écrase l'ancienne valeur dès qu'elle est modifiée. Si une question porte sur l'évolution de la conformité sur les douze derniers mois, l'information a souvent disparu.",
          "Les échéances qui passent inaperçues. Sans alerte automatique, il est fréquent qu'une échéance soit repérée après coup — parfois seulement au moment du contrôle lui-même.",
        ],
      },
      { type: "h2", text: "Comment transformer un contrôle en formalité rapide" },
      {
        type: "p",
        text: "La différence entre un contrôle vécu dans la sérénité et un contrôle vécu dans le stress tient rarement à la réalité du terrain — la plupart des équipes soignantes respectent bien leurs obligations. Elle tient presque toujours à l'organisation du suivi. Trois réflexes changent tout :",
      },
      {
        type: "list",
        items: [
          "Centraliser, à un seul endroit. Un tableau de bord unique, à jour en temps réel, évite les versions multiples et les incohérences.",
          "Automatiser les alertes. Être prévenu suffisamment à l'avance qu'une échéance approche permet d'agir avant qu'elle ne devienne un problème.",
          "Pouvoir exporter en un clic. Le jour où un rapport est demandé, la rapidité de la réponse en dit souvent plus long sur le sérieux de l'établissement que le contenu du rapport lui-même.",
        ],
      },
      { type: "h2", text: "Une checklist simple avant tout contrôle" },
      {
        type: "list",
        items: [
          "Le statut vaccinal de chaque membre du personnel soignant est-il à jour dans un seul et même endroit ?",
          "Les justificatifs (certificats, attestations, contre-indications) sont-ils classés et rapidement accessibles ?",
          "Existe-t-il un historique des changements de statut, en cas de question sur une période antérieure ?",
          "Un rapport de synthèse peut-il être généré en quelques minutes, sans reconstitution manuelle ?",
        ],
      },
      {
        type: "p",
        text: "Si l'une de ces réponses est non, c'est le signe qu'il est temps de structurer le suivi plutôt que de continuer à le gérer au fil de l'eau.",
      },
      {
        type: "cta",
        title: "Confia prépare vos contrôles à l'avance",
        text: "Tableau de bord de conformité vaccinale pensé pour les EHPAD, avec alertes automatiques et export de rapport en un clic, prêt pour tout contrôle ou renouvellement d'agrément.",
      },
      {
        type: "disclaimer",
        text: "Cet article a une visée d'information générale et ne constitue pas un conseil juridique. Pour toute question sur les modalités précises d'un contrôle dans votre établissement, il est recommandé de vous rapprocher de votre ARS de rattachement.",
      },
    ],
  },
];

function BlogNav({ onNavigateHome, onNavigateBlog, onLogin }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "18px 4px",
        maxWidth: 780,
        margin: "0 auto",
      }}
    >
      <button
        onClick={onNavigateHome}
        style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 7,
            background: TOKENS.paperDim,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <LogoMark size={18} />
        </div>
        <span style={{ fontSize: 17, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: TOKENS.ink }}>
          Confia
        </span>
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <button
          onClick={onNavigateBlog}
          style={{ background: "none", border: "none", padding: 0, fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600, color: TOKENS.brand, cursor: "pointer" }}
        >
          Blog
        </button>
        <button
          onClick={onLogin}
          style={{
            background: "none",
            border: "1px solid " + TOKENS.line,
            borderRadius: 6,
            padding: "8px 16px",
            fontFamily: "'Inter', sans-serif",
            fontSize: 13,
            fontWeight: 500,
            color: TOKENS.ink,
            cursor: "pointer",
          }}
        >
          Se connecter
        </button>
      </div>
    </div>
  );
}

function BlogListPage({ onBack, onSelectPost, onGetStarted }) {
  useEffect(() => {
    document.title = "Blog — Confia";
  }, []);

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: TOKENS.ink }}>
      <BlogNav onNavigateHome={onBack} onNavigateBlog={() => {}} onLogin={onGetStarted} />
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "20px 20px 60px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: "20px 0 8px" }}>Blog Confia</h1>
        <p style={{ fontSize: 14, color: TOKENS.inkSoft, margin: "0 0 32px", lineHeight: 1.6 }}>
          Obligations réglementaires, conformité, bonnes pratiques : de quoi anticiper sereinement le suivi
          vaccinal de votre personnel soignant.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {BLOG_POSTS.map((post) => (
            <button
              key={post.slug}
              onClick={() => onSelectPost(post.slug)}
              style={{
                textAlign: "left",
                background: "#fff",
                border: "1px solid " + TOKENS.line,
                boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
                borderRadius: 10,
                padding: "22px 24px",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 11.5, color: TOKENS.inkSoft, marginBottom: 6, fontFamily: "'IBM Plex Mono', monospace" }}>
                {post.publishedLabel}
              </div>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: TOKENS.ink, margin: "0 0 8px" }}>{post.title}</h2>
              <p style={{ fontSize: 13.5, color: TOKENS.inkSoft, lineHeight: 1.6, margin: "0 0 10px" }}>{post.excerpt}</p>
              <span style={{ fontSize: 13, fontWeight: 600, color: TOKENS.brand }}>Lire l'article →</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Rendu des blocs structures d'un article (voir BLOG_POSTS). Un bloc de
// type "cta" met en avant Confia au fil de la lecture, sans etre une pub
// intrusive ; le disclaimer juridique est toujours affiche en fin d'article.
function renderBlogSections(sections, onGetStarted) {
  return sections.map((block, idx) => {
    if (block.type === "h2") {
      return (
        <h2 key={idx} style={{ fontSize: 19, fontWeight: 600, color: TOKENS.ink, margin: "28px 0 10px" }}>
          {block.text}
        </h2>
      );
    }
    if (block.type === "p") {
      return (
        <p key={idx} style={{ fontSize: 14.5, color: TOKENS.inkSoft, lineHeight: 1.75, margin: "0 0 14px" }}>
          {block.text}
        </p>
      );
    }
    if (block.type === "list") {
      return (
        <ul key={idx} style={{ margin: "0 0 14px", padding: "0 0 0 20px", fontSize: 14.5, color: TOKENS.inkSoft, lineHeight: 1.75 }}>
          {block.items.map((item, i) => (
            <li key={i} style={{ marginBottom: 6 }}>{item}</li>
          ))}
        </ul>
      );
    }
    if (block.type === "cta") {
      return (
        <div
          key={idx}
          style={{
            background: TOKENS.okBg,
            border: "1px solid " + TOKENS.ok + "33",
            borderRadius: 10,
            padding: "20px 22px",
            margin: "24px 0",
          }}
        >
          <h3 style={{ fontSize: 15.5, fontWeight: 600, color: TOKENS.ink, margin: "0 0 6px" }}>{block.title}</h3>
          <p style={{ fontSize: 13.5, color: TOKENS.inkSoft, lineHeight: 1.6, margin: "0 0 14px" }}>{block.text}</p>
          <button
            onClick={onGetStarted}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: TOKENS.brand,
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "9px 16px",
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Essayer gratuitement 14 jours <ChevronRight size={14} />
          </button>
        </div>
      );
    }
    if (block.type === "disclaimer") {
      return (
        <p key={idx} style={{ fontSize: 12, color: TOKENS.inkSoft, fontStyle: "italic", lineHeight: 1.6, margin: "24px 0 0", borderTop: "1px solid " + TOKENS.line, paddingTop: 16 }}>
          {block.text}
        </p>
      );
    }
    return null;
  });
}

function BlogPostPage({ post, onBackToBlog, onBackToLanding, onGetStarted }) {
  useEffect(() => {
    if (post) document.title = post.title + " — Confia";
  }, [post]);

  if (!post) return null;

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: TOKENS.ink }}>
      <BlogNav onNavigateHome={onBackToLanding} onNavigateBlog={onBackToBlog} onLogin={onGetStarted} />
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "20px 20px 60px" }}>
        <button
          onClick={onBackToBlog}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            marginBottom: 18,
            color: TOKENS.inkSoft,
            fontFamily: "'Inter', sans-serif",
            fontSize: 12.5,
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          ← Retour au blog
        </button>
        <div style={{ fontSize: 11.5, color: TOKENS.inkSoft, marginBottom: 8, fontFamily: "'IBM Plex Mono', monospace" }}>
          {post.publishedLabel}
        </div>
        <h1 style={{ fontSize: 27, fontWeight: 700, lineHeight: 1.3, margin: "0 0 22px" }}>{post.title}</h1>
        {renderBlogSections(post.sections, onGetStarted)}
      </div>
    </div>
  );
}

function LoginScreen({ onLogin, initialMode, onBackToLanding }) {
  const [mode, setMode] = useState(initialMode || "login"); // "login", "signup" ou "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  const [resendConfirmationMessage, setResendConfirmationMessage] = useState(null);

  const handleResendConfirmation = async () => {
    if (!email.trim()) {
      setResendConfirmationMessage({ type: "error", text: "Saisissez d'abord votre email ci-dessus." });
      return;
    }
    setResendingConfirmation(true);
    setResendConfirmationMessage(null);
    try {
      await resendConfirmationEmail(email.trim());
      setResendConfirmationMessage({
        type: "ok",
        text: "Si un compte existe avec cet email et n'est pas encore confirme, un nouvel email vient d'être envoye.",
      });
    } catch (err) {
      setResendConfirmationMessage({ type: "error", text: err.message || "Erreur lors de l'envoi" });
    } finally {
      setResendingConfirmation(false);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 6,
    border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
    fontFamily: "'Inter', sans-serif",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    marginBottom: 12,
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        await signUp(email, password, orgName.trim());
        setInfo("Compte créé. Vérifiez votre email pour confirmer, puis connectez-vous.");
        setMode("login");
      } else if (mode === "forgot") {
        await requestPasswordReset(email.trim());
        setInfo("Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.");
      } else {
        const session = await signIn(email, password);
        onLogin(session);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "90vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <form
        onSubmit={submit}
        style={{
          background: "#fff",
          border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
          borderRadius: 10,
          padding: 32,
          width: 360,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 7,
              background: TOKENS.paperDim,
              border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LogoMark size={20} />
          </div>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 19, fontWeight: 700, color: TOKENS.ink, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Confia
          </span>
        </div>

        {onBackToLanding && (
          <button
            type="button"
            onClick={onBackToLanding}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              marginBottom: 14,
              color: TOKENS.inkSoft,
              fontFamily: "'Inter', sans-serif",
              fontSize: 12.5,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            ← Retour à l'accueil
          </button>
        )}

        <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 600, color: TOKENS.ink, margin: "0 0 16px" }}>
          {mode === "login" ? "Connexion" : mode === "signup" ? "Créer un compte" : "Mot de passe oublié"}
        </h2>

        {mode === "signup" && (
          <input
            type="text"
            placeholder="Nom de votre établissement ou organisation"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            style={inputStyle}
            required
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
          required
        />
        {mode !== "forgot" && (
          <>
            <PasswordInput
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              required
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
            {mode === "signup" && (
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, color: TOKENS.inkSoft, marginTop: -6, marginBottom: 12 }}>
                Au moins 6 caractères.
              </div>
            )}
          </>
        )}

        {error && (
          <div style={{ color: TOKENS.danger, fontSize: 12.5, marginBottom: 12 }}>{error}</div>
        )}
        {info && (
          <div style={{ color: TOKENS.ok, fontSize: 12.5, marginBottom: 12 }}>{info}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: 6,
            border: "none",
            background: TOKENS.brand,
            color: "#fff",
            fontFamily: "'Inter', sans-serif",
            fontSize: 13.5,
            fontWeight: 500,
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading
            ? "Patientez..."
            : mode === "login"
            ? "Se connecter"
            : mode === "signup"
            ? "Créer mon compte"
            : "Envoyer le lien de réinitialisation"}
        </button>

        {mode === "login" && (
          <button
            type="button"
            onClick={() => {
              setMode("forgot");
              setError(null);
              setInfo(null);
            }}
            style={{
              width: "100%",
              padding: "8px",
              marginTop: 6,
              border: "none",
              background: "none",
              color: TOKENS.inkSoft,
              fontFamily: "'Inter', sans-serif",
              fontSize: 12.5,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Mot de passe oublié ?
          </button>
        )}

        {mode === "login" && (
          <button
            type="button"
            onClick={handleResendConfirmation}
            disabled={resendingConfirmation}
            style={{
              width: "100%",
              padding: "4px",
              marginTop: 2,
              border: "none",
              background: "none",
              color: TOKENS.inkSoft,
              fontFamily: "'Inter', sans-serif",
              fontSize: 12.5,
              cursor: resendingConfirmation ? "default" : "pointer",
              textDecoration: "underline",
              opacity: resendingConfirmation ? 0.6 : 1,
            }}
          >
            {resendingConfirmation ? "Envoi..." : "Email de confirmation non reçu ? Renvoyer"}
          </button>
        )}
        {resendConfirmationMessage && (
          <div
            style={{
              fontSize: 11.5,
              color: resendConfirmationMessage.type === "ok" ? TOKENS.ok : TOKENS.danger,
              textAlign: "center",
              marginTop: 4,
              lineHeight: 1.5,
            }}
          >
            {resendConfirmationMessage.text}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signup" ? "login" : mode === "forgot" ? "login" : "signup");
            setError(null);
            setInfo(null);
          }}
          style={{
            width: "100%",
            padding: "8px",
            marginTop: 4,
            border: "none",
            background: "none",
            color: TOKENS.inkSoft,
            fontFamily: "'Inter', sans-serif",
            fontSize: 12.5,
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          {mode === "login"
            ? "Pas encore de compte ? Créez-en un"
            : mode === "forgot"
            ? "Retour à la connexion"
            : "Déjà un compte ? Connectez-vous"}
        </button>
      </form>
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder, style, required, minLength, autoComplete }) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: "relative", marginBottom: style?.marginBottom ?? 12 }}>
      <input
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        style={{ ...style, marginBottom: 0, paddingRight: 38 }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        style={{
          position: "absolute",
          right: 10,
          top: "50%",
          transform: "translateY(-50%)",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: TOKENS.inkSoft,
          display: "flex",
          alignItems: "center",
        }}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function ResetPasswordScreen({ accessToken, onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 6,
    border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
    fontFamily: "'Inter', sans-serif",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    marginBottom: 12,
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      await updatePasswordWithToken(accessToken, password);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "90vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <form
        onSubmit={submit}
        style={{
          background: "#fff",
          border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
          borderRadius: 10,
          padding: 32,
          width: 360,
        }}
      >
        <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 600, color: TOKENS.ink, margin: "0 0 16px" }}>
          Choisir un nouveau mot de passe
        </h2>

        <PasswordInput
          placeholder="Nouveau mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
          required
          minLength={6}
          autoComplete="new-password"
        />
        <PasswordInput
          placeholder="Confirmer le mot de passe"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          style={inputStyle}
          required
          minLength={6}
          autoComplete="new-password"
        />

        {error && <div style={{ color: TOKENS.danger, fontSize: 12.5, marginBottom: 12 }}>{error}</div>}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: 6,
            border: "none",
            background: TOKENS.brand,
            color: "#fff",
            fontFamily: "'Inter', sans-serif",
            fontSize: 13.5,
            fontWeight: 500,
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Patientez..." : "Enregistrer le nouveau mot de passe"}
        </button>
      </form>
    </div>
  );
}

export default function ConfiaPrototype() {
  const [session, setSession] = useState(() => getStoredSession());
  // Etat de navigation publique (avant connexion) : "landing" | "login" |
  // "blog" | "blogPost". Initialise depuis l'URL du navigateur pour que les
  // liens directs /blog et /blog/<slug> fonctionnent (partage, moteurs de
  // recherche), et synchronise ensuite via window.history.pushState.
  const [publicView, setPublicView] = useState(() => {
    const path = window.location.pathname;
    if (path.startsWith("/blog/")) return "blogPost";
    if (path === "/blog") return "blog";
    return "landing";
  });
  const [activeBlogSlug, setActiveBlogSlug] = useState(() => {
    const path = window.location.pathname;
    if (path.startsWith("/blog/")) return path.replace("/blog/", "").split("/")[0];
    return null;
  });
  const [authInitialMode, setAuthInitialMode] = useState("login");
  const [view, setView] = useState("dashboard");
  const [staff, setStaff] = useState([]);
  const [establishments, setEstablishments] = useState([]);
  const [organizationId, setOrganizationId] = useState(null);
  const [organizationName, setOrganizationName] = useState(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState("inactive");
  const [subscriptionPlan, setSubscriptionPlan] = useState(null);
  const [subscriptionPeriod, setSubscriptionPeriod] = useState(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState(null);
  const [stripeCustomerId, setStripeCustomerId] = useState(null);
  const [alertThresholdDays, setAlertThresholdDays] = useState(45);
  const [myDisplayName, setMyDisplayName] = useState(null);
  const [myAvatarUrl, setMyAvatarUrl] = useState(null);
  const [trialEndsAt, setTrialEndsAt] = useState(null);
  // Ferme le bandeau d'essai pour la session en cours uniquement : reste en
  // memoire tant que l'onglet est ouvert, mais revient automatiquement a la
  // prochaine connexion ou au prochain rechargement de la page (l'etat
  // repart a false a chaque nouveau chargement de l'application).
  const [trialBannerDismissed, setTrialBannerDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recoveryToken] = useState(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      const params = new URLSearchParams(hash.slice(1));
      return params.get("access_token");
    }
    return null;
  });

  // Navigation publique (avant connexion) : met a jour l'URL affichee dans
  // le navigateur en plus de l'etat React, pour que l'adresse /blog/<slug>
  // soit partageable et reste correcte si l'utilisateur rafraichit la page.
  const goToLanding = () => {
    window.history.pushState(null, "", "/");
    setPublicView("landing");
  };
  const goToLoginScreen = (mode) => {
    setAuthInitialMode(mode);
    setPublicView("login");
  };
  const goToBlogList = () => {
    window.history.pushState(null, "", "/blog");
    setPublicView("blog");
  };
  const goToBlogPost = (slug) => {
    window.history.pushState(null, "", "/blog/" + slug);
    setActiveBlogSlug(slug);
    setPublicView("blogPost");
  };

  // Garde la navigation coherente avec les boutons precedent/suivant du
  // navigateur (l'utilisateur revient sur /blog apres avoir lu un article,
  // par exemple).
  useEffect(() => {
    function handlePopState() {
      const path = window.location.pathname;
      if (path.startsWith("/blog/")) {
        setActiveBlogSlug(path.replace("/blog/", "").split("/")[0]);
        setPublicView("blogPost");
      } else if (path === "/blog") {
        setPublicView("blog");
      } else {
        setPublicView("landing");
      }
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Detection simple d'un ecran mobile (moins de 768px de large), remise a
  // jour si l'utilisateur tourne son telephone ou redimensionne la fenetre.
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const token = session?.access_token;

  const handleLogout = () => {
    clearSession();
    setSession(null);
    setStaff([]);
    setEstablishments([]);
    setError(null);
  };

  const isSessionExpired = (err) => {
    const msg = (err.message || "").toLowerCase();
    return msg.includes("401") || msg.includes("jwt expired") || msg.includes("expired");
  };

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [estabRows, staffRows, org] = await Promise.all([
          fetchEstablishments(token),
          fetchStaff(token),
          fetchMyOrganization(token),
        ]);
        if (!cancelled) {
          setEstablishments(estabRows);
          setStaff(staffRows.map((r) => mapPersonRow(r, org.alertThresholdDays)));
          setOrganizationId(org.id);
          setOrganizationName(org.name);
          setSubscriptionStatus(org.subscriptionStatus);
          setSubscriptionPlan(org.subscriptionPlan);
          setSubscriptionPeriod(org.subscriptionPeriod);
          setCurrentPeriodEnd(org.currentPeriodEnd);
          setStripeCustomerId(org.stripeCustomerId);
          setAlertThresholdDays(org.alertThresholdDays);
          setTrialEndsAt(org.trialEndsAt);

          // Chargee separement car elle depend de l'id d'organisation qui
          // vient d'etre recupere : ne bloque pas le reste de l'affichage
          // si elle echoue (l'en-tete retombe simplement sur les initiales
          // de l'email).
          if (org.id && session?.user?.id) {
            fetchOwnMembership(org.id, session.user.id, token)
              .then((membership) => {
                if (!cancelled && membership) {
                  setMyDisplayName(membership.display_name || null);
                  setMyAvatarUrl(membership.avatar_url || null);
                }
              })
              .catch((err) => console.error("Erreur de chargement du profil personnel:", err));
          }
        }
      } catch (err) {
        console.error("Erreur de chargement Supabase:", err);
        if (!cancelled) {
          if (isSessionExpired(err)) {
            handleLogout();
          } else {
            setError("Erreur technique : " + (err.message || String(err)));
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Recharge la liste complete du personnel (personnes + suivis vaccinaux
  // imbriques) depuis Supabase. Utilise apres tout ajout/modification, plus
  // simple et plus sur que de reconstruire l'etat localement a la main.
  const reloadStaff = async () => {
    try {
      const staffRows = await fetchStaff(token);
      setStaff(staffRows.map((r) => mapPersonRow(r, alertThresholdDays)));
    } catch (err) {
      console.error("Erreur de rechargement du personnel:", err);
      if (isSessionExpired(err)) {
        handleLogout();
      } else {
        setError("Echec du rechargement du personnel. Reessayez.");
      }
    }
  };

  const handleDeletePerson = async (id) => {
    try {
      await deleteStaffPerson(id, token);
      setStaff((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error("Erreur de suppression Supabase:", err);
      if (isSessionExpired(err)) {
        handleLogout();
      } else {
        setError("Echec de la suppression du salarié. Reessayez.");
      }
    }
  };

  const handleLogin = (newSession) => {
    saveSession(newSession);
    setSession(newSession);
  };

  // Apres un changement du seuil d'alerte dans Parametres, on recharge le
  // personnel et on recalcule tous les statuts avec la nouvelle valeur (le
  // state alertThresholdDays n'est pas encore a jour au moment de l'appel,
  // donc on utilise directement la valeur recue plutot que le state).
  const handleUpdateAlertThreshold = async (newDays) => {
    setAlertThresholdDays(newDays);
    try {
      const staffRows = await fetchStaff(token);
      setStaff(staffRows.map((r) => mapPersonRow(r, newDays)));
    } catch (err) {
      console.error("Erreur de rechargement après changement de seuil:", err);
    }
  };

  // Met a jour l'affichage immediat (en-tete, etc.) apres un changement de
  // nom affiche ou de photo de profil dans Parametres, sans devoir recharger
  // toute la page.
  const handleUpdateProfile = (patch) => {
    if (patch.displayName !== undefined) setMyDisplayName(patch.displayName);
    if (patch.avatarUrl !== undefined) setMyAvatarUrl(patch.avatarUrl);
  };

  if (recoveryToken) {
    return (
      <ResetPasswordScreen
        accessToken={recoveryToken}
        onDone={() => {
          window.history.replaceState(null, "", window.location.pathname);
          window.location.reload();
        }}
      />
    );
  }

  if (!session) {
    if (publicView === "blog") {
      return (
        <BlogListPage
          onBack={goToLanding}
          onSelectPost={goToBlogPost}
          onGetStarted={() => goToLoginScreen("signup")}
        />
      );
    }
    if (publicView === "blogPost") {
      const post = BLOG_POSTS.find((p) => p.slug === activeBlogSlug) || BLOG_POSTS[0];
      return (
        <BlogPostPage
          post={post}
          onBackToBlog={goToBlogList}
          onBackToLanding={goToLanding}
          onGetStarted={() => goToLoginScreen("signup")}
        />
      );
    }
    if (publicView === "landing") {
      return (
        <LandingPage
          onGetStarted={() => goToLoginScreen("signup")}
          onLogin={() => goToLoginScreen("login")}
          onNavigateBlog={goToBlogList}
        />
      );
    }
    return (
      <LoginScreen
        onLogin={handleLogin}
        initialMode={authInitialMode}
        onBackToLanding={goToLanding}
      />
    );
  }

  const titles = {
    dashboard: "Tableau de bord",
    staff: "Salariés",
    alerts: "Alertes",
    reports: "Rapports",
    abonnement: "Abonnement",
    settings: "Paramètres",
  };

  if (loading) {
    return (
      <div style={{ fontFamily: "'Inter', sans-serif" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "90vh",
            background: TOKENS.paper,
            borderRadius: 10,
            border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
            gap: 10,
            color: TOKENS.inkSoft,
            fontSize: 13.5,
          }}
        >
          <Loader2 size={16} className="animate-spin" />
          Chargement des données...
        </div>
      </div>
    );
  }

  // Calcul de l'etat de l'essai gratuit. isTrialActive est faux si aucune
  // date n'est encore chargee (evite un flash d'acces refuse pendant le
  // court instant ou trialEndsAt vaut encore null au tout premier rendu).
  const trialEndsAtDate = trialEndsAt ? new Date(trialEndsAt) : null;
  const isTrialActive = trialEndsAtDate ? trialEndsAtDate.getTime() > Date.now() : false;
  const trialDaysLeft = trialEndsAtDate
    ? Math.max(0, Math.ceil((trialEndsAtDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;
  const hasAccess = subscriptionStatus === "active" || isTrialActive;

  // Une fois l'essai gratuit termine et sans abonnement actif, on bloque
  // completement l'acces aux fonctionnalites : seule la page d'abonnement
  // (reutilisee telle quelle) reste accessible, pour forcer le choix d'une
  // offre avant de continuer.
  if (!hasAccess) {
    return (
      <div style={{ fontFamily: "'Inter', sans-serif" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: TOKENS.paperDim,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <LogoMark size={17} />
              </div>
              <span style={{ fontSize: 17, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Confia
              </span>
            </div>
            <button
              onClick={handleLogout}
              style={{
                padding: "7px 14px",
                borderRadius: 6,
                border: "1px solid " + TOKENS.line,
                background: "#fff",
                color: TOKENS.inkSoft,
                fontFamily: "'Inter', sans-serif",
                fontSize: 12.5,
                cursor: "pointer",
              }}
            >
              Deconnexion
            </button>
          </div>
          <div
            style={{
              background: "#fff",
              border: "1px solid " + TOKENS.line,
              boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
              borderRadius: 8,
              padding: "28px 30px",
              textAlign: "center",
              marginBottom: 24,
            }}
          >
            <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 19, fontWeight: 600, color: TOKENS.ink, margin: "0 0 8px" }}>
              Votre essai gratuit est terminé
            </h2>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, color: TOKENS.inkSoft, margin: 0 }}>
              Choisissez une offre ci-dessous pour continuer à utiliser Confia sans interruption. Vos données
              sont conservées.
            </p>
          </div>
          <AbonnementView
            token={token}
            organizationId={organizationId}
            establishments={establishments}
            staffCount={staff.length}
            currentUserEmail={session?.user?.email}
            subscriptionStatus={subscriptionStatus}
            subscriptionPlan={subscriptionPlan}
            subscriptionPeriod={subscriptionPeriod}
            currentPeriodEnd={currentPeriodEnd}
            stripeCustomerId={stripeCustomerId}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      <div
        style={{
          display: "flex",
          minHeight: "90vh",
          background: TOKENS.paper,
          borderRadius: 10,
          overflow: "hidden",
          border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
        }}
      >
        <Sidebar
          view={view}
          setView={setView}
          establishmentCount={establishments.length}
          isMobile={isMobile}
          open={sidebarOpen}
          onNavigate={() => setSidebarOpen(false)}
        />
        <div style={{ flex: 1, padding: isMobile ? "16px 16px" : "24px 30px", overflow: "auto", width: "100%", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              {isMobile && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Ouvrir le menu"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 34,
                    height: 34,
                    borderRadius: 6,
                    border: "1px solid " + TOKENS.line,
                    background: "#fff",
                    color: TOKENS.ink,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  <Menu size={18} />
                </button>
              )}
              <h1
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: isMobile ? 18 : 22,
                  fontWeight: 600,
                  color: TOKENS.ink,
                  margin: 0,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {titles[view]}
              </h1>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontFamily: "'Inter', sans-serif",
                fontSize: 12.5,
                color: TOKENS.inkSoft,
              }}
            >
              {myAvatarUrl ? (
                <img
                  src={myAvatarUrl}
                  alt="Photo de profil"
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    objectFit: "cover",
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: TOKENS.brand,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {(myDisplayName || session?.user?.email || "?")
                    .split(/\s+/)
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
              )}
              {!isMobile && (organizationName || "Chargement...")}
              <button
                onClick={handleLogout}
                style={{
                  marginLeft: isMobile ? 0 : 12,
                  padding: "5px 10px",
                  borderRadius: 5,
                  border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
                  background: "#fff",
                  color: TOKENS.inkSoft,
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 11.5,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Deconnexion
              </button>
            </div>
          </div>
          {error && (
            <div
              style={{
                background: TOKENS.dangerBg,
                color: TOKENS.danger,
                border: "1px solid " + TOKENS.danger + "33",
                borderRadius: 6,
                padding: "10px 14px",
                fontFamily: "'Inter', sans-serif",
                fontSize: 12.5,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}
          {view === "dashboard" && <Dashboard staff={staff} establishments={establishments} setView={setView} subscriptionStatus={subscriptionStatus} organizationName={organizationName} trialDaysLeft={trialDaysLeft} bannerDismissed={trialBannerDismissed} onDismissBanner={() => setTrialBannerDismissed(true)} />}
          {view === "staff" && <StaffView staff={staff} onReload={reloadStaff} onDeletePerson={handleDeletePerson} establishments={establishments} token={token} alertThresholdDays={alertThresholdDays} setView={setView} />}
          {view === "alerts" && <AlertsView staff={staff} establishments={establishments} userEmail={session?.user?.email} />}
          {view === "reports" && <ReportsView staff={staff} establishments={establishments} organizationName={organizationName} />}
          {view === "abonnement" && (
            <AbonnementView
              token={token}
              organizationId={organizationId}
              establishments={establishments}
              staffCount={staff.length}
              currentUserEmail={session?.user?.email}
              subscriptionStatus={subscriptionStatus}
              subscriptionPlan={subscriptionPlan}
              subscriptionPeriod={subscriptionPeriod}
              currentPeriodEnd={currentPeriodEnd}
              stripeCustomerId={stripeCustomerId}
            />
          )}
          {view === "settings" && (
            <SettingsView
              establishments={establishments}
              token={token}
              organizationId={organizationId}
              organizationName={organizationName}
              currentUserEmail={session?.user?.email}
              currentUserId={session?.user?.id}
              avatarUrl={myAvatarUrl}
              onUpdateProfile={handleUpdateProfile}
              staffCount={staff.length}
              subscriptionStatus={subscriptionStatus}
              subscriptionPlan={subscriptionPlan}
              subscriptionPeriod={subscriptionPeriod}
              currentPeriodEnd={currentPeriodEnd}
              alertThresholdDays={alertThresholdDays}
              onUpdateAlertThreshold={handleUpdateAlertThreshold}
              onRenameOrganization={(newName) => setOrganizationName(newName)}
              onAddEstablishment={(created) => setEstablishments((prev) => [...prev, created])}
              onDeleteEstablishment={(id) => {
                setEstablishments((prev) => prev.filter((e) => e.id !== id));
                setStaff((prev) => prev.filter((s) => s.site !== id));
              }}
              onUpdate={(updated) =>
                setEstablishments((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
              }
              onDeleteAccount={handleLogout}
            />
          )}
        </div>
      </div>
    </div>
  );
}
