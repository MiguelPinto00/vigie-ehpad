import React, { useState, useMemo, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  BellRing,
  FileDown,
  Search,
  Plus,
  X,
  ChevronRight,
  ShieldCheck,
  Building2,
  Loader2,
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

const SUPABASE_URL = "https://uhyiwqsyyikwguvlfira.supabase.co";
const SUPABASE_KEY = "sb_publishable_ggavuXHi0hGp1KSAS2edUw_jHIHY8Bf";

const supabaseHeaders = {
  apikey: SUPABASE_KEY,
  Authorization: "Bearer " + SUPABASE_KEY,
  "Content-Type": "application/json",
};

async function fetchEstablishments() {
  const res = await fetch(SUPABASE_URL + "/rest/v1/establishments?select=*", {
    headers: supabaseHeaders,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error("establishments " + res.status + " - " + body.slice(0, 200));
  }
  return res.json();
}

async function fetchStaff() {
  const res = await fetch(SUPABASE_URL + "/rest/v1/staff?select=*", {
    headers: supabaseHeaders,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error("staff " + res.status + " - " + body.slice(0, 200));
  }
  return res.json();
}

async function insertStaff(row) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/staff", {
    method: "POST",
    headers: { ...supabaseHeaders, Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error("Erreur d'enregistrement");
  const data = await res.json();
  return data[0];
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
            width: 26,
            height: 26,
            borderRadius: 5,
            background: "rgba(255,255,255,0.14)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ShieldCheck size={15} color="#fff" strokeWidth={2.25} />
        </div>
        <span style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: "#fff" }}>
          Vigie
        </span>
      </div>
      <NavItem icon={LayoutDashboard} label="Tableau de bord" active={view === "dashboard"} onClick={() => setView("dashboard")} />
      <NavItem icon={Users} label="Salaries" active={view === "staff"} onClick={() => setView("staff")} />
      <NavItem icon={BellRing} label="Alertes" active={view === "alerts"} onClick={() => setView("alerts")} />
      <NavItem icon={FileDown} label="Rapports" active={view === "reports"} onClick={() => setView("reports")} />
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

function AddStaffModal({ onClose, onAdd, establishments }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [site, setSite] = useState(establishments[0]?.id || "");
  const [vaccine, setVaccine] = useState("Grippe");
  const [status, setStatus] = useState("a_venir");
  const [saving, setSaving] = useState(false);

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
    await onAdd({
      name: name.trim(),
      role: role.trim(),
      establishment_id: site,
      vaccine,
      status,
      updated_label: status === "conforme" ? new Date().toLocaleDateString("fr-FR") : "-",
      next_label: status === "non_conforme" ? "Retard" : status === "a_venir" ? "A definir" : "-",
    });
    setSaving(false);
    onClose();
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
            Ajouter un salarie
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
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

function StaffView({ staff, onAddStaff, establishments }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);

  const filtered = useMemo(() => {
    return staff.filter((s) => {
      const matchQuery = s.name.toLowerCase().includes(query.toLowerCase());
      const matchFilter = filter === "all" || s.status === filter;
      return matchQuery && matchFilter;
    });
  }, [staff, query, filter]);

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

      {showModal && <AddStaffModal onClose={() => setShowModal(false)} onAdd={onAddStaff} establishments={establishments} />}

      <div style={{ background: "#fff", border: "1px solid " + TOKENS.line, borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'IBM Plex Sans', sans-serif" }}>
          <thead>
            <tr style={{ background: TOKENS.paperDim, borderBottom: "1px solid " + TOKENS.line }}>
              {["Nom", "Fonction", "Etablissement", "Vaccin", "Statut", "Derniere MaJ", "Echeance"].map((h) => (
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AlertsView({ staff, establishments }) {
  const alerts = staff.filter((s) => s.status !== "conforme");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {alerts.map((s) => {
        const isOverdue = s.status === "non_conforme";
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
            </div>
            <button
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid " + TOKENS.line,
                background: TOKENS.paperDim,
                color: TOKENS.ink,
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: 12.5,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Relancer par email
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ReportsView() {
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
        style={{
          padding: "9px 18px",
          borderRadius: 6,
          border: "none",
          background: TOKENS.brand,
          color: "#fff",
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontSize: 13.5,
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        Generer le PDF
      </button>
    </div>
  );
}

export default function VigiePrototype() {
  const [view, setView] = useState("dashboard");
  const [staff, setStaff] = useState([]);
  const [establishments, setEstablishments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [estabRows, staffRows] = await Promise.all([fetchEstablishments(), fetchStaff()]);
        if (!cancelled) {
          setEstablishments(estabRows);
          setStaff(staffRows.map(mapStaffRow));
        }
      } catch (err) {
        console.error("Erreur de chargement Supabase:", err);
        if (!cancelled) setError("Erreur technique : " + (err.message || String(err)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAddStaff = async (newStaffRow) => {
    try {
      const inserted = await insertStaff(newStaffRow);
      setStaff((prev) => [...prev, mapStaffRow(inserted)]);
    } catch (err) {
      console.error("Erreur de sauvegarde Supabase:", err);
      setError("Echec de l'enregistrement du salarie. Reessayez.");
    }
  };

  const titles = {
    dashboard: "Tableau de bord",
    staff: "Salaries",
    alerts: "Alertes",
    reports: "Rapports",
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
                MG
              </div>
              Groupe EHPAD Rhône Solidarité
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
          {view === "staff" && <StaffView staff={staff} onAddStaff={handleAddStaff} establishments={establishments} />}
          {view === "alerts" && <AlertsView staff={staff} establishments={establishments} />}
          {view === "reports" && <ReportsView />}
        </div>
      </div>
    </div>
  );
}
