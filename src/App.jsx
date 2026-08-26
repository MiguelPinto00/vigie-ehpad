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
} from "lucide-react";

const TOKENS = {
  paper: "#FAF8F3",
  paperDim: "#F2EEE4",
  ink: "#16231F",
  inkSoft: "#4B5651",
  brand: "#1F4E4A",
  ok: "#4B7C63",
  okBg: "#E7EFE9",
  warn: "#C98A3D",
  warnBg: "#F6EBDB",
  danger: "#A6432F",
  dangerBg: "#F3E4DF",
  line: "#E4DFD3",
};

const FONTS_LINK =
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap";

function LogoMark({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <path d="M 20 12 L 4 26 L 20 22 L 36 26 Z" fill="#C98A3D" opacity="0.28" />
      <line x1="20" y1="32" x2="20" y2="15" stroke="#1F4E4A" strokeWidth="3" strokeLinecap="round" />
      <rect x="8" y="30" width="24" height="6" rx="1.5" fill="#1F4E4A" />
      <circle cx="20" cy="12" r="5" fill="#C98A3D" />
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
  const res = await fetch(SUPABASE_URL + "/rest/v1/staff?select=*", {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error("staff " + res.status + " - " + body.slice(0, 200));
  }
  return res.json();
}

async function insertStaff(row, token) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/staff", {
    method: "POST",
    headers: { ...authHeaders(token), Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error("Erreur d'enregistrement");
  const data = await res.json();
  return data[0];
}

async function updateStaff(id, updates, token) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/staff?id=eq." + id, {
    method: "PATCH",
    headers: { ...authHeaders(token), Prefer: "return=representation" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Erreur de mise a jour du salarie");
  const data = await res.json();
  return data[0];
}

async function deleteStaff(id, token) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/staff?id=eq." + id, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Erreur de suppression");
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

async function updateEstablishmentEmail(establishmentId, contactEmail, token) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/establishments?id=eq." + establishmentId, {
    method: "PATCH",
    headers: { ...authHeaders(token), Prefer: "return=representation" },
    body: JSON.stringify({ contact_email: contactEmail }),
  });
  if (!res.ok) throw new Error("Erreur de mise a jour");
  const data = await res.json();
  return data[0];
}

async function fetchMyOrganization(token) {
  const res = await fetch(
    SUPABASE_URL + "/rest/v1/organization_members?select=organization_id,organizations(id,name)&limit=1",
    { headers: authHeaders(token) }
  );
  if (!res.ok) throw new Error("Erreur de lecture de l'organisation");
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

// Convertit une ligne Supabase (colonnes en snake_case) vers le format utilise par l'interface
function mapStaffRow(row) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    site: row.establishment_id,
    vaccine: row.vaccine,
    status: row.status,
    updated: row.updated_label,
    next: row.next_label,
    documentUrl: row.document_url,
  };
}

const STATUS_META = {
  conforme: { label: "A jour", color: TOKENS.ok, bg: TOKENS.okBg },
  a_venir: { label: "Echeance proche", color: TOKENS.warn, bg: TOKENS.warnBg },
  non_conforme: { label: "Non conforme", color: TOKENS.danger, bg: TOKENS.dangerBg },
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
        fontFamily: "'IBM Plex Sans', sans-serif",
        letterSpacing: "0.01em",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: meta.color }} />
      {meta.label}
    </span>
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
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 30, fontWeight: 600, color: TOKENS.ink, lineHeight: 1 }}>
          {percent}%
        </div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: TOKENS.inkSoft, marginTop: 4 }}>
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
        borderRadius: 6,
        border: "none",
        background: active ? "rgba(255,255,255,0.12)" : "transparent",
        color: active ? "#FFFFFF" : "rgba(255,255,255,0.68)",
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontSize: 13.5,
        fontWeight: 500,
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

