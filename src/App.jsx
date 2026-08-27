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
    SUPABASE_URL + "/rest/v1/staff?select=*,staff_vaccinations(*)",
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
  if (!res.ok) throw new Error("Erreur d'enregistrement du salarie");
  const data = await res.json();
  return data[0];
}

async function updateStaffPerson(id, updates, token) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/staff?id=eq." + id, {
    method: "PATCH",
    headers: { ...authHeaders(token), Prefer: "return=representation" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Erreur de mise a jour du salarie");
  const data = await res.json();
  return data[0];
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
    if (!res.ok) throw new Error("Erreur de mise a jour du suivi vaccinal");
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
  if (!res.ok) throw new Error(data.error || "Erreur lors de la verification du compte");
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
  const res = await fetch(SUPABASE_URL + "/rest/v1/organizations?id=eq." + organizationId, {
    method: "PATCH",
    headers: { ...authHeaders(token), Prefer: "return=representation" },
    body: JSON.stringify({ name: newName }),
  });
  if (!res.ok) throw new Error("Erreur de renommage");
  const data = await res.json();
  return data[0];
}

async function updateEstablishmentDetails(establishmentId, updates, token) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/establishments?id=eq." + establishmentId, {
    method: "PATCH",
    headers: { ...authHeaders(token), Prefer: "return=representation" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Erreur de mise a jour");
  const data = await res.json();
  return data[0];
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
    SUPABASE_URL + "/rest/v1/organization_members?select=organization_id,organizations(id,name)&limit=1",
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
  };
}

async function insertEstablishment(name, city, organizationId, token) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/establishments", {
    method: "POST",
    headers: { ...authHeaders(token), Prefer: "return=representation" },
    body: JSON.stringify({ name, city, organization_id: organizationId }),
  });
  if (!res.ok) throw new Error("Erreur de creation de l'etablissement");
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
  if (!signRes.ok) throw new Error("Echec de la generation du lien du document");
  const signData = await signRes.json();
  return SUPABASE_URL + "/storage/v1" + signData.signedURL;
}