function Sidebar({ view, setView }) {
  return (
    <div
      style={{
        width: 224,
        flexShrink: 0,
        background: TOKENS.brand,
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
            background: TOKENS.paper,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <LogoMark size={17} />
        </div>
        <span style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: "#fff" }}>
          Vigie
        </span>
      </div>
      <NavItem icon={LayoutDashboard} label="Tableau de bord" active={view === "dashboard"} onClick={() => setView("dashboard")} />
      <NavItem icon={Users} label="Salaries" active={view === "staff"} onClick={() => setView("staff")} />
      <NavItem icon={BellRing} label="Alertes" active={view === "alerts"} onClick={() => setView("alerts")} />
      <NavItem icon={FileDown} label="Rapports" active={view === "reports"} onClick={() => setView("reports")} />
      <NavItem icon={Settings} label="Parametres" active={view === "settings"} onClick={() => setView("settings")} />
      <div style={{ marginTop: 20, padding: "12px 10px 4px", borderTop: "1px solid rgba(255,255,255,0.12)" }}>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, color: "rgba(255,255,255,0.5)" }}>
          3 etablissements suivis
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
        border: "1px solid " + TOKENS.line,
        borderRadius: 8,
        padding: "16px 18px",
        flex: 1,
      }}
    >
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: TOKENS.inkSoft, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 600, color: accent || TOKENS.ink }}>
          {value}
        </span>
      </div>
    </div>
  );
}

function Dashboard({ staff, establishments }) {
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
          border: "1px solid " + TOKENS.line,
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
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: TOKENS.ink, margin: 0 }}>
            Obligation vaccinale grippe — en vigueur depuis le 1er janvier 2026
          </h2>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5, color: TOKENS.inkSoft, marginTop: 6, lineHeight: 1.55, maxWidth: 460 }}>
            {nonConforme} salarie{nonConforme > 1 ? "s" : ""} sur {total} n'a pas de justificatif a jour (grippe ou rougeole). L'article L.3111-4 du code de la sante publique s'applique deja a votre personnel soignant.
          </p>
          <button
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
              fontFamily: "'IBM Plex Sans', sans-serif",
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

      <div style={{ background: "#fff", border: "1px solid " + TOKENS.line, borderRadius: 8, padding: "18px 20px" }}>
        <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, color: TOKENS.ink, margin: "0 0 12px" }}>
          Par etablissement
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {establishments.map((e) => {
            const siteStaff = staff.filter((s) => s.site === e.id);
            const ok = siteStaff.filter((s) => s.status === "conforme").length;
            const pct = siteStaff.length ? Math.round((ok / siteStaff.length) * 100) : 0;
            return (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Building2 size={15} color={TOKENS.inkSoft} style={{ flexShrink: 0 }} />
                <div style={{ width: 190, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: TOKENS.ink }}>
                  {e.name}
                </div>
                <div style={{ flex: 1, height: 6, background: TOKENS.paperDim, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: pct + "%", height: "100%", background: TOKENS.brand, borderRadius: 3 }} />
                </div>
                <div style={{ width: 40, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: TOKENS.inkSoft, textAlign: "right" }}>
                  {pct}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StaffModal({ onClose, onSave, establishments, token, editingStaff }) {
  const isEditing = !!editingStaff;
  const [name, setName] = useState(editingStaff?.name || "");
  const [role, setRole] = useState(editingStaff?.role || "");
  const [site, setSite] = useState(editingStaff?.site || establishments[0]?.id || "");
  const [vaccine, setVaccine] = useState(editingStaff?.vaccine || "Grippe");
  const [status, setStatus] = useState(editingStaff?.status || "a_venir");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const inputStyle = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 6,
    border: "1px solid " + TOKENS.line,
    fontFamily: "'IBM Plex Sans', sans-serif",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
    marginBottom: 12,
  };
  const labelStyle = {
    display: "block",
    fontFamily: "'IBM Plex Sans', sans-serif",
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
      let documentUrl = editingStaff?.documentUrl || null;
      if (file) {
        documentUrl = await uploadJustificatif(file, token);
      }
      const payload = {
        name: name.trim(),
        role: role.trim(),
        establishment_id: site,
        vaccine,
        status,
        updated_label: status === "conforme" ? new Date().toLocaleDateString("fr-FR") : "-",
        next_label: status === "non_conforme" ? "Retard" : status === "a_venir" ? "A definir" : "-",
        document_url: documentUrl,
      };
      await onSave(payload, editingStaff?.id);
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
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 10,
          padding: 24,
          width: 380,
          boxShadow: "0 12px 40px rgba(22,35,31,0.18)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 600, color: TOKENS.ink, margin: 0 }}>
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

        <label style={labelStyle}>Vaccin concerne</label>
        <select style={inputStyle} value={vaccine} onChange={(e) => setVaccine(e.target.value)}>
          <option value="Grippe">Grippe (obligatoire depuis 01/01/2026)</option>
          <option value="Rougeole">Rougeole (LFSS 2026, decret a venir)</option>
        </select>

        <label style={labelStyle}>Statut vaccinal</label>
        <select style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="conforme">A jour</option>
          <option value="a_venir">Echeance proche</option>
          <option value="non_conforme">Non conforme</option>
        </select>

        <label style={labelStyle}>
          Justificatif {isEditing && editingStaff?.documentUrl ? "(remplacer)" : "(optionnel)"}
        </label>
        <input
          type="file"
          accept="application/pdf,image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          style={{ ...inputStyle, padding: "6px 8px" }}
        />

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
            fontFamily: "'IBM Plex Sans', sans-serif",
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

function StaffView({ staff, onAddStaff, onUpdateStaff, onDeleteStaff, establishments, token }) {
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
    if (!window.confirm("Supprimer " + s.name + " ? Cette action est irreversible.")) return;
    setDeletingId(s.id);
    try {
      await onDeleteStaff(s.id);
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
              border: "1px solid " + TOKENS.line,
              fontFamily: "'IBM Plex Sans', sans-serif",
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
              fontFamily: "'IBM Plex Sans', sans-serif",
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
            fontFamily: "'IBM Plex Sans', sans-serif",
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
          onSave={(payload, id) => (id ? onUpdateStaff(id, payload) : onAddStaff(payload))}
          establishments={establishments}
          token={token}
          editingStaff={editingStaff}
        />
      )}

      <div style={{ background: "#fff", border: "1px solid " + TOKENS.line, borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'IBM Plex Sans', sans-serif" }}>
          <thead>
            <tr style={{ background: TOKENS.paperDim, borderBottom: "1px solid " + TOKENS.line }}>
              {["Nom", "Fonction", "Etablissement", "Vaccin", "Statut", "Derniere MaJ", "Echeance", "Document", "Actions"].map((h) => (
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
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} style={{ borderBottom: "1px solid " + TOKENS.line }}>
                <td style={{ padding: "11px 16px", fontSize: 13.5, color: TOKENS.ink, fontWeight: 500 }}>{s.name}</td>
                <td style={{ padding: "11px 16px", fontSize: 13, color: TOKENS.inkSoft }}>{s.role}</td>
                <td style={{ padding: "11px 16px", fontSize: 13, color: TOKENS.inkSoft }}>
                  {establishments.find((e) => e.id === s.site)?.name}
                </td>
                <td style={{ padding: "11px 16px", fontSize: 12.5, color: TOKENS.ink, fontFamily: "'IBM Plex Mono', monospace" }}>
                  {s.vaccine || "-"}
                </td>
                <td style={{ padding: "11px 16px" }}>
                  <Seal status={s.status} />
                </td>
                <td style={{ padding: "11px 16px", fontSize: 12.5, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
                  {s.updated}
                </td>
                <td style={{ padding: "11px 16px", fontSize: 12.5, color: s.status === "non_conforme" ? TOKENS.danger : TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
                  {s.next}
                </td>
                <td style={{ padding: "11px 16px", fontSize: 12.5 }}>
                  {s.documentUrl ? (
                    <a
                      href={s.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: TOKENS.brand, fontFamily: "'IBM Plex Sans', sans-serif", textDecoration: "underline" }}
                    >
                      Voir
                    </a>
                  ) : (
                    <span style={{ color: TOKENS.inkSoft }}>-</span>
                  )}
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
                        border: "1px solid " + TOKENS.line,
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
                        border: "1px solid " + TOKENS.line,
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AlertsView({ staff, establishments, userEmail }) {
  const alerts = staff.filter((s) => s.status !== "conforme");
  const [sendState, setSendState] = useState({});

  const sendAlert = async (s) => {
    setSendState((prev) => ({ ...prev, [s.id]: "sending" }));
    try {
      const res = await fetch("/api/send-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toEmail: userEmail,
          staffName: s.name,
          establishmentName: establishments.find((e) => e.id === s.site)?.name || "-",
          vaccine: s.vaccine,
          reason: s.status === "non_conforme" ? "Aucun justificatif enregistre" : "Echeance proche (" + s.next + ")",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Echec de l'envoi");
      setSendState((prev) => ({ ...prev, [s.id]: "sent" }));
    } catch (err) {
      console.error("Erreur d'envoi:", err);
      setSendState((prev) => ({ ...prev, [s.id]: "error" }));
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {alerts.map((s) => {
        const isOverdue = s.status === "non_conforme";
        const state = sendState[s.id];
        return (
          <div
            key={s.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              background: "#fff",
              border: "1px solid " + TOKENS.line,
              borderLeft: "3px solid " + (isOverdue ? TOKENS.danger : TOKENS.warn),
              borderRadius: 6,
              padding: "14px 18px",
            }}
          >
            <BellRing size={16} color={isOverdue ? TOKENS.danger : TOKENS.warn} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5, fontWeight: 500, color: TOKENS.ink }}>
                {s.name} - {establishments.find((e) => e.id === s.site)?.name}
              </div>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, color: TOKENS.inkSoft, marginTop: 2 }}>
                {isOverdue
                  ? `Aucun justificatif d'immunisation ${s.vaccine?.toLowerCase() || ""} enregistre.`
                  : `Echeance de controle (${s.vaccine}) : ${s.next}.`}
              </div>
              {state === "sent" && (
                <div style={{ fontSize: 11.5, color: TOKENS.ok, marginTop: 4 }}>Email envoye</div>
              )}
              {state === "error" && (
                <div style={{ fontSize: 11.5, color: TOKENS.danger, marginTop: 4 }}>Echec de l'envoi, reessayez</div>
              )}
            </div>
            <button
              onClick={() => sendAlert(s)}
              disabled={state === "sending"}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid " + TOKENS.line,
                background: TOKENS.paperDim,
                color: TOKENS.ink,
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: 12.5,
                cursor: state === "sending" ? "default" : "pointer",
                whiteSpace: "nowrap",
                opacity: state === "sending" ? 0.6 : 1,
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

function SettingsView({ establishments, token, onUpdate, organizationId, onAddEstablishment, organizationName, onRenameOrganization }) {
  const [orgNameDraft, setOrgNameDraft] = useState(organizationName || "");
  const [renamingOrg, setRenamingOrg] = useState(false);
  const [orgRenamed, setOrgRenamed] = useState(false);
  const [orgRenameError, setOrgRenameError] = useState(null);

  useEffect(() => {
    if (organizationName) setOrgNameDraft(organizationName);
  }, [organizationName]);
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(establishments.map((e) => [e.id, e.contact_email || ""]))
  );
  const [saving, setSaving] = useState({});
  const [saved, setSaved] = useState({});
  const [errors, setErrors] = useState({});
  const [newName, setNewName] = useState("");
  const [newCity, setNewCity] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  const inputStyle = {
    flex: 1,
    padding: "8px 10px",
    borderRadius: 6,
    border: "1px solid " + TOKENS.line,
    fontFamily: "'IBM Plex Sans', sans-serif",
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

  const save = async (id) => {
    setSaving((prev) => ({ ...prev, [id]: true }));
    setSaved((prev) => ({ ...prev, [id]: false }));
    setErrors((prev) => ({ ...prev, [id]: null }));
    try {
      const updated = await updateEstablishmentEmail(id, drafts[id].trim(), token);
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 640 }}>
      <div style={{ background: "#fff", border: "1px solid " + TOKENS.line, borderRadius: 8, padding: "20px 24px" }}>
        <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, color: TOKENS.ink, margin: "0 0 4px" }}>
          Nom de votre organisation
        </h3>
        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, color: TOKENS.inkSoft, margin: "0 0 14px" }}>
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
              border: "1px solid " + TOKENS.line,
              fontFamily: "'IBM Plex Sans', sans-serif",
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
              fontFamily: "'IBM Plex Sans', sans-serif",
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

      <div style={{ background: "#fff", border: "1px solid " + TOKENS.line, borderRadius: 8, padding: "20px 24px" }}>
        <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, color: TOKENS.ink, margin: "0 0 4px" }}>
          Ajouter un etablissement
        </h3>
        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, color: TOKENS.inkSoft, margin: "0 0 14px" }}>
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
              fontFamily: "'IBM Plex Sans', sans-serif",
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

      <div style={{ background: "#fff", border: "1px solid " + TOKENS.line, borderRadius: 8, padding: "20px 24px" }}>
      <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, color: TOKENS.ink, margin: "0 0 4px" }}>
        Email de contact par etablissement
      </h3>
      <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, color: TOKENS.inkSoft, margin: "0 0 18px" }}>
        Le resume quotidien de conformite sera envoye a cette adresse pour chaque etablissement.
      </p>
      {establishments.length === 0 ? (
        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: TOKENS.inkSoft }}>
          Ajoutez d'abord un etablissement ci-dessus.
        </p>
      ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {establishments.map((e) => (
          <div key={e.id}>
            <label style={{ display: "block", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, fontWeight: 500, color: TOKENS.ink, marginBottom: 5 }}>
              {e.name}
            </label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="email"
                placeholder="email@etablissement.fr"
                value={drafts[e.id] || ""}
                onChange={(ev) => setDrafts((prev) => ({ ...prev, [e.id]: ev.target.value }))}
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
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontSize: 12.5,
                  fontWeight: 500,
                  cursor: saving[e.id] ? "default" : "pointer",
                  opacity: saving[e.id] ? 0.6 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {saving[e.id] ? "..." : "Enregistrer"}
              </button>
            </div>
            {saved[e.id] && (
              <div style={{ fontSize: 11.5, color: TOKENS.ok, marginTop: 4 }}>Enregistre</div>
            )}
            {errors[e.id] && (
              <div style={{ fontSize: 11.5, color: TOKENS.danger, marginTop: 4 }}>{errors[e.id]}</div>
            )}
          </div>
        ))}
      </div>
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
      doc.text(organizationName || "Vigie", 14, 26);
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
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
        const estabName = establishments.find((e) => e.id === s.site)?.name || "-";
        const statusLabel = STATUS_META[s.status]?.label || s.status;
        doc.text(s.name.slice(0, 26), 14, y);
        doc.text(estabName.slice(0, 26), 65, y);
        doc.text(s.vaccine || "-", 120, y);
        doc.text(statusLabel, 145, y);
        doc.text(s.next || "-", 172, y);
        y += 6;
      });

      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        "Document genere automatiquement par Vigie - a des fins de suivi interne.",
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
        border: "1px solid " + TOKENS.line,
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
      <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 600, color: TOKENS.ink, margin: "0 0 8px" }}>
        Rapport de conformite
      </h3>
      <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: TOKENS.inkSoft, lineHeight: 1.6, margin: "0 0 18px" }}>
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
          fontFamily: "'IBM Plex Sans', sans-serif",
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