// Calcule le statut/echeance de chaque suivi vaccinal d'une personne
function computePersonVaccinations(row) {
  return (row.staff_vaccinations || []).map((v) => {
    // Si aucune vraie date n'est enregistree, on ne devine jamais un statut
    // a partir d'une ancienne valeur saisie a la main : on l'affiche
    // clairement comme "Date manquante" plutot que de risquer d'afficher
    // "Non conforme" ou "A jour" de facon trompeuse.
    if (!v.last_vaccination_date) {
      return {
        id: v.id,
        vaccine: v.vaccine,
        lastVaccinationDate: "",
        documentUrl: v.document_url,
        status: "non_renseigne",
        updated: "-",
        next: "Date manquante",
      };
    }
    const computed = computeVaccineCompliance(v.vaccine, v.last_vaccination_date);
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
function mapPersonRow(row) {
  const vaccinations = computePersonVaccinations(row);
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    site: row.establishment_id,
    vaccinations,
    status: computeOverallStatus(vaccinations),
  };
}

const STATUS_META = {
  conforme: { label: "A jour", color: TOKENS.ok, bg: TOKENS.okBg },
  a_venir: { label: "Echeance proche", color: TOKENS.warn, bg: TOKENS.warnBg },
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
          conformite
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

function Sidebar({ view, setView, establishmentCount }) {
  return (
    <div
      style={{
        width: 224,
        flexShrink: 0,
        background: "#FFFFFF",
        borderRight: "1px solid " + TOKENS.line,
        padding: "20px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        minHeight: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 10px 22px" }}>
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
      <NavItem icon={LayoutDashboard} label="Tableau de bord" active={view === "dashboard"} onClick={() => setView("dashboard")} />
      <NavItem icon={Users} label="Salaries" active={view === "staff"} onClick={() => setView("staff")} />
      <NavItem icon={BellRing} label="Alertes" active={view === "alerts"} onClick={() => setView("alerts")} />
      <NavItem icon={FileDown} label="Rapports" active={view === "reports"} onClick={() => setView("reports")} />
      <NavItem icon={Settings} label="Parametres" active={view === "settings"} onClick={() => setView("settings")} />
      <div style={{ marginTop: 20, padding: "12px 10px 4px", borderTop: "1px solid " + TOKENS.line }}>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, color: TOKENS.inkSoft }}>
          {establishmentCount} etablissement{establishmentCount === 1 ? "" : "s"} suivi{establishmentCount === 1 ? "" : "s"}
        </div>
      </div>
    </div>
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

function Dashboard({ staff, establishments, setView }) {
  const total = staff.length;
  const conforme = staff.filter((s) => s.status === "conforme").length;
  const aVenir = staff.filter((s) => s.status === "a_venir").length;
  const nonConforme = staff.filter((s) => s.status === "non_conforme").length;
  const percent = total ? Math.round((conforme / total) * 100) : 0;

  return (
    <div>
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
            {nonConforme} salarie{nonConforme > 1 ? "s" : ""} sur {total} n'a pas de justificatif a jour (grippe ou rougeole). L'article L.3111-4 du code de la sante publique s'applique deja a votre personnel soignant.
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
            Voir les non-conformites <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
        <StatCard label="Salaries suivis" value={total} />
        <StatCard label="A jour" value={conforme} accent={TOKENS.ok} />
        <StatCard label="Echeance proche" value={aVenir} accent={TOKENS.warn} />
        <StatCard label="Non conformes" value={nonConforme} accent={TOKENS.danger} />
      </div>

      <div style={{ background: "#fff", border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px 12px" }}>
          <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, fontWeight: 600, color: TOKENS.ink, margin: 0 }}>
            Detail par etablissement
          </h3>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: TOKENS.paperDim, borderTop: "1px solid " + TOKENS.line, borderBottom: "1px solid " + TOKENS.line }}>
              {["Etablissement", "Salaries", "A jour", "Echeance proche", "Non conformes", "Conformite"].map((h, i) => (
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
  );
}

// Duree de validite du vaccin grippe (en jours) avant qu'une nouvelle
// injection soit recommandee. Ajustable ici si la recommandation change.
const GRIPPE_VALIDITE_JOURS = 365;
// Nombre de jours avant l'echeance a partir duquel le statut passe en
// "Echeance proche" au lieu d'attendre le jour J.
const GRIPPE_ALERTE_JOURS = 45;

function formatDateFr(date) {
  return date.toLocaleDateString("fr-FR");
}

// Calcule automatiquement le statut de conformite, la date de derniere mise
// a jour affichee et le libelle d'echeance, a partir de la date reelle de la
// derniere vaccination. Ce calcul est refait a chaque affichage : un salarie
// "a jour" aujourd'hui repassera automatiquement en "Echeance proche" puis
// "Non conforme" avec le temps, sans intervention manuelle.
function computeVaccineCompliance(vaccine, lastVaccinationDateStr) {
  if (!lastVaccinationDateStr) {
    return { status: "non_conforme", updatedLabel: "-", nextLabel: "Aucun justificatif" };
  }

  const lastDate = new Date(lastVaccinationDateStr + "T00:00:00");
  const updatedLabel = formatDateFr(lastDate);

  if (vaccine === "Rougeole") {
    // Immunite consideree comme durable : pas de rappel periodique attendu.
    return { status: "conforme", updatedLabel, nextLabel: "Aucune echeance (immunite durable)" };
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
  if (joursRestants <= GRIPPE_ALERTE_JOURS) {
    return { status: "a_venir", updatedLabel, nextLabel: formatDateFr(expiryDate) };
  }
  return { status: "conforme", updatedLabel, nextLabel: formatDateFr(expiryDate) };
}

const VACCINE_TYPES = [
  { key: "Grippe", label: "Grippe (obligatoire depuis 01/01/2026)" },
  { key: "Rougeole", label: "Rougeole (LFSS 2026, decret a venir)" },
];

function VaccineSection({ vaccineKey, label, date, onDateChange, file, onFileChange, existingDocumentUrl }) {
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
  const preview = computeVaccineCompliance(vaccineKey, date || null);
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

function StaffModal({ onClose, onSave, establishments, token, editingStaff }) {
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
      }

      // Pour chaque vaccin renseigne avec une date, on cree ou met a jour son suivi.
      // Si le champ date est laisse vide, on ne touche pas a un suivi deja existant.
      for (const v of VACCINE_TYPES) {
        const date = dates[v.key];
        if (!date) continue;
        const existing = findExisting(v.key);
        let documentUrl = existing?.documentUrl || null;
        if (files[v.key]) {
          documentUrl = await uploadJustificatif(files[v.key], token);
        }
        const computed = computeVaccineCompliance(v.key, date);
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
            {isEditing ? "Modifier le salarie" : "Ajouter un salarie"}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: TOKENS.inkSoft }}>
            <X size={18} />
          </button>
        </div>

        <label style={labelStyle}>Nom complet</label>
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Marie Dupont" />

        <label style={labelStyle}>Fonction</label>
        <input style={inputStyle} value={role} onChange={(e) => setRole(e.target.value)} placeholder="Ex. Auxiliaire de puericulture" />

        <label style={labelStyle}>Etablissement</label>
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

function StaffView({ staff, onReload, onDeletePerson, establishments, token }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const filtered = useMemo(() => {
    return staff.filter((s) => {
      const matchQuery = s.name.toLowerCase().includes(query.toLowerCase());
      const matchFilter = filter === "all" || s.status === filter;
      return matchQuery && matchFilter;
    });
  }, [staff, query, filter]);

  const handleDelete = async (s) => {
    if (!window.confirm("Supprimer " + s.name + " ? Cette action est irreversible et supprimera tous ses suivis vaccinaux.")) return;
    setDeletingId(s.id);
    try {
      await onDeletePerson(s.id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
          <Search size={14} color={TOKENS.inkSoft} style={{ position: "absolute", left: 10, top: 10 }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un salarie..."
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
        <button
          onClick={() => setShowModal(true)}
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            borderRadius: 6,
            border: "none",
            background: TOKENS.ink,
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
        />
      )}

      <div style={{ background: "#fff", border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)", borderRadius: 8, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'Inter', sans-serif" }}>
          <thead>
            <tr style={{ background: TOKENS.paperDim, borderBottom: "1px solid " + TOKENS.line }}>
              {["Nom", "Fonction", "Etablissement", "Statut global", "Grippe", "Rougeole", "Actions"].map((h) => (
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
                  <td style={{ padding: "11px 16px", fontSize: 13.5, color: TOKENS.ink, fontWeight: 500, whiteSpace: "nowrap" }}>{s.name}</td>
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
          reason: a.status === "non_conforme" ? "Aucun justificatif enregistre" : "Echeance proche (" + a.next + ")",
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
                  ? `Date de vaccination ${a.vaccine.toLowerCase()} non renseignee : impossible de verifier la conformite.`
                  : isOverdue
                  ? `Aucun justificatif d'immunisation ${a.vaccine.toLowerCase()} valide enregistre.`
                  : `Echeance de controle (${a.vaccine}) : ${a.next}.`}
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

function SettingsView({ establishments, token, onUpdate, organizationId, onAddEstablishment, onDeleteEstablishment, organizationName, onRenameOrganization, currentUserEmail, onDeleteAccount, staffCount }) {
  const [orgNameDraft, setOrgNameDraft] = useState(organizationName || "");
  const [renamingOrg, setRenamingOrg] = useState(false);
  const [orgRenamed, setOrgRenamed] = useState(false);
  const [orgRenameError, setOrgRenameError] = useState(null);

  const [members, setMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteResultMessage, setInviteResultMessage] = useState(null);
  const [removingMemberId, setRemovingMemberId] = useState(null);
  const [removeMemberError, setRemoveMemberError] = useState(null);

  useEffect(() => {
    if (organizationName) setOrgNameDraft(organizationName);
  }, [organizationName]);

  useEffect(() => {
    if (!organizationId) return;
    Promise.all([fetchOrganizationMembers(organizationId, token), fetchInvitations(organizationId, token)])
      .then(([m, i]) => {
        setMembers(m);
        setPendingInvites(i);
      })
      .catch((err) => console.error("Erreur de chargement equipe:", err));
  }, [organizationId, token]);

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
      if (!invitation) throw new Error("Aucune donnee retournee");
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

  const handleRemoveMember = async (member) => {
    const confirmed = window.confirm(
      "Retirer " + member.email + " de l'organisation ? Cette personne perdra immediatement l'acces a toutes les donnees."
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
  const [billingPeriod, setBillingPeriod] = useState("monthly");

  const plans = [
    {
      name: "Starter",
      monthly: "29\u20ac",
      annual: "290\u20ac",
      tagline: "Pour un etablissement isole",
      features: ["1 etablissement", "Salaries illimites", "Alertes email manuelles", "Export PDF", "Upload de justificatifs"],
    },
    {
      name: "Pro",
      monthly: "89\u20ac",
      annual: "890\u20ac",
      tagline: "Pour les petits groupes",
      features: ["Jusqu'a 5 etablissements", "Alertes automatiques quotidiennes", "Jusqu'a 5 membres d'equipe", "Tout Starter inclus"],
      highlighted: true,
    },
    {
      name: "Entreprise",
      monthly: "A partir de 199\u20ac",
      annual: "A partir de 1990\u20ac",
      tagline: "Pour les grands groupes",
      features: ["Etablissements illimites", "Membres d'equipe illimites", "Support prioritaire", "Tout Pro inclus"],
    },
  ];
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
      if (!updated) throw new Error("Aucune donnee retournee");
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
      if (!created) throw new Error("Aucune donnee retournee");
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
        throw new Error("Aucune donnee retournee (droits d'acces manquants sur la base ?)");
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
      "Supprimer \"" + e.name + "\" ? Tous les salaries rattaches a cet etablissement seront egalement supprimes definitivement."
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
        {orgRenamed && <div style={{ fontSize: 11.5, color: TOKENS.ok, marginTop: 8 }}>Enregistre</div>}
        {orgRenameError && <div style={{ fontSize: 11.5, color: TOKENS.danger, marginTop: 8 }}>{orgRenameError}</div>}
      </div>

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
              color: TOKENS.brand,
              background: TOKENS.okBg,
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Beta gratuite
          </span>
        </div>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: TOKENS.inkSoft, margin: "0 0 16px" }}>
          Confia est actuellement en phase beta gratuite. Les offres payantes seront communiquees a l'avance avant tout changement.
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1, padding: "12px 14px", background: TOKENS.paperDim, borderRadius: 6, textAlign: "center" }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 22, fontWeight: 600, color: TOKENS.ink }}>
              {establishments.length}
            </div>
            <div style={{ fontSize: 11.5, color: TOKENS.inkSoft, marginTop: 2 }}>Etablissements</div>
          </div>
          <div style={{ flex: 1, padding: "12px 14px", background: TOKENS.paperDim, borderRadius: 6, textAlign: "center" }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 22, fontWeight: 600, color: TOKENS.ink }}>
              {staffCount}
            </div>
            <div style={{ fontSize: 11.5, color: TOKENS.inkSoft, marginTop: 2 }}>Salaries suivis</div>
          </div>
          <div style={{ flex: 1, padding: "12px 14px", background: TOKENS.paperDim, borderRadius: 6, textAlign: "center" }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 22, fontWeight: 600, color: TOKENS.ink }}>
              {members.length}
            </div>
            <div style={{ fontSize: 11.5, color: TOKENS.inkSoft, marginTop: 2 }}>Membres d'equipe</div>
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)", borderRadius: 8, padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 10 }}>
          <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, fontWeight: 600, color: TOKENS.ink, margin: 0 }}>
            Nos futures offres
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
          Toutes les fonctionnalites sont accessibles gratuitement pendant la periode beta. Voici les offres a venir.
        </p>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {plans.map((plan) => (
            <div
              key={plan.name}
              style={{
                flex: "1 1 200px",
                border: "1px solid " + (plan.highlighted ? TOKENS.brand : TOKENS.line),
                borderRadius: 8,
                padding: "16px 16px",
                position: "relative",
                background: plan.highlighted ? TOKENS.okBg : "#fff",
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
              <ul style={{ margin: "12px 0 0", padding: "0 0 0 16px", fontSize: 12, color: TOKENS.inkSoft, lineHeight: 1.8 }}>
                {plan.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)", borderRadius: 8, padding: "20px 24px" }}>
        <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, fontWeight: 600, color: TOKENS.ink, margin: "0 0 4px" }}>
          Membres de l'equipe
        </h3>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: TOKENS.inkSoft, margin: "0 0 14px" }}>
          Invitez des collegues a rejoindre votre organisation. Ils devront s'inscrire avec la meme adresse email que celle invitee.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input
            type="email"
            placeholder="email@collegue.fr"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
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
                <span>{m.email}{m.email === currentUserEmail ? " (vous)" : ""}</span>
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
                padding: "8px 12px",
                background: TOKENS.warnBg,
                borderRadius: 6,
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
              }}
            >
              <span>{inv.email}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, color: TOKENS.warn }}>En attente</span>
                <button
                  onClick={() => cancelInvite(inv.id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: TOKENS.danger,
                    cursor: "pointer",
                    fontSize: 11,
                    textDecoration: "underline",
                  }}
                >
                  Annuler
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)", borderRadius: 8, padding: "20px 24px" }}>
        <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, fontWeight: 600, color: TOKENS.ink, margin: "0 0 4px" }}>
          Ajouter un etablissement
        </h3>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: TOKENS.inkSoft, margin: "0 0 14px" }}>
          Chaque etablissement que vous ajoutez ici est visible uniquement par votre organisation.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="Nom de l'etablissement"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Ville (optionnel)"
            value={newCity}
            onChange={(e) => setNewCity(e.target.value)}
            style={{ ...inputStyle, flex: 0.6 }}
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
        Vos etablissements
      </h3>
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: TOKENS.inkSoft, margin: "0 0 18px" }}>
        Modifiez le nom, la ville ou l'email de contact de chaque etablissement, ou supprimez-le.
      </p>
      {establishments.length === 0 ? (
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: TOKENS.inkSoft }}>
          Ajoutez d'abord un etablissement ci-dessus.
        </p>
      ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {establishments.map((e) => {
          const d = drafts[e.id] || { name: "", city: "", contact_email: "" };
          const setField = (field, value) =>
            setDrafts((prev) => ({ ...prev, [e.id]: { ...prev[e.id], [field]: value } }));
          return (
            <div key={e.id} style={{ padding: "14px", background: TOKENS.paperDim, borderRadius: 8 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 11.5, color: TOKENS.inkSoft, marginBottom: 4 }}>Nom</label>
                  <input
                    value={d.name}
                    onChange={(ev) => setField("name", ev.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: 0.6 }}>
                  <label style={{ display: "block", fontSize: 11.5, color: TOKENS.inkSoft, marginBottom: 4 }}>Ville</label>
                  <input
                    value={d.city}
                    onChange={(ev) => setField("city", ev.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
              <label style={{ display: "block", fontSize: 11.5, color: TOKENS.inkSoft, marginBottom: 4 }}>
                Email de contact (pour le resume quotidien)
              </label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="email"
                  placeholder="email@etablissement.fr"
                  value={d.contact_email}
                  onChange={(ev) => setField("contact_email", ev.target.value)}
                  style={inputStyle}
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
                  }}
                >
                  {saving[e.id] ? "..." : "Enregistrer"}
                </button>
                <button
                  onClick={() => handleDeleteEstablishment(e)}
                  disabled={deletingEstabId === e.id}
                  title="Supprimer cet etablissement"
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
          Supprimer votre compte est definitif et irreversible. Vos etablissements et salaries resteront lies a votre organisation mais vous n'y aurez plus acces.
        </p>
        <label style={{ display: "block", fontSize: 12, color: TOKENS.ink, marginBottom: 6 }}>
          Tapez votre email (<strong>{currentUserEmail}</strong>) pour confirmer :
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder={currentUserEmail}
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
      doc.text("Rapport de conformite vaccinale", 14, 18);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(organizationName || "Confia", 14, 26);
      doc.text("Genere le " + today, 14, 32);
      doc.text("Taux de conformite global : " + percent + "% (" + conforme + "/" + total + ")", 14, 40);

      let y = 52;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Detail par salarie", 14, y);
      y += 8;

      doc.setFontSize(9);
      doc.text("Nom", 14, y);
      doc.text("Etablissement", 65, y);
      doc.text("Vaccin", 120, y);
      doc.text("Statut", 145, y);
      doc.text("Echeance", 172, y);
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
        "Document genere automatiquement par Confia - a des fins de suivi interne.",
        14,
        290
      );

      doc.save("rapport-conformite-vaccinale-" + today.replace(/\//g, "-") + ".pdf");
    } catch (err) {
      console.error("Erreur de generation PDF:", err);
      alert("Erreur lors de la generation du PDF. Reessayez.");
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
        Rapport de conformite
      </h3>
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: TOKENS.inkSoft, lineHeight: 1.6, margin: "0 0 18px" }}>
        Generez un export horodate, pret a presenter lors d'un controle ou d'un renouvellement d'agrement.
      </p>
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
        {generating ? "Generation..." : "Generer le PDF"}
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

function LandingPage({ onGetStarted, onLogin }) {
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
          Loi de financement de la securite sociale 2026 — obligation vaccinale medico-social
        </span>
        <h1 style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.25, margin: "0 0 18px" }}>
          La conformite vaccinale de votre EHPAD,
          <br />
          enfin maitrisee.
        </h1>
        <p style={{ fontSize: 15.5, color: TOKENS.inkSoft, lineHeight: 1.65, maxWidth: 620, margin: "0 auto 30px" }}>
          Depuis le 1er janvier 2026, l'obligation vaccinale contre la grippe s'applique a l'ensemble du
          personnel soignant en EHPAD (article L.3111-4 du code de la sante publique). Une nouvelle
          obligation rougeole est prevue par la LFSS 2026. Confia centralise le suivi de votre personnel,
          automatise les relances et genere vos justificatifs de conformite.
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
            Creer mon compte gratuitement <ChevronRight size={16} />
          </button>
          <span style={{ fontSize: 12, color: TOKENS.inkSoft }}>
            Aucune carte bancaire requise — acces complet pendant la phase beta.
          </span>
        </div>
      </div>

      {/* Fonctionnalites */}
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "20px 20px 60px" }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <LandingFeatureCard
            icon={Users}
            title="Suivi centralise du personnel"
            description="Visualisez en un coup d'oeil le statut vaccinal de chaque salarie, etablissement par etablissement."
          />
          <LandingFeatureCard
            icon={BellRing}
            title="Alertes automatiques"
            description="Recevez chaque jour un resume de conformite par email, sans avoir a verifier manuellement."
          />
          <LandingFeatureCard
            icon={FileDown}
            title="Rapports prets pour un controle"
            description="Generez en un clic un rapport PDF horodate a presenter lors d'une inspection ou d'un renouvellement d'agrement."
          />
          <LandingFeatureCard
            icon={Building2}
            title="Multi-etablissements"
            description="Gerez plusieurs EHPAD et invitez votre equipe au sein d'une seule organisation."
          />
        </div>
      </div>

      {/* Section reglementaire */}
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
            Une obligation legale, un outil pense pour y repondre
          </h2>
          <p style={{ fontSize: 13.5, color: TOKENS.inkSoft, lineHeight: 1.7, margin: 0 }}>
            L'obligation vaccinale grippe pour le personnel soignant en EHPAD est en vigueur depuis le 1er
            janvier 2026. La LFSS 2026 prevoit egalement une nouvelle obligation vaccinale rougeole pour le
            personnel du secteur medico-social, dont le decret d'application est attendu. Confia est un
            outil de suivi interne qui vous aide a anticiper ces echeances ; il ne remplace pas un avis
            juridique ou medical.
          </p>
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
            Creer mon compte gratuitement <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Footer */}
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "24px 20px", textAlign: "center" }}>
        <span style={{ fontSize: 12, color: TOKENS.inkSoft }}>
          Confia — Suivi de conformite vaccinale pour le secteur medico-social
        </span>
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
        setInfo("Compte cree. Verifiez votre email pour confirmer, puis connectez-vous.");
        setMode("login");
      } else if (mode === "forgot") {
        await requestPasswordReset(email.trim());
        setInfo("Si un compte existe avec cet email, un lien de reinitialisation a ete envoye.");
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
            ← Retour a l'accueil
          </button>
        )}

        <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 600, color: TOKENS.ink, margin: "0 0 16px" }}>
          {mode === "login" ? "Connexion" : mode === "signup" ? "Creer un compte" : "Mot de passe oublie"}
        </h2>

        {mode === "signup" && (
          <input
            type="text"
            placeholder="Nom de votre etablissement ou organisation"
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
          <PasswordInput
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            required
            minLength={6}
          />
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
            ? "Creer mon compte"
            : "Envoyer le lien de reinitialisation"}
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
            Mot de passe oublie ?
          </button>
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
            ? "Pas encore de compte ? Creez-en un"
            : mode === "forgot"
            ? "Retour a la connexion"
            : "Deja un compte ? Connectez-vous"}
        </button>
      </form>
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder, style, required, minLength }) {
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
        />
        <PasswordInput
          placeholder="Confirmer le mot de passe"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          style={inputStyle}
          required
          minLength={6}
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
  const [showLanding, setShowLanding] = useState(true);
  const [authInitialMode, setAuthInitialMode] = useState("login");
  const [view, setView] = useState("dashboard");
  const [staff, setStaff] = useState([]);
  const [establishments, setEstablishments] = useState([]);
  const [organizationId, setOrganizationId] = useState(null);
  const [organizationName, setOrganizationName] = useState(null);
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
          setStaff(staffRows.map(mapPersonRow));
          setOrganizationId(org.id);
          setOrganizationName(org.name);
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
      setStaff(staffRows.map(mapPersonRow));
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
        setError("Echec de la suppression du salarie. Reessayez.");
      }
    }
  };

  const handleLogin = (newSession) => {
    saveSession(newSession);
    setSession(newSession);
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
    if (showLanding) {
      return (
        <LandingPage
          onGetStarted={() => {
            setAuthInitialMode("signup");
            setShowLanding(false);
          }}
          onLogin={() => {
            setAuthInitialMode("login");
            setShowLanding(false);
          }}
        />
      );
    }
    return (
      <LoginScreen
        onLogin={handleLogin}
        initialMode={authInitialMode}
        onBackToLanding={() => setShowLanding(true)}
      />
    );
  }

  const titles = {
    dashboard: "Tableau de bord",
    staff: "Salaries",
    alerts: "Alertes",
    reports: "Rapports",
    settings: "Parametres",
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
          Chargement des donnees...
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
        <Sidebar view={view} setView={setView} establishmentCount={establishments.length} />
        <div style={{ flex: 1, padding: "24px 30px", overflow: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <h1 style={{ fontFamily: "'Inter', sans-serif", fontSize: 22, fontWeight: 600, color: TOKENS.ink, margin: 0 }}>
              {titles[view]}
            </h1>
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
                }}
              >
                {(organizationName || session?.user?.email || "?")
                  .split(/\s+/)
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              {organizationName || "Chargement..."}
              <button
                onClick={handleLogout}
                style={{
                  marginLeft: 12,
                  padding: "5px 10px",
                  borderRadius: 5,
                  border: "1px solid " + TOKENS.line, boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
                  background: "#fff",
                  color: TOKENS.inkSoft,
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 11.5,
                  cursor: "pointer",
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
          {view === "dashboard" && <Dashboard staff={staff} establishments={establishments} setView={setView} />}
          {view === "staff" && <StaffView staff={staff} onReload={reloadStaff} onDeletePerson={handleDeletePerson} establishments={establishments} token={token} />}
          {view === "alerts" && <AlertsView staff={staff} establishments={establishments} userEmail={session?.user?.email} />}
          {view === "reports" && <ReportsView staff={staff} establishments={establishments} organizationName={organizationName} />}
          {view === "settings" && (
            <SettingsView
              establishments={establishments}
              token={token}
              organizationId={organizationId}
              organizationName={organizationName}
              currentUserEmail={session?.user?.email}
              staffCount={staff.length}
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