function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState("login"); // "login" ou "signup"
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
    border: "1px solid " + TOKENS.line,
    fontFamily: "'IBM Plex Sans', sans-serif",
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
        fontFamily: "'IBM Plex Sans', sans-serif",
      }}
    >
      <form
        onSubmit={submit}
        style={{
          background: "#fff",
          border: "1px solid " + TOKENS.line,
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
              border: "1px solid " + TOKENS.line,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LogoMark size={20} />
          </div>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 21, fontWeight: 600, color: TOKENS.ink }}>
            Vigie
          </span>
        </div>

        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 600, color: TOKENS.ink, margin: "0 0 16px" }}>
          {mode === "login" ? "Connexion" : "Creer un compte"}
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
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
          required
          minLength={6}
        />

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
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: 13.5,
            fontWeight: 500,
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Patientez..." : mode === "login" ? "Se connecter" : "Creer mon compte"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
            setInfo(null);
          }}
          style={{
            width: "100%",
            padding: "8px",
            marginTop: 10,
            border: "none",
            background: "none",
            color: TOKENS.inkSoft,
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: 12.5,
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          {mode === "login" ? "Pas encore de compte ? Creez-en un" : "Deja un compte ? Connectez-vous"}
        </button>
      </form>
    </div>
  );
}

export default function VigiePrototype() {
  const [session, setSession] = useState(() => getStoredSession());
  const [view, setView] = useState("dashboard");
  const [staff, setStaff] = useState([]);
  const [establishments, setEstablishments] = useState([]);
  const [organizationId, setOrganizationId] = useState(null);
  const [organizationName, setOrganizationName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
          setStaff(staffRows.map(mapStaffRow));
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

  const handleAddStaff = async (newStaffRow) => {
    try {
      const inserted = await insertStaff(newStaffRow, token);
      setStaff((prev) => [...prev, mapStaffRow(inserted)]);
    } catch (err) {
      console.error("Erreur de sauvegarde Supabase:", err);
      if (isSessionExpired(err)) {
        handleLogout();
      } else {
        setError("Echec de l'enregistrement du salarie. Reessayez.");
      }
    }
  };

  const handleUpdateStaff = async (id, updates) => {
    try {
      const updated = await updateStaff(id, updates, token);
      setStaff((prev) => prev.map((s) => (s.id === id ? mapStaffRow(updated) : s)));
    } catch (err) {
      console.error("Erreur de mise a jour Supabase:", err);
      if (isSessionExpired(err)) {
        handleLogout();
      } else {
        setError("Echec de la mise a jour du salarie. Reessayez.");
      }
    }
  };

  const handleDeleteStaff = async (id) => {
    try {
      await deleteStaff(id, token);
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

  if (!session) {
    return <LoginScreen onLogin={handleLogin} />;
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
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "90vh",
            background: TOKENS.paper,
            borderRadius: 10,
            border: "1px solid " + TOKENS.line,
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
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <div
        style={{
          display: "flex",
          minHeight: "90vh",
          background: TOKENS.paper,
          borderRadius: 10,
          overflow: "hidden",
          border: "1px solid " + TOKENS.line,
        }}
      >
        <Sidebar view={view} setView={setView} />
        <div style={{ flex: 1, padding: "24px 30px", overflow: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 600, color: TOKENS.ink, margin: 0 }}>
              {titles[view]}
            </h1>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontFamily: "'IBM Plex Sans', sans-serif",
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
                  border: "1px solid " + TOKENS.line,
                  background: "#fff",
                  color: TOKENS.inkSoft,
                  fontFamily: "'IBM Plex Sans', sans-serif",
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
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: 12.5,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}
          {view === "dashboard" && <Dashboard staff={staff} establishments={establishments} />}
          {view === "staff" && <StaffView staff={staff} onAddStaff={handleAddStaff} onUpdateStaff={handleUpdateStaff} onDeleteStaff={handleDeleteStaff} establishments={establishments} token={token} />}
          {view === "alerts" && <AlertsView staff={staff} establishments={establishments} userEmail={session?.user?.email} />}
          {view === "reports" && <ReportsView staff={staff} establishments={establishments} organizationName={organizationName} />}
          {view === "settings" && (
            <SettingsView
              establishments={establishments}
              token={token}
              organizationId={organizationId}
              organizationName={organizationName}
              onRenameOrganization={(newName) => setOrganizationName(newName)}
              onAddEstablishment={(created) => setEstablishments((prev) => [...prev, created])}
              onUpdate={(updated) =>
                setEstablishments((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
