import React, { useState, useRef, useCallback, useEffect } from "react";
import { setCurrentUserId, uploadVideo, deleteVideo, getStorageUsage, uploadPhoto, deletePhoto, migratePhotoIfNeeded } from "./supabase.js";

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return React.createElement("div", { style: { padding: 40, color: "#ef4444", background: "#0a0a0c", minHeight: "100vh", fontFamily: "monospace" } },
      React.createElement("h2", null, "Erreur:"),
      React.createElement("pre", { style: { whiteSpace: "pre-wrap", fontSize: 13 } }, this.state.error.toString()),
      React.createElement("pre", { style: { whiteSpace: "pre-wrap", fontSize: 11, color: "#888", marginTop: 10 } }, this.state.error.stack)
    );
    return this.props.children;
  }
}

const AVAILABILITY = {
  available: { label: "Dispo", color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  pending: { label: "En attente", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  unavailable: { label: "Indispo", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
};

const SOURCES = ["Agence", "Contact perso", "Instagram"];

const HAIR_COLORS = ["Noir", "Brun", "Châtain", "Blond", "Roux", "Gris", "Blanc", "Coloré", "Chauve"];

const PROFILE_TYPES = ["Acteur", "Modèle", "Figurant"];

const SELECTION = {
  yes: { label: "Oui", color: "#22c55e", bg: "rgba(34,197,94,0.12)", icon: "✓" },
  maybe: { label: "Peut-être", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", icon: "?" },
  no: { label: "Non", color: "#ef4444", bg: "rgba(239,68,68,0.12)", icon: "✕" },
};

const CONTACT_STATUS = {
  not_contacted: { label: "Non contacté", color: "#666", bg: "rgba(255,255,255,0.03)", icon: "○" },
  contacted: { label: "Contacté", color: "#60a5fa", bg: "rgba(59,130,246,0.12)", icon: "✉" },
  waiting: { label: "En attente", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", icon: "⏳" },
  confirmed: { label: "Confirmé", color: "#22c55e", bg: "rgba(34,197,94,0.12)", icon: "✓" },
};

const CONTACT_METHODS = {
  email_actor: { label: "Email acteur", icon: "✉" },
  email_agency: { label: "Email agence", icon: "✉" },
  phone: { label: "Téléphone", icon: "☎" },
};

const SLOT_AVAILABILITY = {
  pending: { label: "En attente", color: "#666", bg: "rgba(255,255,255,0.03)", icon: "⏳" },
  invited: { label: "Convoqué", color: "#f59e0b", bg: "rgba(245,158,11,0.1)", icon: "📨" },
  dispo: { label: "Confirmé", color: "#22c55e", bg: "rgba(34,197,94,0.1)", icon: "✓" },
  not_dispo: { label: "Indisponible", color: "#ef4444", bg: "rgba(239,68,68,0.1)", icon: "✕" },
};

const ROLE_COLORS = [
  { color: "#c9a44a", bg: "rgba(201,164,74,0.08)", border: "rgba(201,164,74,0.4)" },
  { color: "#60a5fa", bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.4)" },
  { color: "#a855f7", bg: "rgba(168,85,247,0.08)", border: "rgba(168,85,247,0.4)" },
  { color: "#f472b6", bg: "rgba(244,114,182,0.08)", border: "rgba(244,114,182,0.4)" },
  { color: "#34d399", bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.4)" },
  { color: "#fb923c", bg: "rgba(251,146,60,0.08)", border: "rgba(251,146,60,0.4)" },
  { color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.4)" },
  { color: "#38bdf8", bg: "rgba(56,189,248,0.08)", border: "rgba(56,189,248,0.4)" },
  { color: "#a3e635", bg: "rgba(163,230,53,0.08)", border: "rgba(163,230,53,0.4)" },
  { color: "#e879f9", bg: "rgba(232,121,249,0.08)", border: "rgba(232,121,249,0.4)" },
];

const DEFAULT_ROLES = ["Rôle principal", "Second rôle"];

const CASTING_PASS_STATUS = {
  not_yet: { label: "Pas encore", color: "#f59e0b", bg: "rgba(245,158,11,0.1)", icon: "⏳" },
  passed: { label: "Passé", color: "#22c55e", bg: "rgba(34,197,94,0.1)", icon: "✓" },
  absent: { label: "Absent", color: "#ef4444", bg: "rgba(239,68,68,0.1)", icon: "✕" },
};

const PROJET_SEX_OPTS = ["Homme", "Femme", "Non-binaire"];
const PROJET_AGE_OPTS = ["Enfant", "Ado", "Jeune adulte", "Adulte", "Senior"];
const PROJET_ETH_OPTS = ["Toutes", "Caucasien", "Noir / Afro", "Maghrébin / Moyen-Orient", "Asiatique", "Latino / Hispanique", "Métis", "Indien / Sud-asiatique"];
const PROJET_TYPE_OPTS = ["Acteur", "Comédien·ne·s", "Modèle·s", "Figurant", "Danseur·se·s", "Autres"];
const PROJET_STYLE_OPTS = ["Comédie", "Drame", "Autres"];
const PROJET_SALARY_OPTS = [{ value: "facture", label: "Facture" }, { value: "fiche_paie", label: "Fiche de paie" }];


const compressImage = (dataUrl, maxWidth = 600, quality = 0.7) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width, h = img.height;
      if (w > maxWidth) { h = (maxWidth / w) * h; w = maxWidth; }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl); // fallback to original
    img.src = dataUrl;
  });
};

const fmtDateFR = (d) => { if (!d) return null; try { return new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }); } catch(e) { return d; } };

const getEmbedUrl = (url) => {
  if (!url || typeof url !== "string") return null;
  try {
    // Google Drive: drive.google.com/file/d/FILE_ID/view → /preview
    const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (driveMatch) return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
    // YouTube: youtube.com/watch?v=ID or youtu.be/ID
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
    // Vimeo: vimeo.com/ID
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    return null;
  } catch(e) { return null; }
};

const EmbedPlayer = ({ url, height = 180 }) => {
  const embedUrl = getEmbedUrl(url);
  if (!embedUrl) return <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa", fontSize: 12, textDecoration: "none" }}>▶ {url.length > 40 ? url.slice(0, 40) + "..." : url}</a>;
  return <iframe src={embedUrl} style={{ width: "100%", height, borderRadius: 8, border: "1px solid #2a2a2e", background: "#000" }} allow="autoplay; encrypted-media" allowFullScreen frameBorder="0" />;
};

const INITIAL_STATE = {
  projectName: "",
  roles: [],
  profiles: {},
  selections: {},
  contacts: {},
  castingDays: [],
  castingSessions: {},
  finalSelections: {},
  finalContacts: {},
  gmailLabel: "",
  emailLog: [], // { id, to, toName, subject, sentAt, role, type }
  started: false,
  projectInfo: {
    production: "", director: "", photographer: "",
    salary: { amount: "", type: "facture" },
    shootingDays: "",
    dateTournageDe: "", dateTournageA: "", dateRenduProfils: "", datePPM: "",
    castingDates: [], dateValidation: "", customDates: [],
    documents: [], castingSheets: [], customEthnicities: [],
    devis: { fields: {}, lines: [] },
  },
  roleDetails: {},
};

// ---- Utility Components ----

function StatusBadge({ status, onClick }) {
  const s = AVAILABILITY[status] || AVAILABILITY.available;
  return (
    <button
      onClick={onClick}
      style={{
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.color}33`,
        borderRadius: 20,
        padding: "4px 14px",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "inherit",
        letterSpacing: "0.02em",
        transition: "all 0.2s",
      }}
    >
      {s.label}
    </button>
  );
}

function PhotoSlot({ src, onAdd, onRemove, size = 90 }) {
  if (src) {
    return (
      <div style={{ position: "relative", width: size, height: size * 1.25, borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
        <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <button
          onClick={onRemove}
          style={{
            position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.7)", color: "#fff",
            border: "none", borderRadius: "50%", width: 22, height: 22, cursor: "pointer",
            fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit",
          }}
        >
          ×
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={onAdd}
      style={{
        width: size, height: size * 1.25, borderRadius: 8, border: "1.5px dashed #444",
        background: "rgba(255,255,255,0.02)", cursor: "pointer", display: "flex",
        alignItems: "center", justifyContent: "center", color: "#555", fontSize: 28,
        flexShrink: 0, transition: "border-color 0.2s",
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "#888"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "#444"}
    >
      +
    </button>
  );
}

// ---- Modal Component ----

function Modal({ open, onClose, title, children, width = 600 }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(6px)", animation: "fadeIn 0.2s ease",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#1a1a1e", borderRadius: 16, padding: "32px 36px",
          width: "90%", maxWidth: width, maxHeight: "85vh", overflowY: "auto",
          border: "1px solid #2a2a2e", boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f0f0f0", letterSpacing: "-0.01em" }}>{title}</h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#666", fontSize: 24, cursor: "pointer", fontFamily: "inherit" }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, type = "text", textarea = false }) {
  const shared = {
    value: value || "",
    onChange: e => onChange(e.target.value),
    placeholder,
    type,
    style: {
      width: "100%", padding: "10px 14px", background: "#111114", border: "1px solid #2a2a2e",
      borderRadius: 10, color: "#e0e0e0", fontSize: 14, fontFamily: "'DM Sans', sans-serif",
      outline: "none", resize: textarea ? "vertical" : "none",
      transition: "border-color 0.2s",
    },
    onFocus: e => e.target.style.borderColor = "#c9a44a",
    onBlur: e => e.target.style.borderColor = "#2a2a2e",
  };
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 6, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {label}
      </label>
      {textarea ? <textarea rows={3} {...shared} /> : <input {...shared} />}
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 6, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {label}
      </label>
      <select
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        style={{
          width: "100%", padding: "10px 14px", background: "#111114", border: "1px solid #2a2a2e",
          borderRadius: 10, color: "#e0e0e0", fontSize: 14, fontFamily: "'DM Sans', sans-serif",
          outline: "none", appearance: "none", cursor: "pointer",
        }}
      >
        <option value="">— Sélectionner —</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

// ---- Profile Card ----

function ProfileCard({ profile, onEdit, onStatusChange, viewMode }) {
  const mainPhoto = profile.photos?.[0];
  const statusKeys = Object.keys(AVAILABILITY);
  const nextStatus = () => {
    const idx = statusKeys.indexOf(profile.availability);
    return statusKeys[(idx + 1) % statusKeys.length];
  };
  const showContacts = viewMode === "director" || profile.shareContacts;
  const hasContacts = profile.email || profile.phone || profile.agencyEmail;
  const av = AVAILABILITY[profile.availability] || AVAILABILITY.available;
  const tapes = (profile.selftapeLinks || []).filter(l => l).length + (profile.selftapeVideos || []).length;

  return (
    <div
      onClick={onEdit}
      style={{
        cursor: "pointer", display: "grid", gridTemplateColumns: "130px 1fr",
        background: "#0c0c0e", borderRadius: 3, overflow: "hidden",
        border: "1px solid #1a1a1e", transition: "all 0.3s", minHeight: 180,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#c9a44a33"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.4)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#1a1a1e"; e.currentTarget.style.boxShadow = ""; }}
    >
      {/* Photo */}
      <div style={{ position: "relative", overflow: "hidden" }}>
        {mainPhoto ? (
          <img src={mainPhoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "#111114", display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: 32 }}>◎</div>
        )}
        <div style={{ position: "absolute", bottom: 6, left: 6 }} onClick={e => e.stopPropagation()}>
          <button onClick={() => onStatusChange(nextStatus())} style={{ padding: "2px 7px", background: "rgba(0,0,0,0.7)", borderRadius: 2, border: "none", fontSize: 8, color: av.color, fontWeight: 700, letterSpacing: "0.1em", backdropFilter: "blur(4px)", cursor: "pointer", fontFamily: "inherit" }}>● {av.label.toUpperCase()}</button>
        </div>
      </div>
      {/* Info */}
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", justifyContent: "center", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 900, color: "#fff", fontFamily: "'Bebas Neue','DM Sans',sans-serif", letterSpacing: "0.03em", lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {[profile.firstName, profile.name].filter(Boolean).join(" ") || "Sans nom"}
            </div>
            <div style={{ fontSize: 13, color: "#777", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {[profile.age ? profile.age + " ans" : null, profile.height, profile.hairColor, profile.measurements].filter(Boolean).join(" · ") || "—"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
            {profile.saveToCastingFile && <span style={{ fontSize: 11, color: "#a855f7" }} title="Fichier casting">📁</span>}
            {profile.shareContacts && <span style={{ fontSize: 11, color: "#22c55e" }} title="Contacts partagés">🔓</span>}
          </div>
        </div>
        {/* Agency */}
        {profile.agency && (
          <div style={{ fontSize: 13, color: "#c9a44a", fontWeight: 700, marginBottom: 5, display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 1, background: "#c9a44a", flexShrink: 0 }} />{profile.agency}
          </div>
        )}
        {/* Type + level + source */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
          {profile.profileType && <span style={{ fontSize: 10, padding: "3px 9px", background: "rgba(168,85,247,0.1)", borderRadius: 3, color: "#a855f7", fontWeight: 700, textTransform: "uppercase" }}>{profile.profileType}</span>}
          {profile.actingLevel > 0 && <div style={{ display: "flex", gap: 2 }}>{[1,2,3,4,5].map(n => <div key={n} style={{ width: 12, height: 2, background: n <= profile.actingLevel ? "#c9a44a" : "#222" }} />)}</div>}
          <span style={{ fontSize: 9, color: "#444", fontWeight: 600, marginLeft: "auto" }}>{profile.source || "—"}</span>
        </div>
        {/* Bottom row */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 5, borderTop: "1px solid #1a1a1e", alignItems: "center" }}>
          {tapes > 0 && <span style={{ fontSize: 9, color: "#60a5fa", fontWeight: 600 }}>▶ {tapes} selftape{tapes > 1 ? "s" : ""}</span>}
          {hasContacts && showContacts && (
            <>
              {profile.email && <span style={{ fontSize: 9, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 130 }}>✉ {profile.email}</span>}
              {profile.phone && <span style={{ fontSize: 9, color: "#888" }}>☎ {profile.phone}</span>}
            </>
          )}
          {hasContacts && !showContacts && <span style={{ fontSize: 9, color: "#444" }}>🔒</span>}
        </div>
      </div>
    </div>
  );
}

// ---- Profile Form Modal ----

function VideoThumbnail({ video, onRemove, index }) {
  const vidRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  return (
    <div style={{
      position: "relative", width: 140, height: 90, borderRadius: 8,
      overflow: "hidden", flexShrink: 0, background: "#0c0c0e",
      border: "1px solid #2a2a2e",
    }}>
      <video
        ref={vidRef}
        src={video.data}
        style={{ width: "100%", height: "100%", objectFit: "cover", opacity: loaded ? 1 : 0 }}
        muted
        preload="metadata"
        playsInline
        onLoadedData={() => { setLoaded(true); if (vidRef.current) vidRef.current.currentTime = 0.5; }}
      />
      {!loaded && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          color: "#444", fontSize: 11,
        }}>
          Chargement...
        </div>
      )}
      <div style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.3)", pointerEvents: "none",
      }}>
        <span style={{ fontSize: 24, color: "#fff", opacity: 0.8 }}>▶</span>
      </div>
      <div style={{
        position: "absolute", bottom: 4, left: 6, fontSize: 9, color: "#ccc",
        background: "rgba(0,0,0,0.6)", padding: "2px 6px", borderRadius: 4,
        fontWeight: 500, letterSpacing: "0.03em",
      }}>
        Essai {index + 1}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(e); }}
        style={{
          position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.7)", color: "#fff",
          border: "none", borderRadius: "50%", width: 20, height: 20, cursor: "pointer",
          fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit",
        }}
      >
        ×
      </button>
    </div>
  );
}

function VideoPlayer({ video, onClose }) {
  const [error, setError] = useState(false);
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 2000,
        display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(8px)", cursor: "pointer",
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{ maxWidth: "90%", maxHeight: "85vh", position: "relative" }}>
        {error ? (
          <div style={{
            padding: "40px 60px", background: "#1a1a1e", borderRadius: 12,
            color: "#888", textAlign: "center",
          }}>
            <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.5 }}>⚠</div>
            <div style={{ fontSize: 14, marginBottom: 8 }}>Impossible de lire cette vidéo</div>
            <div style={{ fontSize: 12, color: "#555" }}>{video.name}</div>
          </div>
        ) : (
          <video
            src={video.data}
            type={video.type || "video/mp4"}
            controls
            autoPlay
            playsInline
            onError={() => setError(true)}
            style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: 12, background: "#000" }}
          />
        )}
        <div style={{
          textAlign: "center", marginTop: 10, fontSize: 13, color: "#aaa", fontWeight: 500,
        }}>
          {video.name}
        </div>
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: -12, right: -12, background: "#222", color: "#fff",
            border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer",
            fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit",
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}

function ProfileForm({ profile, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({ ...profile });
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const [addingPhotoIdx, setAddingPhotoIdx] = useState(null);
  const [playingVideo, setPlayingVideo] = useState(null);

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const [videoUploading, setVideoUploading] = useState(false);

  const handleVideoUploadLocal = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setVideoUploading(true);
    for (const file of files) {
      try {
        const result = await uploadVideo(file, "casting", form.id || "unknown");
        const videos = [...(form.selftapeVideos || [])];
        videos.push({
          data: result.url,
          url: result.url,
          storagePath: result.path,
          name: file.name,
          size: file.size,
          type: file.type,
          uploadedAt: result.uploadedAt,
        });
        setForm(prev => ({ ...prev, selftapeVideos: videos }));
      } catch (err) {
        alert("Erreur upload vidéo: " + (err.message || "échec"));
      }
    }
    setVideoUploading(false);
    e.target.value = "";
  }, [form.selftapeVideos, form.id]);

  const removeVideo = async (idx) => {
    const video = (form.selftapeVideos || [])[idx];
    if (video?.storagePath) {
      try { await deleteVideo(video.storagePath); } catch (e) {}
    }
    const videos = [...(form.selftapeVideos || [])];
    videos.splice(idx, 1);
    setForm(prev => ({ ...prev, selftapeVideos: videos }));
  };

  const handlePhotoUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    (async () => {
      try {
        const profileId = form.id || form.name || "profile";
        const projId = "default";
        const idx = (addingPhotoIdx !== null && addingPhotoIdx < (form.photos || []).length) ? addingPhotoIdx : (form.photos || []).length;
        const { url } = await uploadPhoto(file, projId, profileId, idx);
        const photos = [...(form.photos || [])];
        if (addingPhotoIdx !== null && addingPhotoIdx < photos.length) {
          photos[addingPhotoIdx] = url;
        } else {
          photos.push(url);
        }
        setForm(prev => ({ ...prev, photos }));
      } catch (err) {
        console.error("[handlePhotoUpload] Supabase failed, falling back to base64:", err.message);
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const compressed = await compressImage(ev.target.result, 600, 0.7);
          const photos = [...(form.photos || [])];
          if (addingPhotoIdx !== null && addingPhotoIdx < photos.length) {
            photos[addingPhotoIdx] = compressed;
          } else {
            photos.push(compressed);
          }
          setForm(prev => ({ ...prev, photos }));
        };
        reader.readAsDataURL(file);
      }
    })();
    e.target.value = "";
  }, [form.photos, addingPhotoIdx, form.id, form.name]);

  const removePhoto = (idx) => {
    const photos = [...(form.photos || [])];
    photos.splice(idx, 1);
    setForm(prev => ({ ...prev, photos }));
  };

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoUpload} />
      <input ref={videoRef} type="file" accept="video/*" multiple style={{ display: "none" }} onChange={handleVideoUploadLocal} />

      {/* Photos row */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 10, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Photos
        </label>
        <div style={{ display: "flex", gap: 10 }}>
          {[0, 1, 2].map(i => (
            <PhotoSlot
              key={i}
              src={form.photos?.[i]}
              onAdd={() => { setAddingPhotoIdx(i); fileRef.current?.click(); }}
              onRemove={() => removePhoto(i)}
            />
          ))}
        </div>
        {/* Photo URL import */}
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <input placeholder="📎 Coller une URL d'image..."
            style={{ flex: 1, padding: "6px 10px", background: "#0c0c0e", border: "1px solid #2a2a2e", borderRadius: 6, color: "#e0e0e0", fontSize: 10, fontFamily: "'DM Sans',sans-serif", outline: "none" }}
            onKeyDown={e => {
              if (e.key === "Enter" && e.target.value.trim()) {
                update("photos", [...(form.photos || []), e.target.value.trim()].slice(0, 3));
                e.target.value = "";
              }
            }} />
          <button type="button" onClick={e => {
            const inp = e.target.previousSibling;
            if (inp?.value?.trim()) { update("photos", [...(form.photos || []), inp.value.trim()].slice(0, 3)); inp.value = ""; }
          }}
            style={{ padding: "6px 10px", background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 6, color: "#a855f7", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
            + URL
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
        <InputField label="Prénom" value={form.firstName} onChange={v => update("firstName", v)} placeholder="Prénom" />
        <InputField label="Nom" value={form.name} onChange={v => update("name", v)} placeholder="Nom" />
        <InputField label="Âge" value={form.age} onChange={v => update("age", v)} placeholder="25" />
        <InputField label="Taille" value={form.height} onChange={v => update("height", v)} placeholder="175cm" />
        <InputField label="Mensurations" value={form.measurements} onChange={v => update("measurements", v)} placeholder="90-60-90, pointure 42..." />
        <SelectField label="Couleur de cheveux" value={form.hairColor} onChange={v => update("hairColor", v)} options={HAIR_COLORS} />
        <SelectField label="Type" value={form.profileType} onChange={v => update("profileType", v)} options={PROFILE_TYPES} />
        <SelectField label="Source" value={form.source} onChange={v => update("source", v)} options={SOURCES} />
        <SelectField label="Disponibilité" value={form.availability} onChange={v => update("availability", v)} options={Object.keys(AVAILABILITY)} />
        <InputField label="Agence" value={form.agency} onChange={v => update("agency", v)} placeholder="Nom de l'agence" />
      </div>

      {/* Acting level */}
      <div style={{ marginTop: 8, marginBottom: 8 }}>
        <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Niveau de jeu
        </label>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => update("actingLevel", form.actingLevel === n ? 0 : n)}
              style={{
                width: 36, height: 36, borderRadius: 8, border: "none", cursor: "pointer",
                fontSize: 18, fontFamily: "inherit", transition: "all 0.2s",
                background: n <= (form.actingLevel || 0) ? "rgba(201,164,74,0.15)" : "rgba(255,255,255,0.02)",
                color: n <= (form.actingLevel || 0) ? "#c9a44a" : "#333",
              }}
            >
              ★
            </button>
          ))}
          <span style={{ fontSize: 11, color: "#555", marginLeft: 6 }}>
            {form.actingLevel ? `${form.actingLevel}/5` : "Non noté"}
          </span>
        </div>
      </div>

      {/* Selftape Links section */}
      <div style={{
        margin: "16px 0", padding: "16px 20px", background: "rgba(255,255,255,0.02)",
        borderRadius: 12, border: "1px solid #1e1e22",
      }}>
        <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 12, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Selftapes — Liens ({(form.selftapeLinks || []).length})
        </label>
        {(form.selftapeLinks || []).map((link, i) => (
          <React.Fragment key={i}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#c9a44a", fontWeight: 600, minWidth: 52 }}>Essai {i + 1}</span>
              <input
                value={link}
                onChange={e => {
                  const links = [...(form.selftapeLinks || [])];
                  links[i] = e.target.value;
                  update("selftapeLinks", links);
                }}
                placeholder="https://drive.google.com/... ou https://youtube.com/..."
                style={{
                  flex: 1, padding: "8px 12px", background: "#111114", border: "1px solid #2a2a2e",
                  borderRadius: 8, color: "#e0e0e0", fontSize: 13, fontFamily: "'DM Sans', sans-serif",
                  outline: "none",
                }}
                onFocus={e => e.target.style.borderColor = "#c9a44a"}
                onBlur={e => e.target.style.borderColor = "#2a2a2e"}
              />
              <button
                onClick={() => {
                  const links = [...(form.selftapeLinks || [])];
                  links.splice(i, 1);
                  update("selftapeLinks", links);
                }}
                style={{
                  background: "none", border: "none", color: "#555", cursor: "pointer",
                  fontSize: 18, fontFamily: "inherit", padding: "0 4px",
                }}
              >
                ×
              </button>
            </div>
            {link && getEmbedUrl(link) && (
              <div style={{ marginBottom: 12, marginLeft: 60 }}>
                <EmbedPlayer url={link} height={160} />
              </div>
            )}
          </React.Fragment>
        ))}
        <button
          onClick={() => update("selftapeLinks", [...(form.selftapeLinks || []), ""])}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
            background: "transparent", border: "1px dashed #333", borderRadius: 8,
            color: "#888", cursor: "pointer", fontSize: 12, fontFamily: "inherit",
            fontWeight: 500, transition: "all 0.2s", marginTop: 4,
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "#c9a44a"; e.currentTarget.style.color = "#c9a44a"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "#333"; e.currentTarget.style.color = "#888"; }}
        >
          + Ajouter un lien selftape
        </button>
      </div>

      {/* Contact info section */}
      <div style={{
        margin: "20px 0 16px", padding: "20px", background: "rgba(255,255,255,0.02)",
        borderRadius: 12, border: "1px solid #1e1e22",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: "#888", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>🔒</span> Coordonnées privées
          </label>
          <label style={{
            display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
            fontSize: 12, color: form.shareContacts ? "#22c55e" : "#555", fontWeight: 500,
            transition: "color 0.2s",
          }}>
            <div
              onClick={() => update("shareContacts", !form.shareContacts)}
              style={{
                width: 36, height: 20, borderRadius: 10, padding: 2,
                background: form.shareContacts ? "#22c55e" : "#333",
                cursor: "pointer", transition: "background 0.2s",
                display: "flex", alignItems: "center",
              }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: "50%", background: "#fff",
                transition: "transform 0.2s",
                transform: form.shareContacts ? "translateX(16px)" : "translateX(0)",
              }} />
            </div>
            Visible par la production
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
          <InputField label="Email" value={form.email} onChange={v => update("email", v)} placeholder="acteur@email.com" type="email" />
          <InputField label="Téléphone" value={form.phone} onChange={v => update("phone", v)} placeholder="+33 6 12 34 56 78" type="tel" />
        </div>
        <InputField label="Email de l'agence" value={form.agencyEmail} onChange={v => update("agencyEmail", v)} placeholder="booking@agence.com" type="email" />
      </div>

      {/* Selftape Videos Upload */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 4, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Selftapes — Vidéos ({(form.selftapeVideos || []).length} fichier{(form.selftapeVideos || []).length !== 1 ? "s" : ""})
        </label>
        <div style={{ fontSize: 10, color: "#555", marginBottom: 10, fontStyle: "italic" }}>
          Les vidéos sont sauvegardées en ligne (1 GB gratuit)
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {(form.selftapeVideos || []).map((video, i) => (
            <div key={i} onClick={() => setPlayingVideo(video)} style={{ cursor: "pointer" }}>
              <VideoThumbnail video={video} index={i} onRemove={(e) => { e?.stopPropagation(); removeVideo(i); }} />
            </div>
          ))}
          <button
            onClick={() => !videoUploading && videoRef.current?.click()}
            disabled={videoUploading}
            style={{
              width: 140, height: 90, borderRadius: 8, border: "1.5px dashed #444",
              background: "rgba(255,255,255,0.02)", cursor: "pointer", display: "flex",
              flexDirection: "column", alignItems: "center", justifyContent: "center",
              color: "#555", fontSize: 13, fontFamily: "inherit", gap: 4,
              transition: "border-color 0.2s",
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "#c9a44a"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "#444"}
          >
            <span style={{ fontSize: 22 }}>{videoUploading ? "⏳" : "+"}</span>
            <span style={{ fontSize: 10, letterSpacing: "0.03em" }}>{videoUploading ? "Upload..." : "Ajouter vidéo"}</span>
          </button>
        </div>
      </div>

      <InputField label="Notes" value={form.notes} onChange={v => update("notes", v)} placeholder="Remarques, commentaires..." textarea />

      {playingVideo && <VideoPlayer video={playingVideo} onClose={() => setPlayingVideo(null)} />}

      {/* Save to casting file checkbox */}
      <div
        onClick={() => update("saveToCastingFile", !form.saveToCastingFile)}
        style={{
          display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
          background: form.saveToCastingFile ? "rgba(201,164,74,0.06)" : "rgba(255,255,255,0.02)",
          border: form.saveToCastingFile ? "1px solid rgba(201,164,74,0.3)" : "1px solid #1e1e22",
          borderRadius: 12, cursor: "pointer", marginTop: 16, transition: "all 0.2s",
        }}
      >
        <div style={{
          width: 20, height: 20, borderRadius: 6, display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 12, fontWeight: 700,
          background: form.saveToCastingFile ? "#c9a44a" : "transparent",
          border: form.saveToCastingFile ? "none" : "2px solid #444",
          color: form.saveToCastingFile ? "#000" : "transparent",
          transition: "all 0.2s",
        }}>✓</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: form.saveToCastingFile ? "#c9a44a" : "#999" }}>
            📁 Enregistrer dans mon fichier casting
          </div>
          <div style={{ fontSize: 10, color: "#555" }}>
            Ce profil sera sauvegardé dans votre base de données permanente
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, gap: 12 }}>
        <div>
          {onDelete && (
            <button
              onClick={onDelete}
              style={{
                padding: "10px 20px", background: "rgba(239,68,68,0.1)", color: "#ef4444",
                border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, cursor: "pointer",
                fontSize: 13, fontWeight: 600, fontFamily: "inherit",
              }}
            >
              Supprimer
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 24px", background: "transparent", color: "#888",
              border: "1px solid #333", borderRadius: 10, cursor: "pointer",
              fontSize: 13, fontWeight: 500, fontFamily: "inherit",
            }}
          >
            Annuler
          </button>
          <button
            onClick={() => onSave(form)}
            style={{
              padding: "10px 28px", background: "linear-gradient(135deg, #c9a44a, #a67c2e)",
              color: "#000", border: "none", borderRadius: 10, cursor: "pointer",
              fontSize: 13, fontWeight: 700, fontFamily: "inherit", letterSpacing: "0.02em",
            }}
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Start Screen ----

function StartScreen({ onStart }) {
  const [projectName, setProjectName] = useState("");
  const [roles, setRoles] = useState(DEFAULT_ROLES);
  const [newRole, setNewRole] = useState("");

  const addRole = () => {
    if (newRole.trim() && !roles.includes(newRole.trim())) {
      setRoles([...roles, newRole.trim()]);
      setNewRole("");
    }
  };

  const removeRole = (idx) => {
    setRoles(roles.filter((_, i) => i !== idx));
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#0a0a0c",
    }}>
      <div style={{
        width: "90%", maxWidth: 520, padding: "48px 44px",
        background: "#111114", borderRadius: 20, border: "1px solid #1e1e22",
        boxShadow: "0 32px 100px rgba(0,0,0,0.5)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.25em", textTransform: "uppercase", color: "#c9a44a", fontWeight: 600, marginBottom: 12 }}>
            Casting Director
          </div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#f0f0f0", letterSpacing: "-0.02em" }}>
            Nouveau Projet
          </h1>
        </div>

        <InputField label="Nom du projet" value={projectName} onChange={setProjectName} placeholder="Ex: Pub Nike — Été 2026" />

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 10, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Rôles ({roles.length})
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {roles.map((role, i) => (
              <span key={i} style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "rgba(201,164,74,0.08)", color: "#c9a44a",
                border: "1px solid rgba(201,164,74,0.2)", borderRadius: 8,
                padding: "6px 14px", fontSize: 13, fontWeight: 500,
              }}>
                {role}
                <button
                  onClick={() => removeRole(i)}
                  style={{ background: "none", border: "none", color: "#c9a44a88", cursor: "pointer", fontSize: 16, padding: 0, fontFamily: "inherit" }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={newRole}
              onChange={e => setNewRole(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addRole()}
              placeholder="Ajouter un rôle..."
              style={{
                flex: 1, padding: "10px 14px", background: "#0a0a0c", border: "1px solid #2a2a2e",
                borderRadius: 10, color: "#e0e0e0", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none",
              }}
            />
            <button
              onClick={addRole}
              style={{
                padding: "10px 18px", background: "#1e1e22", color: "#ccc",
                border: "1px solid #333", borderRadius: 10, cursor: "pointer",
                fontSize: 13, fontWeight: 600, fontFamily: "inherit",
              }}
            >
              +
            </button>
          </div>
        </div>

        <button
          onClick={() => projectName.trim() && roles.length > 0 && onStart(projectName.trim(), roles)}
          disabled={!projectName.trim() || roles.length === 0}
          style={{
            width: "100%", padding: "14px", marginTop: 24,
            background: projectName.trim() && roles.length > 0
              ? "linear-gradient(135deg, #c9a44a, #a67c2e)"
              : "#222",
            color: projectName.trim() && roles.length > 0 ? "#000" : "#555",
            border: "none", borderRadius: 12, cursor: projectName.trim() && roles.length > 0 ? "pointer" : "not-allowed",
            fontSize: 15, fontWeight: 700, fontFamily: "inherit", letterSpacing: "0.02em",
            transition: "all 0.3s",
          }}
        >
          Commencer le casting →
        </button>
      </div>
    </div>
  );
}

// ---- Selection Badge (shown on cards in director view) ----

function SelectionBadge({ selection }) {
  if (!selection || !selection.choice) return null;
  const s = SELECTION[selection.choice];
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: s.bg, color: s.color, border: `1px solid ${s.color}33`,
      borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 600,
    }}>
      <span>{s.icon}</span> {s.label}
    </div>
  );
}

// ---- Réalisateur Profile Card ----

function RealisateurProfileCard({ profile, selection, onSelect, onComment }) {
  const mainPhoto = profile.photos?.[0];
  const [showComment, setShowComment] = useState(false);
  const [playingVideo, setPlayingVideo] = useState(null);
  const showContacts = profile.shareContacts;
  const hasContacts = profile.email || profile.phone || profile.agencyEmail;
  const hasSelftapes = (profile.selftapeLinks && profile.selftapeLinks.filter(l => l).length > 0) || (profile.selftapeVideos && profile.selftapeVideos.length > 0);
  const av = AVAILABILITY[profile.availability] || AVAILABILITY.available;
  const sel = selection?.choice ? SELECTION[selection.choice] : null;
  const tapes = (profile.selftapeLinks || []).filter(l => l).length + (profile.selftapeVideos || []).length;

  return (
    <div style={{
      background: "#0c0c0e", borderRadius: 3, overflow: "hidden",
      border: sel ? `1px solid ${sel.color}20` : "1px solid #1a1a1e",
      transition: "all 0.3s", display: "grid", gridTemplateColumns: "130px 1fr",
      minHeight: 200,
    }}>
      {/* Photo */}
      <div style={{ position: "relative", overflow: "hidden" }}>
        {mainPhoto ? (
          <img src={mainPhoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "#111114", display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: 32 }}>◎</div>
        )}
        {sel && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: sel.color }} />}
        <div style={{ position: "absolute", bottom: 6, left: 6, padding: "2px 6px", background: "rgba(0,0,0,0.7)", borderRadius: 2, fontSize: 8, color: av.color, fontWeight: 700, letterSpacing: "0.1em", backdropFilter: "blur(4px)" }}>● {av.label.substring(0, 5).toUpperCase()}</div>
        {sel && <div style={{ position: "absolute", top: 6, right: 6, padding: "3px 8px", borderRadius: 3, background: sel.bg, fontSize: 10, fontWeight: 800, color: sel.color }}>{sel.icon} {sel.label}</div>}
      </div>
      {/* Info + actions */}
      <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: "#fff", fontFamily: "'Bebas Neue','DM Sans',sans-serif", letterSpacing: "0.03em", lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {[profile.firstName, profile.name].filter(Boolean).join(" ") || "Sans nom"}
            </div>
            <div style={{ fontSize: 11, color: "#777", marginTop: 3 }}>
              {[profile.age ? profile.age + " ans" : null, profile.height, profile.hairColor].filter(Boolean).join(" · ") || "—"}
            </div>
          </div>
        </div>
        {profile.agency && (
          <div style={{ fontSize: 11, color: "#c9a44a", fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 1, background: "#c9a44a", flexShrink: 0 }} />{profile.agency}
          </div>
        )}
        {profile.measurements && <div style={{ fontSize: 10, color: "#555", marginBottom: 4 }}>{profile.measurements}</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          {profile.profileType && <span style={{ fontSize: 9, padding: "2px 7px", background: "rgba(168,85,247,0.1)", borderRadius: 3, color: "#a855f7", fontWeight: 700, textTransform: "uppercase" }}>{profile.profileType}</span>}
          {profile.actingLevel > 0 && <div style={{ display: "flex", gap: 2 }}>{[1,2,3,4,5].map(n => <div key={n} style={{ width: 12, height: 2, background: n <= profile.actingLevel ? "#c9a44a" : "#222" }} />)}</div>}
        </div>
        {/* Selftapes */}
        {hasSelftapes && (
          <div style={{ marginBottom: 4 }}>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>
              {(profile.selftapeLinks || []).filter(l => l).map((link, i) => (
                <a key={i} href={link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 10, color: "#60a5fa", padding: "3px 8px", background: "rgba(96,165,250,0.08)", borderRadius: 3, textDecoration: "none", fontWeight: 600 }}>▶ Tape {i + 1}</a>
              ))}
              {(profile.selftapeVideos || []).map((v, i) => (
                <button key={i} onClick={() => setPlayingVideo(v)} style={{ fontSize: 10, color: "#c9a44a", padding: "3px 8px", background: "rgba(201,164,74,0.08)", borderRadius: 3, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>⬆ {i + 1}</button>
              ))}
            </div>
            {(profile.selftapeLinks || []).filter(l => l && getEmbedUrl(l)).slice(0, 1).map((link, i) => (
              <div key={i} onClick={e => e.stopPropagation()} style={{ marginTop: 4 }}>
                <EmbedPlayer url={link} height={140} />
              </div>
            ))}
          </div>
        )}
        {/* Contacts */}
        {hasContacts && showContacts && (
          <div style={{ fontSize: 10, color: "#888", marginBottom: 4, display: "flex", gap: 8 }}>
            {profile.email && <span>✉ {profile.email}</span>}
            {profile.phone && <span>☎ {profile.phone}</span>}
          </div>
        )}
        {/* Vote buttons */}
        <div style={{ display: "flex", gap: 4, marginTop: "auto", paddingTop: 6, borderTop: "1px solid #1a1a1e" }}>
          {Object.entries(SELECTION).map(([key, s]) => (
            <button key={key} onClick={() => onSelect(key)} style={{
              flex: 1, padding: "6px 0", borderRadius: 3, fontSize: 10, fontWeight: 800,
              fontFamily: "'Bebas Neue','DM Sans',sans-serif", letterSpacing: "0.08em",
              cursor: "pointer", border: "none", transition: "all 0.2s",
              background: selection?.choice === key ? s.color : "#141416",
              color: selection?.choice === key ? "#000" : "#444",
            }}>{s.icon} {s.label}</button>
          ))}
        </div>
        {/* Comment */}
        <div style={{ marginTop: 6 }}>
          {!showComment && !selection?.comment ? (
            <button onClick={() => setShowComment(true)} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 10, fontFamily: "inherit", padding: 0 }}>+ Commentaire</button>
          ) : (
            <textarea value={selection?.comment || ""} onChange={e => onComment(e.target.value)} autoFocus={showComment && !selection?.comment} placeholder="Commentaire..." rows={2} style={{ width: "100%", padding: "6px 8px", background: "#111114", border: "1px solid #2a2a2e", borderRadius: 4, color: "#ccc", fontSize: 11, fontFamily: "'DM Sans',sans-serif", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
          )}
        </div>
      </div>
      {playingVideo && <VideoPlayer video={playingVideo} onClose={() => setPlayingVideo(null)} />}
    </div>
  );
}

// ---- Contact / Validation Modal ----

function ContactModal({ profile, contact, projectName, onUpdate, onClose }) {
  const [method, setMethod] = useState(contact?.method || "");
  const [status, setStatus] = useState(contact?.status || "not_contacted");
  const [mailSubject, setMailSubject] = useState(contact?.mailSubject || `Casting ${projectName} — Sélection`);
  const [mailDraft, setMailDraft] = useState(contact?.mailDraft || "");
  const [copied, setCopied] = useState(null); // "subject" | "body" | "all"
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState(null);

  const recipientEmail = method === "email_agency" ? profile.agencyEmail : profile.email;
  const recipientLabel = method === "email_agency"
    ? `Agence${profile.agency ? ` (${profile.agency})` : ""}`
    : profile.name || "Acteur";

  const generateMail = async () => {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    setAiError(null);
    try {
      const context = [
        `Tu es l'assistant d'un directeur de casting.`,
        `Projet: "${projectName}"`,
        `Destinataire: ${recipientLabel}${recipientEmail ? ` (${recipientEmail})` : ""}`,
        method === "email_agency" ? `Contact via l'agence: ${profile.agency || "inconnue"}` : `Contact direct avec l'acteur/modèle`,
        profile.name ? `Nom du talent: ${profile.name}` : "",
        profile.age ? `Âge: ${profile.age} ans` : "",
      ].filter(Boolean).join("\n");

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `${context}\n\nRédige un email professionnel en français pour le directeur de casting. Le mail doit être naturel, professionnel et chaleureux. Ne mets PAS d'objet, seulement le corps du mail. Ne mets pas de crochets ou de placeholders — écris le mail directement comme si tu l'envoyais. Adapte le ton selon que c'est un contact agence (plus formel) ou direct (plus personnel).`,
          messages: [
            { role: "user", content: `Rédige le mail avec ces indications:\n${aiPrompt}\n\n${mailDraft ? `Voici un brouillon existant à améliorer/compléter:\n${mailDraft}` : ""}` }
          ],
        })
      });

      const data = await response.json();
      const text = data.content?.map(i => i.text || "").join("\n").trim();
      if (text) {
        setMailDraft(text);
      } else {
        setAiError("Pas de réponse générée");
      }
    } catch (err) {
      setAiError("Erreur de connexion. Réessaie.");
    }
    setAiGenerating(false);
  };

  const handleSave = () => {
    onUpdate({ method, status, mailSubject, mailDraft });
    onClose();
  };

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch { setCopied(null); }
  };

  const copyFullMail = async () => {
    const full = `Objet: ${mailSubject}\nÀ: ${recipientEmail || "(email non renseigné)"}\n\n${mailDraft}`;
    await copyToClipboard(full, "all");
  };

  return (
    <div>
      {/* Profile summary header */}
      <div style={{
        display: "flex", gap: 16, marginBottom: 24, padding: "16px",
        background: "#111114", borderRadius: 12, border: "1px solid #1e1e22",
      }}>
        {profile.photos?.[0] ? (
          <img src={profile.photos[0]} alt="" style={{ width: 56, height: 70, objectFit: "cover", borderRadius: 8 }} />
        ) : (
          <div style={{ width: 56, height: 70, background: "#0c0c0e", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: 24 }}>◎</div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#f0f0f0", marginBottom: 4 }}>{[profile.firstName, profile.name].filter(Boolean).join(" ") || "Sans nom"}</div>
          <div style={{ fontSize: 12, color: "#777", marginBottom: 4 }}>
            {[profile.age ? `${profile.age} ans` : null, profile.agency].filter(Boolean).join(" · ")}
          </div>
          <div style={{ display: "flex", gap: 8, fontSize: 11, color: "#999" }}>
            {profile.email && <span>✉ {profile.email}</span>}
            {profile.phone && <span>☎ {profile.phone}</span>}
          </div>
          {profile.agencyEmail && (
            <div style={{ fontSize: 11, color: "#8a7740", marginTop: 2 }}>✉ Agence: {profile.agencyEmail}</div>
          )}
        </div>
      </div>

      {/* Contact method */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 10, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Méthode de contact
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          {Object.entries(CONTACT_METHODS).map(([key, m]) => (
            <button
              key={key}
              onClick={() => setMethod(key)}
              style={{
                flex: 1, padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                border: method === key ? "1.5px solid #c9a44a" : "1.5px solid #2a2a2e",
                background: method === key ? "rgba(201,164,74,0.08)" : "transparent",
                color: method === key ? "#c9a44a" : "#666",
                transition: "all 0.2s",
                opacity: (key === "email_actor" && !profile.email) || (key === "email_agency" && !profile.agencyEmail) ? 0.35 : 1,
              }}
              disabled={(key === "email_actor" && !profile.email) || (key === "email_agency" && !profile.agencyEmail)}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>
        {method && !recipientEmail && method !== "phone" && (
          <div style={{ marginTop: 8, fontSize: 11, color: "#ef4444", fontStyle: "italic" }}>
            ⚠ Email non renseigné pour ce contact
          </div>
        )}
      </div>

      {/* Contact status */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 10, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Statut
        </label>
        <div style={{ display: "flex", gap: 6 }}>
          {Object.entries(CONTACT_STATUS).map(([key, s]) => (
            <button
              key={key}
              onClick={() => setStatus(key)}
              style={{
                flex: 1, padding: "8px 8px", borderRadius: 8, cursor: "pointer",
                fontSize: 11, fontWeight: 600, fontFamily: "inherit",
                border: status === key ? `1.5px solid ${s.color}` : "1.5px solid #2a2a2e",
                background: status === key ? s.bg : "transparent",
                color: status === key ? s.color : "#555",
                transition: "all 0.2s",
              }}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mail editor (only for email methods) */}
      {(method === "email_actor" || method === "email_agency") && (
        <div style={{
          padding: "20px", background: "#0c0c0e", borderRadius: 12,
          border: "1px solid #1e1e22", marginBottom: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: "#888", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Rédaction mail
            </label>
            <span style={{ fontSize: 11, color: "#c9a44a" }}>
              → {recipientLabel} {recipientEmail ? `(${recipientEmail})` : ""}
            </span>
          </div>

          {/* Subject */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <label style={{ fontSize: 11, color: "#666", fontWeight: 500 }}>Objet</label>
              <button
                onClick={() => copyToClipboard(mailSubject, "subject")}
                style={{
                  background: "none", border: "none", color: copied === "subject" ? "#22c55e" : "#555",
                  cursor: "pointer", fontSize: 10, fontFamily: "inherit", fontWeight: 500,
                }}
              >
                {copied === "subject" ? "✓ Copié" : "Copier"}
              </button>
            </div>
            <input
              value={mailSubject}
              onChange={e => setMailSubject(e.target.value)}
              style={{
                width: "100%", padding: "10px 14px", background: "#111114", border: "1px solid #2a2a2e",
                borderRadius: 8, color: "#e0e0e0", fontSize: 13, fontFamily: "'DM Sans', sans-serif",
                outline: "none",
              }}
              onFocus={e => e.target.style.borderColor = "#c9a44a"}
              onBlur={e => e.target.style.borderColor = "#2a2a2e"}
            />
          </div>

          {/* AI Writing Assistant */}
          <div style={{
            marginBottom: 16, padding: "14px 16px", background: "#0f0f12",
            borderRadius: 10, border: "1px solid #c9a44a22",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 14 }}>✨</span>
              <label style={{ fontSize: 11, color: "#c9a44a", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Assistant de rédaction
              </label>
            </div>
            <textarea
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder={"Ex: Dire qu'il est sélectionné pour le rôle principal, féliciter, préciser que la prod va le contacter pour les détails contractuels, tourrage en mars à Paris..."}
              rows={3}
              style={{
                width: "100%", padding: "10px 12px", background: "#111114", border: "1px solid #2a2a2e",
                borderRadius: 8, color: "#e0e0e0", fontSize: 12, fontFamily: "'DM Sans', sans-serif",
                outline: "none", resize: "vertical", lineHeight: 1.5,
              }}
              onFocus={e => e.target.style.borderColor = "#c9a44a55"}
              onBlur={e => e.target.style.borderColor = "#2a2a2e"}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
              <button
                onClick={generateMail}
                disabled={aiGenerating || !aiPrompt.trim()}
                style={{
                  padding: "8px 18px", borderRadius: 8, cursor: aiGenerating || !aiPrompt.trim() ? "not-allowed" : "pointer",
                  fontSize: 12, fontWeight: 700, fontFamily: "inherit",
                  border: "none",
                  background: aiGenerating ? "#333" : !aiPrompt.trim() ? "#222" : "linear-gradient(135deg, #c9a44a, #a67c2e)",
                  color: aiGenerating || !aiPrompt.trim() ? "#666" : "#000",
                  transition: "all 0.3s",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                {aiGenerating ? (
                  <>
                    <span style={{ display: "inline-block", animation: "pulse 1s infinite" }}>⏳</span>
                    Rédaction en cours...
                  </>
                ) : (
                  <>✨ Générer le mail</>
                )}
              </button>
              {mailDraft && aiPrompt.trim() && !aiGenerating && (
                <span style={{ fontSize: 10, color: "#666", fontStyle: "italic" }}>
                  Le texte existant sera amélioré
                </span>
              )}
              {aiError && (
                <span style={{ fontSize: 11, color: "#ef4444" }}>⚠ {aiError}</span>
              )}
            </div>
          </div>

          {/* Body */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <label style={{ fontSize: 11, color: "#666", fontWeight: 500 }}>Message</label>
              <button
                onClick={() => copyToClipboard(mailDraft, "body")}
                style={{
                  background: "none", border: "none", color: copied === "body" ? "#22c55e" : "#555",
                  cursor: "pointer", fontSize: 10, fontFamily: "inherit", fontWeight: 500,
                }}
              >
                {copied === "body" ? "✓ Copié" : "Copier"}
              </button>
            </div>
            <textarea
              value={mailDraft}
              onChange={e => setMailDraft(e.target.value)}
              placeholder={`Bonjour${method === "email_agency" && profile.agency ? ` ${profile.agency}` : ""},\n\nJe reviens vers vous concernant le casting pour ${projectName}...\n\n`}
              rows={8}
              style={{
                width: "100%", padding: "12px 14px", background: "#111114", border: "1px solid #2a2a2e",
                borderRadius: 8, color: "#e0e0e0", fontSize: 13, fontFamily: "'DM Sans', sans-serif",
                outline: "none", resize: "vertical", lineHeight: 1.6,
              }}
              onFocus={e => e.target.style.borderColor = "#c9a44a"}
              onBlur={e => e.target.style.borderColor = "#2a2a2e"}
            />
          </div>

          {/* Copy full mail button */}
          <button
            onClick={copyFullMail}
            style={{
              width: "100%", padding: "10px", borderRadius: 8, cursor: "pointer",
              fontSize: 12, fontWeight: 600, fontFamily: "inherit",
              border: "1px solid #c9a44a44",
              background: copied === "all" ? "rgba(34,197,94,0.12)" : "rgba(201,164,74,0.08)",
              color: copied === "all" ? "#22c55e" : "#c9a44a",
              transition: "all 0.3s",
            }}
          >
            {copied === "all" ? "✓ Mail complet copié !" : "📋 Copier le mail complet"}
          </button>
        </div>
      )}

      {/* Phone note */}
      {method === "phone" && (
        <div style={{
          padding: "16px 20px", background: "#0c0c0e", borderRadius: 12,
          border: "1px solid #1e1e22", marginBottom: 20,
          fontSize: 13, color: "#999", lineHeight: 1.5,
        }}>
          📞 Contact par téléphone — mettez à jour le statut après l'appel.
          {profile.phone && (
            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => copyToClipboard(profile.phone, "body")}
                style={{
                  background: "rgba(201,164,74,0.08)", border: "1px solid #c9a44a44",
                  borderRadius: 8, padding: "6px 14px", color: "#c9a44a",
                  cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                }}
              >
                {copied === "body" ? "✓ Copié" : `☎ ${profile.phone}`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Save / Cancel */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <button
          onClick={onClose}
          style={{
            padding: "10px 24px", background: "transparent", color: "#888",
            border: "1px solid #333", borderRadius: 10, cursor: "pointer",
            fontSize: 13, fontWeight: 500, fontFamily: "inherit",
          }}
        >
          Annuler
        </button>
        <button
          onClick={handleSave}
          style={{
            padding: "10px 28px", background: "linear-gradient(135deg, #c9a44a, #a67c2e)",
            color: "#000", border: "none", borderRadius: 10, cursor: "pointer",
            fontSize: 13, fontWeight: 700, fontFamily: "inherit", letterSpacing: "0.02em",
          }}
        >
          Enregistrer
        </button>
      </div>
    </div>
  );
}

// ---- Contact Status Badge ----

function ContactStatusBadge({ contact }) {
  if (!contact || !contact.status || contact.status === "not_contacted") return null;
  const s = CONTACT_STATUS[contact.status];
  const m = contact.method ? CONTACT_METHODS[contact.method] : null;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: s.bg, color: s.color, border: `1px solid ${s.color}33`,
      borderRadius: 8, padding: "4px 10px", fontSize: 10, fontWeight: 600,
    }}>
      {m && <span>{m.icon}</span>} {s.label}
    </div>
  );
}

// ---- Main App ----

function CastingAppInner({ authUser }) {
  // ===== PROJECT MANAGEMENT =====
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [projectList, setProjectList] = useState([]); // [{ id, name, createdAt, updatedAt, rolesCount, profilesCount, status }]
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [savingIndicator, setSavingIndicator] = useState(false);
  const saveTimer = useRef(null);
  const [projectFilter, setProjectFilter] = useState("all"); // "all"|"en_cours"|"en_pause"|"termine"|"archive"
  const [globalSearch, setGlobalSearch] = useState("");
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  // Guest / share mode
  const [guestMode, setGuestMode] = useState(false);
  const [guestProjectCode, setGuestProjectCode] = useState("");
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [joinError, setJoinError] = useState("");
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState([]);
  const [profileGridMode, setProfileGridMode] = useState("grid"); // "grid" | "list"
  const [moveProfileModal, setMoveProfileModal] = useState(null); // { profile, fromRole }
  const [copyProfileModal, setCopyProfileModal] = useState(null); // { profile }
  const [presentationMode, setPresentationMode] = useState(false);
  const [presentationIndex, setPresentationIndex] = useState(0);
  const [emailTemplateModal, setEmailTemplateModal] = useState(null);
  const [emailDraft, setEmailDraft] = useState({ subject: "", body: "" });
  const [emailActiveTemplate, setEmailActiveTemplate] = useState(null);
  const [emailCopied, setEmailCopied] = useState(false);
  const [lightTheme, setLightTheme] = useState(false);
  const [videoUploading, setVideoUploading] = useState(null); // profileId being uploaded to
  const [storageInfo, setStorageInfo] = useState({ usedMB: 0, maxMB: 1024, percentage: 0 });
  const [backupStatus, setBackupStatus] = useState(null); // "exporting" | "done" | null
  const videoInputRef = useRef(null);
  const [showArchived, setShowArchived] = useState(false);
  const [photoUrlInput, setPhotoUrlInput] = useState("");

  // Theme colors
  const T = lightTheme ? {
    bg: "#f5f5f7", bgCard: "#ffffff", bgInput: "#f0f0f2", bgHover: "#fafafa",
    border: "#e0e0e2", borderLight: "#eaeaec", text: "#111", textSec: "#555", textMuted: "#999",
    headerBg: "rgba(255,255,255,0.95)", accent: "#c9a44a",
  } : {
    bg: "#0a0a0c", bgCard: "#111114", bgInput: "#0c0c0e", bgHover: "#141417",
    border: "#1e1e22", borderLight: "#2a2a2e", text: "#f0f0f0", textSec: "#888", textMuted: "#555",
    headerBg: "rgba(10,10,12,0.9)", accent: "#c9a44a",
  };
  const PROJECT_STATUSES = { en_cours: { label: "En cours", color: "#22c55e", bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.2)" }, en_pause: { label: "En pause", color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)" }, termine: { label: "Terminé", color: "#60a5fa", bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.2)" }, archive: { label: "Archivé", color: "#888", bg: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.08)" } };

  // Load project list on mount
  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.list("project:");
        if (result?.keys?.length > 0) {
          const projects = [];
          for (const key of result.keys) {
            try {
              const data = await window.storage.get(key);
              if (data?.value) {
                const parsed = JSON.parse(data.value);
                projects.push({
                  id: key.replace("project:", ""),
                  name: parsed.projectName || "Sans titre",
                  createdAt: parsed._createdAt || "",
                  updatedAt: parsed._updatedAt || "",
                  rolesCount: parsed.roles?.length || 0,
                  profilesCount: Object.values(parsed.profiles || {}).flat().length,
                  finalCount: Object.values(parsed.finalSelections || {}).filter(f => f.selected).length,
                  status: parsed._status || "en_cours",
                });
              }
            } catch (e) { /* skip corrupt entries */ }
          }
          projects.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
          setProjectList(projects);
        }
      } catch (e) { console.log("Storage not available or empty"); }
      setProjectsLoaded(true);
    })();
  }, []);

  // Auto-save project on state change (debounced)
  // Track if a sync-triggered update is happening to avoid save loops
  const syncInProgress = useRef(false);
  const lastGuestDataHash = useRef("");


  // Strip heavy data from shared copy (documents are still base64, photos are now URLs so lightweight)
  const cleanForSharing = async (projectState) => {
    const clean = JSON.parse(JSON.stringify(projectState));
    // Strip documents and casting sheets (base64 heavy)
    if (clean.projectInfo) {
      clean.projectInfo.documents = (clean.projectInfo.documents || []).map(d => ({ ...d, dataUrl: undefined }));
      clean.projectInfo.castingSheets = (clean.projectInfo.castingSheets || []).map(d => ({ ...d, dataUrl: undefined }));
    }
    // Remove profiles for roles that no longer exist
    if (clean.profiles && clean.roles) {
      const roleSet = new Set(clean.roles);
      Object.keys(clean.profiles).forEach(key => {
        if (!roleSet.has(key)) delete clean.profiles[key];
      });
    }
    // Compress all photos for sharing (keep all, reduce size)
    if (clean.profiles) {
      for (const role of Object.keys(clean.profiles)) {
        for (let i = 0; i < (clean.profiles[role] || []).length; i++) {
          const p = clean.profiles[role][i];
          p.selftapeVideos = [];
          const compressed = [];
          for (const ph of (p.photos || [])) {
            if (typeof ph === "string" && ph.startsWith("data:")) {
              try { compressed.push(await compressImage(ph, 300, 0.5)); } catch(e) { /* skip */ }
            } else if (ph) {
              compressed.push(ph);
            }
          }
          p.photos = compressed;
        }
      }
    }
    // Strip base64 reference photos from roleDetails (keep URLs only)
    if (clean.roleDetails) {
      Object.keys(clean.roleDetails).forEach(role => {
        const rd = clean.roleDetails[role];
        if (rd?.referencePhotos) {
          rd.referencePhotos = rd.referencePhotos.filter(ph => typeof ph === "string" && (ph.startsWith("http://") || ph.startsWith("https://")));
        }
      });
    }
    // Strip castingSessions videos
    if (clean.castingSessions) {
      Object.keys(clean.castingSessions).forEach(k => {
        if (clean.castingSessions[k]) {
          clean.castingSessions[k].castingVideos = [];
        }
      });
    }
    return clean;
  };

  const autoSave = useCallback((projectState, projectId) => {
    if (!projectId || !projectState.started) return;
    // Skip save if this was triggered by a sync pull (guest votes update)
    if (syncInProgress.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const cleanState = { ...projectState, _updatedAt: new Date().toISOString() };
        await window.storage.set(`project:${projectId}`, JSON.stringify(cleanState));
        // Also update shared copy if project is shared
        if (cleanState._shareCode) {
          try {
            // Read shared to get latest guest votes (don't overwrite them)
            let guestVotes = cleanState._guestVotes || {};
            let guestCastingVotes = cleanState._guestCastingVotes || {};
            let guestComments = cleanState._guestComments || {};
            let guestUpdatedAt = cleanState._guestUpdatedAt;
            try {
              const existing = await window.storage.get(`shared:${cleanState._shareCode}`, true);
              if (existing?.value) {
                const ex = JSON.parse(existing.value);
                // Always use the LATEST guest data from shared (not our local copy)
                guestVotes = ex._guestVotes || guestVotes;
                guestCastingVotes = ex._guestCastingVotes || guestCastingVotes;
                guestComments = ex._guestComments || guestComments;
                guestUpdatedAt = ex._guestUpdatedAt || guestUpdatedAt;
              }
            } catch (e) {}
            const sharedData = await cleanForSharing({ ...cleanState,
              _guestVotes: guestVotes,
              _guestCastingVotes: guestCastingVotes,
              _guestComments: guestComments,
              _guestUpdatedAt: guestUpdatedAt,
            });
            const sharedJson = JSON.stringify(sharedData);
            if (sharedJson.length > 4.5 * 1024 * 1024) {
              console.warn("[Share] Data still large:", (sharedJson.length / 1024 / 1024).toFixed(1) + "MB — check for remaining base64 data");
            }
            await window.storage.set(`shared:${cleanState._shareCode}`, JSON.stringify(sharedData), true);
          } catch (e) { console.error("[Share] Auto-save to shared failed:", e?.message || e); }
        }
        setSavingIndicator(true);
        setTimeout(() => setSavingIndicator(false), 1200);
        setProjectList(prev => prev.map(p => p.id === projectId ? {
          ...p,
          name: cleanState.projectName,
          updatedAt: cleanState._updatedAt,
          rolesCount: cleanState.roles?.length || 0,
          profilesCount: Object.values(cleanState.profiles || {}).flat().length,
          finalCount: Object.values(cleanState.finalSelections || {}).filter(f => f.selected).length,
        } : p));
      } catch (e) { console.error("Save failed:", e); }
    }, 800);
  }, []);

  const [projectLoading, setProjectLoading] = useState(false);

  const loadProject = async (projectId) => {
    setProjectLoading(true);
    try {
      const data = await window.storage.get(`project:${projectId}`);
      if (data?.value) {
        const parsed = JSON.parse(data.value);
        // Note: castingVideos are kept on load (only stripped in cleanForSharing)
        // Batch state updates
        setCurrentProjectId(projectId);
        setActiveTab("roles");
        setActiveRole(parsed.roles?.[0] || null);
        // Use requestAnimationFrame to not block UI
        requestAnimationFrame(() => {
          setState({ ...INITIAL_STATE, ...parsed });
          setProjectLoading(false);
        });
      } else {
        setProjectLoading(false);
      }
    } catch (e) { console.error("Load failed:", e); setProjectLoading(false); }
  };

  const createNewProject = () => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const now = new Date().toISOString();
    setCurrentProjectId(id);
    setState({ ...INITIAL_STATE, _createdAt: now, _updatedAt: now });
    setProjectList(prev => [{
      id, name: "", createdAt: now, updatedAt: now, rolesCount: 0, profilesCount: 0, finalCount: 0, status: "en_cours",
    }, ...prev]);
  };

  const deleteProject = async (projectId) => {
    try {
      // Load project first to check for shared copy
      try {
        const data = await window.storage.get(`project:${projectId}`);
        if (data?.value) {
          const parsed = JSON.parse(data.value);
          if (parsed._shareCode) {
            await window.storage.delete(`shared:${parsed._shareCode}`, true);
          }
        }
      } catch (e) { /* project may not exist, continue with delete */ }
      await window.storage.delete(`project:${projectId}`);
      setProjectList(prev => prev.filter(p => p.id !== projectId));
      if (currentProjectId === projectId) {
        setCurrentProjectId(null);
        setState(INITIAL_STATE);
      }
    } catch (e) { console.error("Delete failed:", e); }
  };

  const duplicateProject = async (projectId) => {
    try {
      const data = await window.storage.get(`project:${projectId}`);
      if (!data?.value) return;
      const source = JSON.parse(data.value);
      const newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const now = new Date().toISOString();
      const dup = { ...source, projectName: (source.projectName || "Sans titre") + " (copie)", _createdAt: now, _updatedAt: now, profiles: {}, selections: {}, realisateurSelections: {}, contacts: {}, finalSelections: {}, castingSessions: {}, planningDays: {} };
      (source.roles || []).forEach(r => { dup.profiles[r] = []; });
      await window.storage.set(`project:${newId}`, JSON.stringify(dup));
      setProjectList(prev => [{
        id: newId, name: dup.projectName, createdAt: now, updatedAt: now,
        rolesCount: dup.roles?.length || 0, profilesCount: 0, finalCount: 0, status: "en_cours",
      }, ...prev]);
    } catch (e) { console.error("Duplicate failed:", e); }
  };

  const updateProjectStatus = async (projectId, status) => {
    try {
      const data = await window.storage.get(`project:${projectId}`);
      if (!data?.value) return;
      const project = JSON.parse(data.value);
      project._status = status;
      await window.storage.set(`project:${projectId}`, JSON.stringify(project));
      setProjectList(prev => prev.map(p => p.id === projectId ? { ...p, status } : p));
    } catch (e) {}
  };

  const moveProfileToRole = (profile, fromRole, toRole) => {
    if (fromRole === toRole) return;
    setState(prev => ({
      ...prev,
      profiles: {
        ...prev.profiles,
        [fromRole]: (prev.profiles[fromRole] || []).filter(p => p.id !== profile.id),
        [toRole]: [...(prev.profiles[toRole] || []), profile],
      },
    }));
    setMoveProfileModal(null);
  };

  const copyProfileToRole = (profile, toRole) => {
    const copy = { ...profile, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), _copiedFrom: profile.id };
    setState(prev => ({
      ...prev,
      profiles: { ...prev.profiles, [toRole]: [...(prev.profiles[toRole] || []), copy] },
    }));
    setCopyProfileModal(null);
  };

  const quickRateProfile = (profileId, rating) => {
    setState(prev => ({
      ...prev,
      profiles: {
        ...prev.profiles,
        [activeRole]: (prev.profiles[activeRole] || []).map(p =>
          p.id === profileId ? { ...p, _quickRating: p._quickRating === rating ? 0 : rating } : p
        ),
      },
    }));
  };

  const getGlobalSearchResults = (q) => {
    if (!q || q.length < 2) return { projects: [], actors: [] };
    const ql = q.toLowerCase();
    const projects = projectList.filter(p => (p.name || "").toLowerCase().includes(ql));
    const actors = actorDatabase.filter(a => {
      const full = [a.firstName, a.name, a.agency].filter(Boolean).join(" ").toLowerCase();
      return full.includes(ql) || (a.tags || []).some(t => t.toLowerCase().includes(ql));
    });
    return { projects: projects.slice(0, 5), actors: actors.slice(0, 8) };
  };

  const backToDashboard = () => {
    if (guestMode) { setGuestMode(false); setGuestProjectCode(""); }
    setCurrentProjectId(null);
    setState(INITIAL_STATE);
    setCastingFileView(false);
  };

  // Share a project
  const shareProject = async (projectId) => {
    try {
      const data = await window.storage.get(`project:${projectId}`);
      if (!data?.value) return null;
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();
      const password = Math.random().toString(36).slice(2, 6).toUpperCase();
      const project = JSON.parse(data.value);
      project._shareCode = code;
      project._sharePassword = password;
      project._sharedAt = new Date().toISOString();
      project._ownerId = projectId;
      project._guestVotes = project._guestVotes || {};
      project._guestCastingVotes = project._guestCastingVotes || {};
      project._guestComments = project._guestComments || {};
      await window.storage.set(`project:${projectId}`, JSON.stringify(project));
      const sharedProject = await cleanForSharing(project);
      await window.storage.set(`shared:${code}`, JSON.stringify(sharedProject), true);
      return { code, password };
    } catch (e) { console.error("Share failed:", e); return null; }
  };

  // Join shared project as guest
  const joinSharedProject = async (code) => {
    setJoinError("");
    try {
      const data = await window.storage.get(`shared:${code.toUpperCase()}`, true);
      if (!data?.value) { setJoinError("Code invalide ou projet introuvable"); return; }
      const project = JSON.parse(data.value);
      setGuestMode(true);
      setGuestProjectCode(code.toUpperCase());
      setState({ ...INITIAL_STATE, ...project });
      setCurrentProjectId(project._ownerId || code);
      setActiveTab("roles");
      setActiveRole(project.roles?.[0] || null);
    } catch (e) { setJoinError("Erreur de connexion"); }
  };

  // Guest saves selections to shared storage
  const guestAutoSave = useCallback(async (currentState, code) => {
    if (!code) return;
    try {
      const data = await window.storage.get(`shared:${code}`, true);
      if (!data?.value) return;
      const project = JSON.parse(data.value);
      project.selections = { ...project.selections, ...currentState.selections };
      project.realisateurSelections = { ...project.realisateurSelections, ...currentState.realisateurSelections };
      if (currentState.castingSessions) project.castingSessions = { ...project.castingSessions, ...currentState.castingSessions };
      if (currentState.finalSelections) project.finalSelections = { ...project.finalSelections, ...currentState.finalSelections };
      project._guestUpdatedAt = new Date().toISOString();
      await window.storage.set(`shared:${code}`, JSON.stringify(project), true);
    } catch (e) {}
  }, []);

  // Director pulls guest changes
  const syncFromShared = async (projectId) => {
    try {
      const data = await window.storage.get(`project:${projectId}`);
      if (!data?.value) return null;
      const project = JSON.parse(data.value);
      if (!project._shareCode) return null;
      const shared = await window.storage.get(`shared:${project._shareCode}`, true);
      if (!shared?.value) return null;
      const sp = JSON.parse(shared.value);
      let changed = false;
      // Pull guest votes for roles
      if (sp._guestVotes && JSON.stringify(sp._guestVotes) !== JSON.stringify(project._guestVotes || {})) {
        project._guestVotes = sp._guestVotes;
        changed = true;
      }
      // Pull guest casting votes
      if (sp._guestCastingVotes && JSON.stringify(sp._guestCastingVotes) !== JSON.stringify(project._guestCastingVotes || {})) {
        project._guestCastingVotes = sp._guestCastingVotes;
        changed = true;
      }
      // Pull guest comments
      if (sp._guestComments && JSON.stringify(sp._guestComments) !== JSON.stringify(project._guestComments || {})) {
        project._guestComments = sp._guestComments;
        changed = true;
      }
      if (changed) {
        await window.storage.set(`project:${projectId}`, JSON.stringify(project));
        return project;
      }
    } catch (e) {}
    return null;
  };

  // ===== GLOBAL ACTOR DATABASE =====
  const [castingFileView, setCastingFileView] = useState(false);
  const [comptaView, setComptaView] = useState(false);
  const [comptaInvoices, setComptaInvoices] = useState([]); // [{projectId, projectName, devis, status, sentDate, paidDate, ...}]
  const [comptaLoaded, setComptaLoaded] = useState(false);
  const [comptaFilter, setComptaFilter] = useState("all"); // all | draft | sent | paid | overdue
  const [comptaSearch, setComptaSearch] = useState("");
  const [comptaDetail, setComptaDetail] = useState(null); // invoice object or null
  const [comptaStatuses, setComptaStatuses] = useState({}); // { projectId: { status, sentDate, paidDate, notes, relanceCount, relanceDates } }
  const [actorDatabase, setActorDatabase] = useState([]);
  const [actorsLoaded, setActorsLoaded] = useState(false);
  const [actorSearch, setActorSearch] = useState("");
  const [actorFilters, setActorFilters] = useState({
    hair: "all", type: "all", agency: "all", ageMin: "", ageMax: "",
    heightMin: "", heightMax: "", level: "all", project: "all", tag: "all", favOnly: false,
  });
  const [actorFiltersOpen, setActorFiltersOpen] = useState(false);
  const [actorDetail, setActorDetail] = useState(null);
  const [actorEditMode, setActorEditMode] = useState(false);
  const [actorEditForm, setActorEditForm] = useState(null);
  const [actorAddModal, setActorAddModal] = useState(false);
  const [actorViewMode, setActorViewMode] = useState("grid"); // "grid" | "list"
  const [actorSort, setActorSort] = useState("name");
  const [newTagInput, setNewTagInput] = useState("");
  const actorPhotoRef = useRef(null);
  const [actorPhotoIdx, setActorPhotoIdx] = useState(null);
  const [actorImportToProject, setActorImportToProject] = useState(null); // { actor, step: "project"|"role", projectId, projectName, roles }
  const [importFromFileModal, setImportFromFileModal] = useState(false);
  const [importFileSearch, setImportFileSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.list("actor:");
        if (result?.keys?.length > 0) {
          const actors = [];
          for (const key of result.keys) {
            try {
              const data = await window.storage.get(key);
              if (data?.value) actors.push(JSON.parse(data.value));
            } catch (e) {}
          }
          actors.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
          setActorDatabase(actors);
        }
      } catch (e) {}
      setActorsLoaded(true);
    })();
  }, []);

  const saveActorToDatabase = async (profile, projectName, roleName, selectionStatus) => {
    const existing = actorDatabase.find(a => a.id === profile.id);
    const historyEntry = projectName ? { project: projectName, role: roleName || "", status: selectionStatus || "ajouté", date: new Date().toISOString() } : null;
    const actor = {
      id: profile.id || Date.now().toString(36),
      firstName: profile.firstName || "", name: profile.name || "",
      age: profile.age || "", height: profile.height || "",
      measurements: profile.measurements || "", hairColor: profile.hairColor || "",
      profileType: profile.profileType || "", actingLevel: profile.actingLevel || 0,
      agency: profile.agency || "", email: profile.email || "", phone: profile.phone || "",
      agencyEmail: profile.agencyEmail || "", photos: (profile.photos || []).slice(0, 3),
      source: profile.source || "", notes: profile.notes || "",
      tags: existing?.tags || [], _favorite: existing?._favorite || false,
      _savedAt: new Date().toISOString(),
      _projects: existing ? [...new Set([...(existing._projects || []), projectName].filter(Boolean))] : [projectName].filter(Boolean),
      _history: [...(existing?._history || []), ...(historyEntry ? [historyEntry] : [])],
    };
    try {
      await window.storage.set(`actor:${actor.id}`, JSON.stringify(actor));
      setActorDatabase(prev => {
        const idx = prev.findIndex(a => a.id === actor.id);
        if (idx >= 0) { const n = [...prev]; n[idx] = actor; return n; }
        return [...prev, actor].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      });
    } catch (e) { console.error("Save actor failed:", e); }
  };

  const updateActorInDatabase = async (actor) => {
    try {
      await window.storage.set(`actor:${actor.id}`, JSON.stringify({ ...actor, _savedAt: new Date().toISOString() }));
      setActorDatabase(prev => prev.map(a => a.id === actor.id ? { ...actor, _savedAt: new Date().toISOString() } : a));
      if (actorDetail?.id === actor.id) setActorDetail({ ...actor, _savedAt: new Date().toISOString() });
    } catch (e) {}
  };

  const deleteActor = async (actorId) => {
    try {
      await window.storage.delete(`actor:${actorId}`);
      setActorDatabase(prev => prev.filter(a => a.id !== actorId));
      if (actorDetail?.id === actorId) setActorDetail(null);
    } catch (e) {}
  };

  const toggleActorFavorite = async (actorId) => {
    const actor = actorDatabase.find(a => a.id === actorId);
    if (!actor) return;
    const updated = { ...actor, _favorite: !actor._favorite };
    await updateActorInDatabase(updated);
  };

  const addActorTag = async (actorId, tag) => {
    const actor = actorDatabase.find(a => a.id === actorId);
    if (!actor || !tag.trim()) return;
    const tags = [...new Set([...(actor.tags || []), tag.trim()])];
    await updateActorInDatabase({ ...actor, tags });
  };

  const removeActorTag = async (actorId, tag) => {
    const actor = actorDatabase.find(a => a.id === actorId);
    if (!actor) return;
    await updateActorInDatabase({ ...actor, tags: (actor.tags || []).filter(t => t !== tag) });
  };

  const addActorManually = async (formData) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const actor = {
      id, firstName: formData.firstName || "", name: formData.name || "",
      age: formData.age || "", height: formData.height || "",
      measurements: formData.measurements || "", hairColor: formData.hairColor || "",
      profileType: formData.profileType || "", actingLevel: formData.actingLevel || 0,
      agency: formData.agency || "", email: formData.email || "", phone: formData.phone || "",
      agencyEmail: formData.agencyEmail || "", photos: (formData.photos || []).slice(0, 3),
      source: formData.source || "", notes: formData.notes || "",
      tags: formData.tags || [], _favorite: false,
      _savedAt: new Date().toISOString(), _projects: [],
    };
    try {
      await window.storage.set(`actor:${id}`, JSON.stringify(actor));
      setActorDatabase(prev => [...prev, actor].sort((a, b) => (a.name || "").localeCompare(b.name || "")));
    } catch (e) {}
    setActorAddModal(false);
  };

  const sortActors = (actors) => {
    const s = [...actors];
    switch (actorSort) {
      case "name": return s.sort((a, b) => [a.firstName, a.name].join(" ").localeCompare([b.firstName, b.name].join(" ")));
      case "date": return s.sort((a, b) => (b._savedAt || "").localeCompare(a._savedAt || ""));
      case "age": return s.sort((a, b) => (parseInt(a.age) || 0) - (parseInt(b.age) || 0));
      case "level": return s.sort((a, b) => (b.actingLevel || 0) - (a.actingLevel || 0));
      case "projects": return s.sort((a, b) => (b._projects?.length || 0) - (a._projects?.length || 0));
      default: return s;
    }
  };

  // Import actor from fichier to a stored project
  const importActorToStoredProject = async (actor, projectId, role) => {
    try {
      const data = await window.storage.get(`project:${projectId}`);
      if (!data?.value) return;
      const project = JSON.parse(data.value);
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const newProfile = {
        id, _sourceActorId: actor.id, firstName: actor.firstName || "", name: actor.name || "",
        age: actor.age || "", height: actor.height || "",
        measurements: actor.measurements || "", hairColor: actor.hairColor || "",
        profileType: actor.profileType || "", actingLevel: actor.actingLevel || 0,
        agency: actor.agency || "", email: actor.email || "", phone: actor.phone || "",
        agencyEmail: actor.agencyEmail || "", photos: actor.photos || [],
        source: actor.source || "", notes: actor.notes || "",
        availability: "pending", selftapeVideos: [], selftapeLinks: [],
        shareContacts: false, saveToCastingFile: true, tags: actor.tags || [],
      };
      if (!project.profiles[role]) project.profiles[role] = [];
      project.profiles[role].push(newProfile);
      project._updatedAt = new Date().toISOString();
      await window.storage.set(`project:${projectId}`, JSON.stringify(project));
      setProjectList(prev => prev.map(p => p.id === projectId ? {
        ...p, updatedAt: project._updatedAt,
        profilesCount: Object.values(project.profiles || {}).flat().length,
      } : p));
      setActorImportToProject(null);
    } catch (e) { console.error("Import failed:", e); }
  };

  // Import actor from fichier to current project's active role
  const importActorToCurrentRole = (actor) => {
    if (!activeRole) return;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const newProfile = {
      id, _sourceActorId: actor.id, firstName: actor.firstName || "", name: actor.name || "",
      age: actor.age || "", height: actor.height || "",
      measurements: actor.measurements || "", hairColor: actor.hairColor || "",
      profileType: actor.profileType || "", actingLevel: actor.actingLevel || 0,
      agency: actor.agency || "", email: actor.email || "", phone: actor.phone || "",
      agencyEmail: actor.agencyEmail || "", photos: actor.photos || [],
      source: actor.source || "", notes: actor.notes || "",
      availability: "pending", selftapeVideos: [], selftapeLinks: [],
      shareContacts: false, saveToCastingFile: true, tags: actor.tags || [],
    };
    setState(prev => ({
      ...prev,
      profiles: { ...prev.profiles, [activeRole]: [...(prev.profiles[activeRole] || []), newProfile] },
    }));
  };

  // ===== PROJECT STATE =====
  const [state, setState] = useState(INITIAL_STATE);
  const [activeRole, setActiveRole] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSelection, setFilterSelection] = useState("all");
  const [filterContact, setFilterContact] = useState("all");
  const [showAddRole, setShowAddRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const viewMode = "director"; // Single user mode — always director view
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactingProfile, setContactingProfile] = useState(null);
  const [activeTab, setActiveTab] = useState("roles"); // "projet" | "roles" | "contacts" | etc
  const [projetSection, setProjetSection] = useState("infos"); // "infos" | "documents" | "devis" | "summary"
  const [projetValidated, setProjetValidated] = useState(false);
  const [projetEditMode, setProjetEditMode] = useState(true);
  const [projetNewRole, setProjetNewRole] = useState("");
  const [projetShowAddRole, setProjetShowAddRole] = useState(false);
  const [projetExpanded, setProjetExpanded] = useState({});
  const [projetEthAdd, setProjetEthAdd] = useState({});
  const [projetEthInput, setProjetEthInput] = useState({});
  const [contactSidebarSelected, setContactSidebarSelected] = useState(null);
  const [contactSectionOpen, setContactSectionOpen] = useState({ selected: true, notSelected: false });
  const [contactActiveRole, setContactActiveRole] = useState(null);
  const [contactSubTab, setContactSubTab] = useState("premier"); // "premier" | "final"
  const [activeCastingDay, setActiveCastingDay] = useState(null);
  const [showAddDay, setShowAddDay] = useState(false);
  const [dragSlot, setDragSlot] = useState(null);
  const [actingNotesModal, setActingNotesModal] = useState(null); // { dayId, slotId }
  const [inviteModal, setInviteModal] = useState(null); // { day, slot, profile }
  const [inviteMailBody, setInviteMailBody] = useState("");
  const [inviteInfoBlock, setInviteInfoBlock] = useState("");
  const [printView, setPrintView] = useState(false);
  const [castingActiveRole, setCastingActiveRole] = useState(null);
  const [castingDayFilter, setCastingDayFilter] = useState("all");
  const [castingDetailProfile, setCastingDetailProfile] = useState(null);
  const [finalViewMode, setFinalViewMode] = useState("grid");
  const [finalSectionOpen, setFinalSectionOpen] = useState({ selected: true, maybe: true, rejected: false });
  const [finalMailModal, setFinalMailModal] = useState(null); // { profile, type, email, subject, body }
  const [finalMailAiLoading, setFinalMailAiLoading] = useState(false);
  const [finalMailCopied, setFinalMailCopied] = useState(false);
  const [castingVideoModal, setCastingVideoModal] = useState(null); // profileId



  // === Comptabilité helpers ===
  const COMPTA_STATUS = {
    draft: { label: "Brouillon", color: "#888", bg: "rgba(255,255,255,0.04)", icon: "📝" },
    sent: { label: "Envoyée", color: "#60a5fa", bg: "rgba(96,165,250,0.08)", icon: "📨" },
    paid: { label: "Payée", color: "#22c55e", bg: "rgba(34,197,94,0.08)", icon: "✅" },
    overdue: { label: "En retard", color: "#ef4444", bg: "rgba(239,68,68,0.08)", icon: "⚠️" },
    cancelled: { label: "Annulée", color: "#666", bg: "rgba(255,255,255,0.02)", icon: "✕" },
  };

  const loadComptaData = async () => {
    try {
      const result = await window.storage.list("project:");
      const invoices = [];
      for (const key of result?.keys || []) {
        try {
          const data = await window.storage.get(key);
          if (!data?.value) continue;
          const parsed = JSON.parse(data.value);
          const pi = parsed.projectInfo || {};
          const devis = pi.devis || {};
          const lines = devis.lines || [];
          const totalHT = lines.reduce((s, l) => s + (parseFloat(l.unitPrice) || 0) * (parseFloat(l.qty) || 0), 0);
          const totalTVA = lines.reduce((s, l) => s + (parseFloat(l.unitPrice) || 0) * (parseFloat(l.qty) || 0) * ((parseFloat(l.tva) || 0) / 100), 0);
          invoices.push({
            projectId: key.replace("project:", ""),
            projectName: parsed.projectName || "Sans titre",
            projectStatus: parsed._status || "en_cours",
            production: pi.production || "",
            devisNumber: devis.fields?.devisNumber || "",
            devisDate: devis.fields?.devisDate || "",
            clientName: devis.fields?.clientName || pi.production || "",
            salary: pi.salary || {},
            lines,
            totalHT,
            totalTVA,
            totalTTC: totalHT + totalTVA,
            hasDevis: lines.length > 0,
            hasSalary: !!(pi.salary?.amount),
            dateTournage: pi.dateTournage || "",
            roles: parsed.roles || [],
          });
        } catch (e) {}
      }
      invoices.sort((a, b) => (b.devisDate || "").localeCompare(a.devisDate || ""));
      setComptaInvoices(invoices);

      // Load statuses
      try {
        const st = await window.storage.get("comptaStatuses");
        if (st?.value) setComptaStatuses(JSON.parse(st.value));
      } catch(e) {}

      setComptaLoaded(true);
    } catch (e) { setComptaLoaded(true); }
  };

  const saveComptaStatus = async (projectId, updates) => {
    const newStatuses = { ...comptaStatuses, [projectId]: { ...(comptaStatuses[projectId] || {}), ...updates } };
    setComptaStatuses(newStatuses);
    try { await window.storage.set("comptaStatuses", JSON.stringify(newStatuses)); } catch(e) {}
  };

  const getInvoiceStatus = (inv) => {
    const s = comptaStatuses[inv.projectId];
    if (s?.status) return s.status;
    if (inv.hasDevis) return "draft";
    return "draft";
  };

  const getComptaStats = () => {
    let totalFacture = 0, totalPaye = 0, totalEnAttente = 0, totalEnRetard = 0, nbPaid = 0, nbSent = 0, nbOverdue = 0, nbDraft = 0;
    comptaInvoices.forEach(inv => {
      const st = getInvoiceStatus(inv);
      const amount = inv.totalTTC || 0;
      const salaryAmount = parseFloat(inv.salary?.amount) || 0;
      const mainAmount = amount > 0 ? amount : salaryAmount;
      totalFacture += mainAmount;
      if (st === "paid") { totalPaye += mainAmount; nbPaid++; }
      else if (st === "sent") { totalEnAttente += mainAmount; nbSent++; }
      else if (st === "overdue") { totalEnRetard += mainAmount; nbOverdue++; }
      else { nbDraft++; }
    });
    return { totalFacture, totalPaye, totalEnAttente, totalEnRetard, nbPaid, nbSent, nbOverdue, nbDraft };
  };

  // === Projet Info helpers ===
  const pi = state.projectInfo || {};
  const uPI = (field, value) => setState(p => ({ ...p, projectInfo: { ...p.projectInfo, [field]: value } }));
  const uRoleDetail = (role, field, value) => setState(p => ({ ...p, roleDetails: { ...p.roleDetails, [role]: { ...(p.roleDetails?.[role] || {}), [field]: value } } }));
  const uDevisField = (field, value) => setState(p => ({ ...p, projectInfo: { ...p.projectInfo, devis: { ...(p.projectInfo?.devis || {}), fields: { ...(p.projectInfo?.devis?.fields || {}), [field]: value } } } }));
  const addProjetCastingDate = () => uPI("castingDates", [...(pi.castingDates || []), ""]);
  const updateProjetCastingDate = (i, v) => { const a = [...(pi.castingDates || [])]; a[i] = v; uPI("castingDates", a); };
  const removeProjetCastingDate = (i) => uPI("castingDates", (pi.castingDates || []).filter((_, j) => j !== i));
  const addCustomDate = () => uPI("customDates", [...(pi.customDates || []), { label: "", date: "" }]);
  const updateCustomDate = (i, field, v) => { const a = [...(pi.customDates || [])]; a[i] = { ...a[i], [field]: v }; uPI("customDates", a); };
  const removeCustomDate = (i) => uPI("customDates", (pi.customDates || []).filter((_, j) => j !== i));
  const addDevisLine = () => uPI("devis", { ...(pi.devis || {}), lines: [...(pi.devis?.lines || []), { id: "l" + Date.now(), description: "", qty: 1, unit: "forfait", unitPrice: "", tva: 20 }] });
  const updateDevisLine = (id, f, v) => uPI("devis", { ...(pi.devis || {}), lines: (pi.devis?.lines || []).map(l => l.id === id ? { ...l, [f]: v } : l) });
  const removeDevisLine = (id) => uPI("devis", { ...(pi.devis || {}), lines: (pi.devis?.lines || []).filter(l => l.id !== id) });
  const devisLines = pi.devis?.lines || [];
  const devisTotalHT = devisLines.reduce((s, l) => s + (parseFloat(l.unitPrice) || 0) * (parseFloat(l.qty) || 0), 0);
  const devisTotalTVA = devisLines.reduce((s, l) => s + (parseFloat(l.unitPrice) || 0) * (parseFloat(l.qty) || 0) * ((parseFloat(l.tva) || 0) / 100), 0);
  const totalComediens = state.roles.reduce((s, r) => s + (parseInt(state.roleDetails?.[r]?.nbComediens) || 0), 0);
  const projetDateChips = [
    { label: "Tournage", value: pi.dateTournageDe ? (pi.dateTournageA ? fmtDateFR(pi.dateTournageDe) + " → " + fmtDateFR(pi.dateTournageA) : fmtDateFR(pi.dateTournageDe)) : fmtDateFR(pi.dateTournage), icon: "🎬" },
    { label: "Rendu profils", value: fmtDateFR(pi.dateRenduProfils), icon: "📤" },
    { label: "PPM", value: fmtDateFR(pi.datePPM), icon: "📋" },
    ...(pi.castingDates || []).filter(d => d).map((d, i) => ({ label: "Casting " + (i + 1), value: fmtDateFR(d), icon: "🎭" })),
    { label: "Validation", value: fmtDateFR(pi.dateValidation), icon: "✅" },
    ...(pi.customDates || []).filter(d => d.date).map(d => ({ label: d.label || "Date", value: fmtDateFR(d.date), icon: "📌" })),
  ].filter(x => x.value);
  const addCustomEth = (val) => { if (!(pi.customEthnicities || []).includes(val)) uPI("customEthnicities", [...(pi.customEthnicities || []), val]); };

  // Load compta when view opens
  useEffect(() => { if (comptaView && !comptaLoaded) loadComptaData(); }, [comptaView, comptaLoaded]);

  // Auto-save effect
  useEffect(() => {
    if (guestMode && guestProjectCode && state.started) {
      const t = setTimeout(() => guestAutoSave(state, guestProjectCode), 600);
      return () => clearTimeout(t);
    } else if (currentProjectId && state.started && !guestMode) {
      autoSave(state, currentProjectId);
    }
  }, [state, currentProjectId, autoSave, guestMode, guestProjectCode, guestAutoSave]);

  // Also resync shared data when director opens shared project — auto-poll
  useEffect(() => {
    if (!currentProjectId || !state.started || guestMode || !state._shareCode) return;
    const doSync = async () => {
      try {
        const shared = await window.storage.get(`shared:${state._shareCode}`, true);
        if (!shared?.value) return;
        const sp = JSON.parse(shared.value);
        // Build hash of guest data to detect real changes
        const guestHash = JSON.stringify({
          v: sp._guestVotes || {},
          cv: sp._guestCastingVotes || {},
          c: sp._guestComments || {},
        });
        // Only update if guest data actually changed
        if (guestHash !== lastGuestDataHash.current) {
          lastGuestDataHash.current = guestHash;
          // Set flag to prevent autoSave from re-saving during this update
          syncInProgress.current = true;
          setState(prev => ({
            ...prev,
            _guestVotes: sp._guestVotes || prev._guestVotes || {},
            _guestCastingVotes: sp._guestCastingVotes || prev._guestCastingVotes || {},
            _guestComments: sp._guestComments || prev._guestComments || {},
          }));
          // Also update local project storage with new guest data
          try {
            const local = await window.storage.get(`project:${currentProjectId}`);
            if (local?.value) {
              const proj = JSON.parse(local.value);
              proj._guestVotes = sp._guestVotes || {};
              proj._guestCastingVotes = sp._guestCastingVotes || {};
              proj._guestComments = sp._guestComments || {};
              await window.storage.set(`project:${currentProjectId}`, JSON.stringify(proj));
            }
          } catch (e) {}
          // Release flag after React has processed the update
          setTimeout(() => { syncInProgress.current = false; }, 1500);
        }
      } catch (e) {}
    };
    doSync(); // initial sync
    const interval = setInterval(doSync, 3000);
    return () => clearInterval(interval);
  }, [currentProjectId, state._shareCode, guestMode]);

  const cycleViewMode = () => {}; // Disabled — single user mode

  const VIEW_MODES = {
    director: { label: "Casting Director", color: "#c9a44a", icon: "🎬" },
  };

  // Refresh storage usage
  const refreshStorage = useCallback(async () => {
    try {
      const info = await getStorageUsage();
      setStorageInfo(info);
    } catch (e) {}
  }, []);

  useEffect(() => { refreshStorage(); }, [refreshStorage]);

  // Handle video upload for a profile
  const handleVideoUpload = async (file, profileId, roleName) => {
    if (!file || !profileId) return;
    setVideoUploading(profileId);
    try {
      const result = await uploadVideo(file, currentProjectId || "default", profileId);
      // Add video to profile
      setState(prev => {
        const newProfiles = { ...prev.profiles };
        for (const role of Object.keys(newProfiles)) {
          newProfiles[role] = newProfiles[role].map(p => {
            if (p.id === profileId) {
              const videos = [...(p.castingVideos || []), {
                id: "vid_" + Date.now(),
                url: result.url,
                storagePath: result.path,
                name: result.name,
                size: result.size,
                uploadedAt: result.uploadedAt,
                label: "Selftape",
              }];
              return { ...p, castingVideos: videos };
            }
            return p;
          });
        }
        return { ...prev, profiles: newProfiles };
      });
      refreshStorage();
    } catch (e) {
      alert("Erreur upload : " + (e.message || "échec"));
    }
    setVideoUploading(null);
  };

  // Delete a video from storage + profile
  const handleVideoDelete = async (profileId, videoId, storagePath) => {
    if (!confirm("Supprimer cette vidéo ? L'espace sera libéré.")) return;
    try {
      if (storagePath) await deleteVideo(storagePath);
    } catch (e) {}
    setState(prev => {
      const newProfiles = { ...prev.profiles };
      for (const role of Object.keys(newProfiles)) {
        newProfiles[role] = newProfiles[role].map(p => {
          if (p.id === profileId) {
            return { ...p, castingVideos: (p.castingVideos || []).filter(v => v.id !== videoId) };
          }
          return p;
        });
      }
      return { ...prev, profiles: newProfiles };
    });
    refreshStorage();
  };

  // Export ALL data as complete backup JSON
  const handleExportBackup = async () => {
    setBackupStatus("exporting");
    try {
      // Collect ALL storage keys
      const allKeys = await window.storage.list("");
      const allData = {};
      for (const key of allKeys.keys || []) {
        try {
          const data = await window.storage.get(key);
          if (data?.value) allData[key] = JSON.parse(data.value);
        } catch (e) {
          try { const data = await window.storage.get(key); if (data?.value) allData[key] = data.value; } catch(e2) {}
        }
      }
      // Also collect shared data
      const sharedKeys = await window.storage.list("", true);
      const sharedData = {};
      for (const key of sharedKeys.keys || []) {
        try {
          const data = await window.storage.get(key, true);
          if (data?.value) sharedData[key] = JSON.parse(data.value);
        } catch (e) {
          try { const data = await window.storage.get(key, true); if (data?.value) sharedData[key] = data.value; } catch(e2) {}
        }
      }

      const backup = {
        exportDate: new Date().toISOString(),
        app: "Joana Fontaine - Casting Director",
        version: "2.0",
        personalData: allData,
        sharedData: sharedData,
        totalProjects: Object.keys(allData).filter(k => k.startsWith("project:")).length,
        totalActors: allData.castingFile ? (Array.isArray(allData.castingFile) ? allData.castingFile.length : 0) : 0,
      };
      
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `casting-backup-COMPLET-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupStatus("done");
      setTimeout(() => setBackupStatus(null), 3000);
    } catch (e) {
      alert("Erreur export : " + e.message);
      setBackupStatus(null);
    }
  };

  // Import backup from JSON file
  const handleImportBackup = () => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".json";
    inp.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const backup = JSON.parse(text);
        if (!backup.app || !backup.app.includes("Casting")) {
          alert("Ce fichier ne semble pas être une sauvegarde valide.");
          return;
        }
        if (!window.confirm(`Restaurer la sauvegarde du ${new Date(backup.exportDate).toLocaleDateString("fr-FR")} ?\n\n${backup.totalProjects || "?"} projets, ${backup.totalActors || "?"} acteurs.\n\nCela remplacera toutes les données actuelles.`)) return;
        
        // Restore personal data
        if (backup.personalData) {
          for (const [key, value] of Object.entries(backup.personalData)) {
            await window.storage.set(key, JSON.stringify(value));
          }
        }
        // Legacy format support
        if (backup.projects && !backup.personalData) {
          for (const proj of backup.projects) {
            if (proj.key && proj.data) await window.storage.set(proj.key, JSON.stringify(proj.data));
          }
          if (backup.castingFile) await window.storage.set("castingFile", JSON.stringify(backup.castingFile));
        }
        // Restore shared data
        if (backup.sharedData) {
          for (const [key, value] of Object.entries(backup.sharedData)) {
            await window.storage.set(key, JSON.stringify(value), true);
          }
        }
        alert("✅ Sauvegarde restaurée avec succès ! La page va se recharger.");
        window.location.reload();
      } catch (err) {
        alert("Erreur lors de l'import : " + err.message);
      }
    };
    inp.click();
  };

  // Helper: get effective selection for a profile (guest votes take priority, then director's own)
  const getChoice = (profileId) => {
    return state._guestVotes?.[profileId]?.choice || state.selections[profileId]?.choice || null;
  };

  const setSelection = (profileId, choice) => {
    setState(prev => ({
      ...prev,
      selections: {
        ...prev.selections,
        [profileId]: {
          ...(prev.selections[profileId] || {}),
          choice: prev.selections[profileId]?.choice === choice ? null : choice,
        },
      },
    }));
  };

  const setSelectionComment = (profileId, comment) => {
    setState(prev => ({
      ...prev,
      selections: {
        ...prev.selections,
        [profileId]: {
          ...(prev.selections[profileId] || {}),
          comment,
        },
      },
    }));
  };

  const updateContact = (profileId, contactData) => {
    setState(prev => ({
      ...prev,
      contacts: {
        ...prev.contacts,
        [profileId]: { ...(prev.contacts[profileId] || {}), ...contactData },
      },
    }));
  };

  const updateFinalContact = (profileId, contactData) => {
    setState(prev => ({
      ...prev,
      finalContacts: {
        ...prev.finalContacts,
        [profileId]: { ...(prev.finalContacts[profileId] || {}), ...contactData },
      },
    }));
  };

  const handleStart = (projectName, roles) => {
    const profiles = {};
    roles.forEach(r => { profiles[r] = []; });
    const now = new Date().toISOString();
    if (!currentProjectId) createNewProject();
    setState(prev => ({
      projectName, roles, profiles, selections: {}, contacts: {}, castingDays: [],
      castingSessions: {}, finalSelections: {}, finalContacts: {}, started: true,
      _createdAt: prev._createdAt || now, _updatedAt: now,
    }));
    setActiveRole(roles[0]);
  };

  // ---- Casting Day functions ----
  const addCastingDay = (date, location) => {
    const id = "day_" + Date.now().toString(36);
    const newDay = { id, date: date || "", location: location || "", notes: "", slots: [] };
    setState(prev => ({ ...prev, castingDays: [...prev.castingDays, newDay] }));
    setActiveCastingDay(id);
    setShowAddDay(false);
  };

  const updateCastingDay = (dayId, updates) => {
    setState(prev => ({
      ...prev,
      castingDays: prev.castingDays.map(d => d.id === dayId ? { ...d, ...updates } : d),
    }));
  };

  const deleteCastingDay = (dayId) => {
    setState(prev => ({ ...prev, castingDays: prev.castingDays.filter(d => d.id !== dayId) }));
    setActiveCastingDay(null);
  };

  const addSlot = (dayId, profileId, role) => {
    const slotId = "slot_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 4);
    setState(prev => ({
      ...prev,
      castingDays: prev.castingDays.map(d => {
        if (d.id !== dayId) return d;
        const lastSlot = d.slots[d.slots.length - 1];
        let nextTime = "09:00";
        if (lastSlot?.time && lastSlot?.duration) {
          const [h, m] = lastSlot.time.split(":").map(Number);
          const totalMin = h * 60 + m + (parseInt(lastSlot.duration) || 15);
          nextTime = `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
        }
        return { ...d, slots: [...d.slots, { id: slotId, profileId, role, time: nextTime, duration: "15", actingNotes: "", actingFile: null, actingFileName: "", availability: "pending" }] };
      }),
    }));
  };

  const updateSlot = (dayId, slotId, updates) => {
    setState(prev => ({
      ...prev,
      castingDays: prev.castingDays.map(d => {
        if (d.id !== dayId) return d;
        return { ...d, slots: d.slots.map(s => s.id === slotId ? { ...s, ...updates } : s) };
      }),
    }));
  };

  const removeSlot = (dayId, slotId) => {
    setState(prev => ({
      ...prev,
      castingDays: prev.castingDays.map(d => {
        if (d.id !== dayId) return d;
        return { ...d, slots: d.slots.filter(s => s.id !== slotId) };
      }),
    }));
  };

  const moveSlot = (dayId, fromIdx, toIdx) => {
    setState(prev => ({
      ...prev,
      castingDays: prev.castingDays.map(d => {
        if (d.id !== dayId) return d;
        const slots = [...d.slots];
        const [moved] = slots.splice(fromIdx, 1);
        slots.splice(toIdx, 0, moved);
        return { ...d, slots };
      }),
    }));
  };

  const recalcTimes = (dayId, startTime) => {
    setState(prev => ({
      ...prev,
      castingDays: prev.castingDays.map(d => {
        if (d.id !== dayId) return d;
        const [startH, startM] = (startTime || d.slots[0]?.time || "09:00").split(":").map(Number);
        let currentMin = startH * 60 + startM;
        const slots = d.slots.map(s => {
          const time = `${String(Math.floor(currentMin / 60)).padStart(2, "0")}:${String(currentMin % 60).padStart(2, "0")}`;
          currentMin += parseInt(s.duration) || 15;
          return { ...s, time };
        });
        return { ...d, slots };
      }),
    }));
  };

  // Generate Google Calendar URL for a slot
  const makeCalendarUrl = (day, slot, profile) => {
    const fullName = [profile?.firstName, profile?.name].filter(Boolean).join(" ") || "Acteur";
    const role = slot.role || "";
    const title = `Casting ${state.projectName || ""} - ${fullName} (${role})`;
    const location = day.location || "";
    const [h, m] = (slot.time || "09:00").split(":").map(Number);
    const dur = parseInt(slot.duration) || 15;
    const dateStr = day.date || new Date().toISOString().split("T")[0];
    const startDt = `${dateStr.replace(/-/g, "")}T${String(h).padStart(2,"0")}${String(m).padStart(2,"0")}00`;
    const endMin = h * 60 + m + dur;
    const endDt = `${dateStr.replace(/-/g, "")}T${String(Math.floor(endMin/60)).padStart(2,"0")}${String(endMin%60).padStart(2,"0")}00`;
    const details = `Casting pour le projet "${state.projectName || ""}"\\nRôle : ${role}\\nDurée : ${dur} minutes${slot.actingNotes ? "\\nNotes : " + slot.actingNotes : ""}${day.notes ? "\\nInfos : " + day.notes : ""}`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startDt}/${endDt}&location=${encodeURIComponent(location)}&details=${encodeURIComponent(details)}`;
  };

  // Open invite modal for a slot
  const openInviteModal = (day, slot, profile) => {
    const fullName = [profile?.firstName, profile?.name].filter(Boolean).join(" ") || "Acteur";
    const role = slot.role || "";
    const dateFormatted = day.date ? new Date(day.date + "T00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "[Date à définir]";
    const endTime = (() => {
      const [h, m] = (slot.time || "09:00").split(":").map(Number);
      const end = h * 60 + m + (parseInt(slot.duration) || 15);
      return `${String(Math.floor(end/60)).padStart(2,"0")}:${String(end%60).padStart(2,"0")}`;
    })();

    const body = `Bonjour ${fullName},\n\nVous êtes convoqué(e) au casting pour le projet "${state.projectName || ""}".\n\nRôle : ${role}\nDate : ${dateFormatted}\nHoraire : ${slot.time} → ${endTime} (${slot.duration} min)\n${day.location ? "Lieu : " + day.location + "\n" : ""}\nMerci de confirmer votre disponibilité en répondant à cet email.\n\nCordialement,\n${authUser?.firstName || "La direction de casting"}`;

    const infoBlock = `📋 INFORMATIONS PRATIQUES\n━━━━━━━━━━━━━━━━━━━━━━━\n\n📍 Adresse : ${day.location || "[À compléter]"}\n🚪 Accès : [Digicode, étage, salle...]\n🅿️ Parking : [Infos stationnement]\n📅 Date : ${dateFormatted}\n⏰ Heure de passage : ${slot.time}\n⏱ Durée : ${slot.duration} min\n🎭 Rôle : ${role}\n${slot.actingNotes ? "\n📝 Notes de jeu :\n" + slot.actingNotes : ""}\n${day.notes ? "\n📌 Consignes :\n" + day.notes : ""}`;

    setInviteMailBody(body);
    setInviteInfoBlock(infoBlock);
    setInviteModal({ day, slot, profile });
  };

  // Send the invite from modal
  const sendInviteFromModal = () => {
    if (!inviteModal) return;
    const { day, slot, profile } = inviteModal;
    const fullName = [profile?.firstName, profile?.name].filter(Boolean).join(" ") || "Acteur";
    const email = profile?.email || profile?.agencyEmail || "";
    const role = slot.role || "";
    const subject = `Convocation casting - ${state.projectName || "Projet"} - ${role}`;
    const calUrl = makeCalendarUrl(day, slot, profile);
    const fullBody = inviteMailBody + "\n\n" + inviteInfoBlock + "\n\n📅 Ajouter au calendrier :\n" + calUrl;
    window.open(`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullBody)}`, "_blank");
    updateSlot(day.id, slot.id, { availability: slot.availability === "dispo" ? "dispo" : "invited", _invitedAt: new Date().toISOString() });
    setState(p => ({ ...p, emailLog: [...(p.emailLog || []), {
      id: Date.now().toString(36), to: email, toName: fullName,
      subject, sentAt: new Date().toISOString(), role, type: "Convocation"
    }] }));
    setInviteModal(null);
  };

  // Send invites for all slots in a day (quick mode, skips modal)
  const sendAllDayInvites = (day) => {
    const uninvited = day.slots.filter(s => s.availability === "pending" || !s.availability);
    uninvited.forEach((slot, i) => {
      const profile = findProfile(slot.profileId);
      if (!profile?.email && !profile?.agencyEmail) return;
      const fullName = [profile?.firstName, profile?.name].filter(Boolean).join(" ") || "Acteur";
      const email = profile?.email || profile?.agencyEmail || "";
      const role = slot.role || "";
      const subject = `Convocation casting - ${state.projectName || "Projet"} - ${role}`;
      const calUrl = makeCalendarUrl(day, slot, profile);
      const dateFormatted = day.date ? new Date(day.date + "T00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";
      const endTime = (() => { const [h, m] = (slot.time || "09:00").split(":").map(Number); const end = h * 60 + m + (parseInt(slot.duration) || 15); return `${String(Math.floor(end/60)).padStart(2,"0")}:${String(end%60).padStart(2,"0")}`; })();
      const body = `Bonjour ${fullName},\n\nConvocation casting "${state.projectName || ""}".\nRôle : ${role}\nDate : ${dateFormatted}\nHoraire : ${slot.time} → ${endTime}\n${day.location ? "Lieu : " + day.location : ""}\n\n📅 Calendrier : ${calUrl}\n\nMerci de confirmer.\nCordialement`;
      setTimeout(() => {
        window.open(`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank");
        updateSlot(day.id, slot.id, { availability: "invited", _invitedAt: new Date().toISOString() });
      }, i * 400);
    });
  };

  // Helper: find profile by id across all roles
  const findProfile = (profileId) => {
    for (const role of state.roles) {
      const p = (state.profiles[role] || []).find(p => p.id === profileId);
      if (p) return { ...p, _role: role };
    }
    return null;
  };

  const getRoleColor = (roleName) => {
    const idx = state.roles.indexOf(roleName);
    return ROLE_COLORS[idx >= 0 ? idx % ROLE_COLORS.length : 0];
  };

  // ---- Casting Session functions ----
  const updateCastingSession = (profileId, updates) => {
    setState(prev => ({
      ...prev,
      castingSessions: {
        ...prev.castingSessions,
        [profileId]: { ...(prev.castingSessions[profileId] || { passStatus: "not_yet", liveNotes: "", castingVideos: [] }), ...updates },
      },
    }));
  };

  const addCastingVideo = (profileId, file) => {
    const url = URL.createObjectURL(file);
    setState(prev => {
      const session = prev.castingSessions[profileId] || { passStatus: "passed", liveNotes: "", castingVideos: [] };
      return {
        ...prev,
        castingSessions: {
          ...prev.castingSessions,
          [profileId]: { ...session, passStatus: "passed", castingVideos: [...(session.castingVideos || []), { url, name: file.name }] },
        },
      };
    });
  };

  const removeCastingVideo = (profileId, idx) => {
    setState(prev => {
      const session = prev.castingSessions[profileId];
      if (!session) return prev;
      const vids = [...(session.castingVideos || [])];
      vids.splice(idx, 1);
      return { ...prev, castingSessions: { ...prev.castingSessions, [profileId]: { ...session, castingVideos: vids } } };
    });
  };

  const updateFinalSelection = (profileId, updates) => {
    setState(prev => ({
      ...prev,
      finalSelections: {
        ...prev.finalSelections,
        [profileId]: { ...(prev.finalSelections[profileId] || { selected: null, comment: "" }), ...updates },
      },
    }));
  };

  // Get all profiles that went through casting (passStatus === "passed")
  const getCastingProfiles = () => {
    const result = [];
    state.roles.forEach(role => {
      (state.profiles[role] || []).forEach(p => {
        const sel = getChoice(p.id);
        if (sel === "yes" || sel === "maybe") {
          const session = state.castingSessions[p.id];
          result.push({ ...p, _role: role, _session: session || { passStatus: "not_yet", liveNotes: "", castingVideos: [] } });
        }
      });
    });
    return result;
  };

  const addProfile = (profile) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const newProfile = { id, availability: "pending", photos: [], selftapeVideos: [], selftapeLinks: [], source: "", email: "", phone: "", agencyEmail: "", shareContacts: false, hairColor: "", firstName: "", profileType: "", actingLevel: 0, saveToCastingFile: false, ...profile };
    setState(prev => ({
      ...prev,
      profiles: {
        ...prev.profiles,
        [activeRole]: [...(prev.profiles[activeRole] || []), newProfile],
      },
    }));
    if (newProfile.saveToCastingFile) saveActorToDatabase(newProfile, state.projectName);
    setModalOpen(false);
    setEditingProfile(null);
  };

  const updateProfile = (profile) => {
    setState(prev => ({
      ...prev,
      profiles: {
        ...prev.profiles,
        [activeRole]: prev.profiles[activeRole].map(p => p.id === profile.id ? profile : p),
      },
    }));
    if (profile.saveToCastingFile) saveActorToDatabase(profile, state.projectName);
    setModalOpen(false);
    setEditingProfile(null);
  };

  const deleteProfile = (id) => {
    setState(prev => ({
      ...prev,
      profiles: {
        ...prev.profiles,
        [activeRole]: prev.profiles[activeRole].filter(p => p.id !== id),
      },
    }));
    setModalOpen(false);
    setEditingProfile(null);
  };

  const changeStatus = (profileId, newStatus) => {
    setState(prev => ({
      ...prev,
      profiles: {
        ...prev.profiles,
        [activeRole]: prev.profiles[activeRole].map(p =>
          p.id === profileId ? { ...p, availability: newStatus } : p
        ),
      },
    }));
  };

  const addNewRole = () => {
    if (newRoleName.trim() && !state.roles.includes(newRoleName.trim())) {
      const role = newRoleName.trim();
      setState(prev => ({
        ...prev,
        roles: [...prev.roles, role],
        profiles: { ...prev.profiles, [role]: [] },
      }));
      setActiveRole(role);
      setNewRoleName("");
      setShowAddRole(false);
    }
  };

  const globalStyles = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Bebas+Neue&family=Playfair+Display:wght@700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'DM Sans', sans-serif; background: #0a0a0c; color: #e0e0e0; }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    ::selection { background: #c9a44a44; color: #fff; }
    .light-wrapper { filter: invert(1) hue-rotate(180deg); }
    .light-wrapper img, .light-wrapper video { filter: invert(1) hue-rotate(180deg); }
    input[type="date"] { background: #1a1a1e !important; border: 1px solid #3a3a3e !important; color: #e0e0e0 !important; border-radius: 8px; padding: 9px 12px; font-size: 13px; cursor: pointer; }
    input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.7); cursor: pointer; font-size: 16px; }
    input[type="date"]:hover { border-color: #c9a44a !important; }
    input[type="date"]:focus { border-color: #c9a44a !important; outline: none; }
  `;

  // ===== LOADING =====
  if (projectLoading) {
    return (
      <>
        <style>{globalStyles}</style>
        <div style={{ minHeight: "100vh", background: "#0a0a0c", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16, animation: "pulse 1s infinite" }}>🎬</div>
            <div style={{ fontSize: 14, color: "#888", animation: "pulse 1.5s infinite" }}>Chargement du projet...</div>
          </div>
        </div>
      </>
    );
  }

  // ===== DASHBOARD =====
  if (!currentProjectId) {
    return (
      <>
        <style>{globalStyles}</style>
        <div className={lightTheme ? "light-wrapper" : ""} style={{ minHeight: "100vh", background: "#0a0a0c" }}>
          <header style={{
            padding: "18px 32px", borderBottom: "1px solid #1a1a1e",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "rgba(10,10,12,0.9)", position: "relative",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ fontSize: 10, letterSpacing: "0.25em", textTransform: "uppercase", color: "#c9a44a", fontWeight: 600 }}>
                Casting Director
              </div>
              <div style={{ width: 1, height: 20, background: "#2a2a2e" }} />
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => { setCastingFileView(false); setComptaView(false); }} style={{
                  padding: "6px 16px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                  fontFamily: "inherit", border: "none", cursor: "pointer",
                  background: !castingFileView && !comptaView ? "rgba(201,164,74,0.12)" : "transparent",
                  color: !castingFileView && !comptaView ? "#c9a44a" : "#555", transition: "all 0.2s",
                }}>🎬 Projets</button>
                <button onClick={() => { setCastingFileView(true); setComptaView(false); }} style={{
                  padding: "6px 16px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                  fontFamily: "inherit", border: "none", cursor: "pointer",
                  background: castingFileView && !comptaView ? "rgba(168,85,247,0.12)" : "transparent",
                  color: castingFileView && !comptaView ? "#a855f7" : "#555", transition: "all 0.2s",
                  position: "relative",
                }}>
                  📁 Fichier Casting
                  {actorDatabase.length > 0 && (
                    <span style={{ position: "absolute", top: -2, right: -4, fontSize: 9, fontWeight: 700, background: "#a855f7", color: "#000", borderRadius: 10, padding: "1px 5px", minWidth: 14, textAlign: "center" }}>{actorDatabase.length}</span>
                  )}
                </button>
                <button onClick={() => { setComptaView(true); setCastingFileView(false); }} style={{
                  padding: "6px 16px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                  fontFamily: "inherit", border: "none", cursor: "pointer",
                  background: comptaView ? "rgba(34,197,94,0.12)" : "transparent",
                  color: comptaView ? "#22c55e" : "#555", transition: "all 0.2s",
                }}>
                  💰 Comptabilité
                </button>
              </div>
            </div>
            {/* Global search */}
            <div style={{ position: "relative" }}>
              <input value={globalSearch} onChange={e => { setGlobalSearch(e.target.value); setGlobalSearchOpen(true); }}
                placeholder="🔍 Recherche globale..."
                style={{ padding: "8px 14px", background: "#111114", border: "1px solid #2a2a2e", borderRadius: 8, color: "#e0e0e0", fontSize: 12, fontFamily: "'DM Sans',sans-serif", outline: "none", width: 240 }}
                onFocus={e => { if (globalSearch.length >= 2) setGlobalSearchOpen(true); e.target.style.borderColor="#c9a44a"; }} onBlur={e => { setTimeout(() => setGlobalSearchOpen(false), 200); e.target.style.borderColor="#2a2a2e"; }} />
              {globalSearchOpen && globalSearch.length >= 2 && (() => {
                const res = getGlobalSearchResults(globalSearch);
                if (res.projects.length === 0 && res.actors.length === 0) return <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 6, width: 320, background: "#141416", border: "1px solid #2a2a2e", borderRadius: 12, padding: "16px", zIndex: 999, fontSize: 12, color: "#555" }}>Aucun résultat</div>;
                return (
                  <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 6, width: 360, background: "#141416", border: "1px solid #2a2a2e", borderRadius: 12, padding: "8px", zIndex: 999, maxHeight: 400, overflow: "auto" }}>
                    {res.projects.length > 0 && (
                      <>
                        <div style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", padding: "6px 10px" }}>Projets</div>
                        {res.projects.map(p => (
                          <div key={p.id} onClick={() => { loadProject(p.id); setGlobalSearch(""); setGlobalSearchOpen(false); }}
                            style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}
                            onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.03)"}
                            onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                            <span>🎬</span><span style={{ fontWeight: 600, color: "#f0f0f0" }}>{p.name || "Sans titre"}</span>
                            <span style={{ fontSize: 9, color: "#555", marginLeft: "auto" }}>{p.rolesCount} rôles</span>
                          </div>
                        ))}
                      </>
                    )}
                    {res.actors.length > 0 && (
                      <>
                        <div style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", padding: "6px 10px", marginTop: 4 }}>Acteurs</div>
                        {res.actors.map(a => (
                          <div key={a.id} onClick={() => { setCastingFileView(true); setActorDetail(a); setGlobalSearch(""); setGlobalSearchOpen(false); }}
                            style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}
                            onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.03)"}
                            onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                            <div style={{ width: 26, height: 26, borderRadius: 5, overflow: "hidden", background: "#0c0c0e", flexShrink: 0 }}>
                              {a.photos?.[0] ? <img src={a.photos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: 10 }}>◎</div>}
                            </div>
                            <span style={{ fontWeight: 600, color: "#f0f0f0" }}>{[a.firstName, a.name].filter(Boolean).join(" ")}</span>
                            {a.agency && <span style={{ fontSize: 9, color: "#8a7740", marginLeft: "auto" }}>{a.agency}</span>}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
            {/* Theme toggle */}
            <button onClick={() => setLightTheme(!lightTheme)}
              style={{ padding: "6px 10px", background: "none", border: "1px solid #2a2a2e", borderRadius: 6, cursor: "pointer", fontSize: 14, lineHeight: 1 }}
              title={lightTheme ? "Mode sombre" : "Mode clair"}>
              {lightTheme ? "🌙" : "☀️"}
            </button>
            {/* Branding */}
          </header>

          {comptaView ? (() => {
          const stats = getComptaStats();
          const fmtMoney = (v) => v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
          const filtered = comptaInvoices.filter(inv => {
            const st = getInvoiceStatus(inv);
            if (comptaFilter !== "all" && st !== comptaFilter) return false;
            if (comptaSearch) {
              const q = comptaSearch.toLowerCase();
              return (inv.projectName || "").toLowerCase().includes(q) || (inv.clientName || "").toLowerCase().includes(q) || (inv.devisNumber || "").toLowerCase().includes(q);
            }
            return true;
          });

          if (comptaDetail) {
            const inv = comptaDetail;
            const st = getInvoiceStatus(inv);
            const stInfo = COMPTA_STATUS[st] || COMPTA_STATUS.draft;
            const cs = comptaStatuses[inv.projectId] || {};
            return (
              <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
                <button onClick={() => setComptaDetail(null)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 12, fontFamily: "inherit", marginBottom: 20, padding: 0 }}>← Retour</button>

                {/* Invoice header */}
                <div style={{ background: "#141416", borderRadius: 16, border: "1px solid #222226", padding: "28px 32px", marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                    <div>
                      <div style={{ fontSize: 10, color: "#c9a44a", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 6 }}>Facture / Devis</div>
                      <h2 style={{ fontSize: 24, fontWeight: 800, color: "#f0f0f0", margin: 0 }}>{inv.projectName}</h2>
                      {inv.devisNumber && <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>N° {inv.devisNumber}</div>}
                    </div>
                    <div style={{ padding: "8px 18px", background: stInfo.bg, border: `1px solid ${stInfo.color}33`, borderRadius: 10 }}>
                      <span style={{ fontSize: 14, marginRight: 6 }}>{stInfo.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: stInfo.color }}>{stInfo.label}</span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px 24px", marginBottom: 20 }}>
                    <div><div style={{ fontSize: 10, color: "#555", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Client</div><div style={{ fontSize: 14, color: "#e0e0e0" }}>{inv.clientName || "—"}</div></div>
                    <div><div style={{ fontSize: 10, color: "#555", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Date devis</div><div style={{ fontSize: 14, color: "#e0e0e0" }}>{inv.devisDate ? fmtDateFR(inv.devisDate) : "—"}</div></div>
                    <div><div style={{ fontSize: 10, color: "#555", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Tournage</div><div style={{ fontSize: 14, color: "#e0e0e0" }}>{inv.dateTournage ? fmtDateFR(inv.dateTournage) : "—"}</div></div>
                    <div><div style={{ fontSize: 10, color: "#555", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Ma rémunération</div><div style={{ fontSize: 14, color: "#c9a44a", fontWeight: 700 }}>{inv.salary?.amount ? inv.salary.amount + " € (" + (inv.salary.type === "facture" ? "Facture" : "Fiche de paie") + ")" : "—"}</div></div>
                    {inv.totalTTC > 0 && <div><div style={{ fontSize: 10, color: "#555", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Total TTC devis</div><div style={{ fontSize: 14, color: "#22c55e", fontWeight: 700 }}>{fmtMoney(inv.totalTTC)}</div></div>}
                  </div>

                  {/* Lines detail */}
                  {inv.lines.length > 0 && (
                    <div style={{ borderTop: "1px solid #1e1e22", paddingTop: 16, marginBottom: 16 }}>
                      <div style={{ fontSize: 10, color: "#60a5fa", fontWeight: 600, textTransform: "uppercase", marginBottom: 10 }}>Lignes de prestation</div>
                      <div style={{ display: "grid", gridTemplateColumns: "2fr 60px 80px 90px 70px", gap: 6, marginBottom: 6 }}>
                        {["Description", "Qté", "Unité", "Prix HT", "Total"].map(h => <div key={h} style={{ fontSize: 9, color: "#555", fontWeight: 700, textTransform: "uppercase" }}>{h}</div>)}
                      </div>
                      {inv.lines.map((l, i) => (
                        <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 60px 80px 90px 70px", gap: 6, padding: "6px 0", borderBottom: "1px solid #1a1a1e", fontSize: 13 }}>
                          <div style={{ color: "#e0e0e0" }}>{l.description || "—"}</div>
                          <div style={{ color: "#aaa", textAlign: "center" }}>{l.qty}</div>
                          <div style={{ color: "#aaa" }}>{l.unit}</div>
                          <div style={{ color: "#aaa", textAlign: "right" }}>{parseFloat(l.unitPrice || 0).toFixed(2)} €</div>
                          <div style={{ color: "#e0e0e0", textAlign: "right", fontWeight: 600 }}>{((parseFloat(l.unitPrice) || 0) * (parseFloat(l.qty) || 0)).toFixed(2)} €</div>
                        </div>
                      ))}
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 13, color: "#888", marginBottom: 4 }}>HT: <span style={{ color: "#e0e0e0", fontWeight: 600 }}>{fmtMoney(inv.totalHT)}</span></div>
                          <div style={{ fontSize: 13, color: "#888", marginBottom: 4 }}>TVA: <span style={{ color: "#e0e0e0" }}>{fmtMoney(inv.totalTVA)}</span></div>
                          <div style={{ fontSize: 16, color: "#c9a44a", fontWeight: 700 }}>TTC: {fmtMoney(inv.totalTTC)}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Status management */}
                <div style={{ background: "#141416", borderRadius: 16, border: "1px solid #222226", padding: "24px 28px", marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: "#e879f9", fontWeight: 600, textTransform: "uppercase", marginBottom: 16 }}>📊 Suivi de facturation</div>

                  {/* Status buttons */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                    {Object.entries(COMPTA_STATUS).map(([key, val]) => (
                      <button key={key} onClick={() => saveComptaStatus(inv.projectId, { status: key, ...(key === "sent" && !cs.sentDate ? { sentDate: new Date().toISOString().split("T")[0] } : {}), ...(key === "paid" && !cs.paidDate ? { paidDate: new Date().toISOString().split("T")[0] } : {}) })} style={{
                        padding: "10px 20px", borderRadius: 10, fontSize: 12, fontWeight: 700,
                        fontFamily: "inherit", cursor: "pointer", border: "2px solid",
                        background: st === key ? val.bg : "transparent",
                        color: st === key ? val.color : "#555",
                        borderColor: st === key ? val.color + "55" : "#2a2a2e",
                        transition: "all 0.2s",
                      }}>
                        {val.icon} {val.label}
                      </button>
                    ))}
                  </div>

                  {/* Date fields */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 16 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 10, color: "#888", fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>Date d'envoi</label>
                      <input type="date" value={cs.sentDate || ""} onChange={e => saveComptaStatus(inv.projectId, { sentDate: e.target.value })} style={{ width: "100%", padding: "9px 12px", background: "#0c0c0e", border: "1px solid #2a2a2e", borderRadius: 8, color: "#e0e0e0", fontSize: 12, fontFamily: "'DM Sans',sans-serif", outline: "none", cursor: "pointer", boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 10, color: "#888", fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>Date de paiement</label>
                      <input type="date" value={cs.paidDate || ""} onChange={e => saveComptaStatus(inv.projectId, { paidDate: e.target.value })} style={{ width: "100%", padding: "9px 12px", background: "#0c0c0e", border: "1px solid #2a2a2e", borderRadius: 8, color: "#e0e0e0", fontSize: 12, fontFamily: "'DM Sans',sans-serif", outline: "none", cursor: "pointer", boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 10, color: "#888", fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>Nb de relances</label>
                      <input type="number" min="0" value={cs.relanceCount || 0} onChange={e => saveComptaStatus(inv.projectId, { relanceCount: parseInt(e.target.value) || 0 })} style={{ width: "100%", padding: "9px 12px", background: "#0c0c0e", border: "1px solid #2a2a2e", borderRadius: 8, color: "#e0e0e0", fontSize: 12, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" }} />
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label style={{ display: "block", fontSize: 10, color: "#888", fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>Notes comptabilité</label>
                    <textarea value={cs.notes || ""} onChange={e => saveComptaStatus(inv.projectId, { notes: e.target.value })} placeholder="Notes, relances, infos de paiement..." rows={3} style={{ width: "100%", padding: "10px 14px", background: "#111114", border: "1px solid #2a2a2e", borderRadius: 10, color: "#e0e0e0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
                  </div>
                </div>

                {/* Timeline */}
                {(cs.sentDate || cs.paidDate || cs.relanceCount > 0) && (
                  <div style={{ background: "#141416", borderRadius: 16, border: "1px solid #222226", padding: "24px 28px" }}>
                    <div style={{ fontSize: 11, color: "#c9a44a", fontWeight: 600, textTransform: "uppercase", marginBottom: 16 }}>📋 Historique</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {inv.devisDate && <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: "#888" }} /><span style={{ color: "#888" }}>Devis créé</span><span style={{ color: "#555", marginLeft: "auto" }}>{fmtDateFR(inv.devisDate)}</span></div>}
                      {cs.sentDate && <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: "#60a5fa" }} /><span style={{ color: "#60a5fa" }}>Facture envoyée</span><span style={{ color: "#555", marginLeft: "auto" }}>{fmtDateFR(cs.sentDate)}</span></div>}
                      {cs.relanceCount > 0 && <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} /><span style={{ color: "#f59e0b" }}>{cs.relanceCount} relance{cs.relanceCount > 1 ? "s" : ""}</span></div>}
                      {cs.paidDate && <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} /><span style={{ color: "#22c55e" }}>Payée</span><span style={{ color: "#555", marginLeft: "auto" }}>{fmtDateFR(cs.paidDate)}</span></div>}
                    </div>
                  </div>
                )}
              </div>
            );
          }

          return (
            <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
                <div>
                  <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f0f0f0", fontFamily: "'Playfair Display', serif", marginBottom: 4 }}>💰 Comptabilité</h1>
                  <p style={{ fontSize: 13, color: "#666" }}>Suivi financier — {comptaInvoices.length} projet{comptaInvoices.length !== 1 ? "s" : ""}</p>
                </div>
                <button onClick={() => { setComptaLoaded(false); loadComptaData(); }} style={{ padding: "8px 16px", background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit", color: "#60a5fa" }}>🔄 Actualiser</button>
              </div>

              {!comptaLoaded ? (
                <div style={{ textAlign: "center", padding: 60, color: "#555" }}>⏳ Chargement...</div>
              ) : (
                <>
                  {/* KPI Cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14, marginBottom: 28 }}>
                    {[
                      { label: "Total facturé", value: fmtMoney(stats.totalFacture), color: "#e0e0e0", sub: comptaInvoices.length + " projets", icon: "📊" },
                      { label: "Payé", value: fmtMoney(stats.totalPaye), color: "#22c55e", sub: stats.nbPaid + " facture" + (stats.nbPaid > 1 ? "s" : ""), icon: "✅" },
                      { label: "En attente", value: fmtMoney(stats.totalEnAttente), color: "#60a5fa", sub: stats.nbSent + " envoyée" + (stats.nbSent > 1 ? "s" : ""), icon: "📨" },
                      { label: "En retard", value: fmtMoney(stats.totalEnRetard), color: stats.totalEnRetard > 0 ? "#ef4444" : "#666", sub: stats.nbOverdue + " facture" + (stats.nbOverdue > 1 ? "s" : ""), icon: "⚠️" },
                    ].map(kpi => (
                      <div key={kpi.label} style={{ background: "#141416", borderRadius: 14, border: "1px solid #222226", padding: "20px 22px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <span style={{ fontSize: 10, color: "#888", fontWeight: 600, textTransform: "uppercase" }}>{kpi.label}</span>
                          <span style={{ fontSize: 16 }}>{kpi.icon}</span>
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: kpi.color, fontFamily: "'Playfair Display',serif", marginBottom: 4 }}>{kpi.value}</div>
                        <div style={{ fontSize: 11, color: "#555" }}>{kpi.sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* Profit bar */}
                  {stats.totalFacture > 0 && (
                    <div style={{ background: "#141416", borderRadius: 14, border: "1px solid #222226", padding: "16px 22px", marginBottom: 24 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: "#888", fontWeight: 600 }}>Taux de recouvrement</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#c9a44a" }}>{(stats.totalPaye / stats.totalFacture * 100).toFixed(0)}%</span>
                      </div>
                      <div style={{ height: 8, background: "#2a2a2e", borderRadius: 8, overflow: "hidden", display: "flex" }}>
                        <div style={{ height: "100%", width: `${(stats.totalPaye / stats.totalFacture * 100)}%`, background: "#22c55e", borderRadius: 8, transition: "width 0.5s" }} />
                        <div style={{ height: "100%", width: `${(stats.totalEnAttente / stats.totalFacture * 100)}%`, background: "#60a5fa", transition: "width 0.5s" }} />
                        <div style={{ height: "100%", width: `${(stats.totalEnRetard / stats.totalFacture * 100)}%`, background: "#ef4444", transition: "width 0.5s" }} />
                      </div>
                      <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                        {[{ l: "Payé", c: "#22c55e" }, { l: "En attente", c: "#60a5fa" }, { l: "En retard", c: "#ef4444" }, { l: "Brouillon", c: "#555" }].map(x => (
                          <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#888" }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: x.c }} />{x.l}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Filter + Search */}
                  <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      {[{ k: "all", l: "Toutes", n: comptaInvoices.length }, { k: "draft", l: "Brouillon", n: stats.nbDraft, c: "#888" }, { k: "sent", l: "Envoyées", n: stats.nbSent, c: "#60a5fa" }, { k: "overdue", l: "En retard", n: stats.nbOverdue, c: "#ef4444" }, { k: "paid", l: "Payées", n: stats.nbPaid, c: "#22c55e" }].map(f => (
                        <button key={f.k} onClick={() => setComptaFilter(f.k)} style={{
                          padding: "7px 14px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                          fontFamily: "inherit", border: "none", cursor: "pointer",
                          background: comptaFilter === f.k ? (f.c ? `${f.c}18` : "rgba(255,255,255,0.06)") : "transparent",
                          color: comptaFilter === f.k ? (f.c || "#ccc") : "#555",
                        }}>
                          {f.l} {f.n > 0 && <span style={{ marginLeft: 3, fontSize: 9, opacity: 0.7 }}>{f.n}</span>}
                        </button>
                      ))}
                    </div>
                    <input value={comptaSearch} onChange={e => setComptaSearch(e.target.value)} placeholder="🔍 Rechercher projet, client..."
                      style={{ marginLeft: "auto", padding: "8px 14px", background: "#111114", border: "1px solid #2a2a2e", borderRadius: 8, color: "#e0e0e0", fontSize: 12, fontFamily: "'DM Sans',sans-serif", outline: "none", width: 220 }} />
                    <button onClick={() => {
                      const headers = ["Projet","N° Devis","Client","Date Devis","Date Tournage","Rémunération","Type","Total HT","Total TVA","Total TTC","Statut","Date Envoi","Date Paiement","Relances","Notes"];
                      const rows = filtered.map(inv => {
                        const st = getInvoiceStatus(inv);
                        const stInfo = COMPTA_STATUS[st] || COMPTA_STATUS.draft;
                        const cs = comptaStatuses[inv.projectId] || {};
                        return [
                          inv.projectName || "",
                          inv.devisNumber || "",
                          inv.clientName || "",
                          inv.devisDate || "",
                          inv.dateTournage || "",
                          inv.salary?.amount || "",
                          inv.salary?.type || "",
                          inv.totalHT || 0,
                          inv.totalTVA || 0,
                          inv.totalTTC || 0,
                          stInfo.label,
                          cs.sentDate || "",
                          cs.paidDate || "",
                          cs.relanceCount || 0,
                          (cs.notes || "").replace(/\n/g, " ")
                        ];
                      });
                      const csv = [headers, ...rows].map(r => r.map(c => '"' + String(c || "").replace(/"/g, '""') + '"').join(",")).join("\n");
                      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `comptabilite-export-${new Date().toISOString().slice(0, 10)}.csv`;
                      a.click();
                    }} style={{
                      padding: "8px 16px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
                      borderRadius: 8, color: "#22c55e", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                      whiteSpace: "nowrap"
                    }}>📊 Exporter CSV</button>
                  </div>

                  {/* Table */}
                  <div style={{ background: "#141416", borderRadius: 14, border: "1px solid #222226", overflow: "hidden" }}>
                    {/* Table header */}
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 100px 100px 90px 90px", gap: 10, padding: "12px 22px", borderBottom: "1px solid #222226", background: "rgba(255,255,255,0.015)" }}>
                      {["Projet", "Client", "Montant", "Statut", "Envoyé", "Payé"].map(h => (
                        <div key={h} style={{ fontSize: 9, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</div>
                      ))}
                    </div>

                    {filtered.length === 0 && (
                      <div style={{ textAlign: "center", padding: "40px 20px", color: "#444" }}>
                        {comptaInvoices.length === 0 ? "Aucun projet avec des données financières." : "Aucun résultat pour ce filtre."}
                      </div>
                    )}

                    {filtered.map(inv => {
                      const st = getInvoiceStatus(inv);
                      const stInfo = COMPTA_STATUS[st] || COMPTA_STATUS.draft;
                      const cs = comptaStatuses[inv.projectId] || {};
                      const amount = inv.totalTTC > 0 ? inv.totalTTC : (parseFloat(inv.salary?.amount) || 0);
                      return (
                        <div key={inv.projectId} onClick={() => setComptaDetail(inv)}
                          style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 100px 100px 90px 90px", gap: 10, padding: "14px 22px", borderBottom: "1px solid #1a1a1e", cursor: "pointer", alignItems: "center", transition: "background 0.15s" }}
                          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#f0f0f0", marginBottom: 2 }}>{inv.projectName}</div>
                            <div style={{ fontSize: 10, color: "#555" }}>{inv.devisNumber || "Sans n° devis"} · {inv.roles.length} rôle{inv.roles.length > 1 ? "s" : ""}</div>
                          </div>
                          <div style={{ fontSize: 12, color: "#aaa" }}>{inv.clientName || "—"}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: amount > 0 ? "#e0e0e0" : "#444" }}>
                            {amount > 0 ? fmtMoney(amount) : "—"}
                          </div>
                          <div>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", background: stInfo.bg, borderRadius: 6, fontSize: 10, fontWeight: 700, color: stInfo.color, border: `1px solid ${stInfo.color}22` }}>
                              {stInfo.icon} {stInfo.label}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: cs.sentDate ? "#60a5fa" : "#333" }}>
                            {cs.sentDate ? fmtDateFR(cs.sentDate) : "—"}
                          </div>
                          <div style={{ fontSize: 11, color: cs.paidDate ? "#22c55e" : "#333" }}>
                            {cs.paidDate ? fmtDateFR(cs.paidDate) : "—"}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Quick summary footer */}
                  {filtered.length > 0 && (
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 24, marginTop: 14, padding: "0 10px" }}>
                      <span style={{ fontSize: 12, color: "#888" }}>Total affiché: <span style={{ fontWeight: 700, color: "#e0e0e0" }}>{fmtMoney(filtered.reduce((s, inv) => s + (inv.totalTTC > 0 ? inv.totalTTC : (parseFloat(inv.salary?.amount) || 0)), 0))}</span></span>
                    </div>
                  )}
                </>
              )}
            </div>
          );
          })() : !castingFileView ? (
          /* ===== PROJECTS LIST ===== */
          <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f0f0f0", fontFamily: "'Playfair Display', serif", marginBottom: 4 }}>
                  {authUser?.firstName ? `Bonjour ${authUser.firstName} 👋` : "Mes Projets"}
                </h1>
                <p style={{ fontSize: 13, color: "#666" }}>
                  {projectList.length} projet{projectList.length !== 1 ? "s" : ""}
                </p>
              </div>
              <button
                onClick={createNewProject}
                style={{
                  padding: "12px 28px", background: "linear-gradient(135deg, #c9a44a, #b8963a)",
                  border: "none", borderRadius: 12, cursor: "pointer", fontSize: 14,
                  fontWeight: 700, fontFamily: "inherit", color: "#000",
                  boxShadow: "0 4px 20px rgba(201,164,74,0.3)", transition: "transform 0.2s",
                }}
                onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
                onMouseLeave={e => e.currentTarget.style.transform = ""}
              >
                + Nouveau projet
              </button>
            </div>

            {/* Storage & Backup bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, padding: "14px 18px", background: "#111114", borderRadius: 12, border: "1px solid #1e1e22" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "#888", fontWeight: 600 }}>💾 Stockage vidéo</span>
                  <span style={{ fontSize: 10, color: "#666" }}>{storageInfo.usedMB} MB / {storageInfo.maxMB} MB</span>
                </div>
                <div style={{ height: 4, background: "#2a2a2e", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(storageInfo.percentage, 100)}%`, background: storageInfo.percentage > 80 ? "#ef4444" : storageInfo.percentage > 50 ? "#f59e0b" : "#22c55e", borderRadius: 4, transition: "width 0.5s" }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={handleImportBackup}
                  style={{ padding: "8px 14px", background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.2)", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit", color: "#fb923c", whiteSpace: "nowrap" }}>
                  📤 Restaurer
                </button>
                <button onClick={handleExportBackup}
                  disabled={backupStatus === "exporting"}
                  style={{
                    padding: "8px 14px", background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)",
                    borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit",
                    color: backupStatus === "done" ? "#22c55e" : "#60a5fa", transition: "all 0.2s", whiteSpace: "nowrap",
                  }}>
                  {backupStatus === "exporting" ? "⏳ Export..." : backupStatus === "done" ? "✓ Sauvegardé !" : "💾 Sauvegarder tout"}
                </button>
              </div>
            </div>

            {/* Status filter tabs */}
            <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
              {[{ key: "all", label: "Tous" }, ...Object.entries(PROJECT_STATUSES).map(([k, v]) => ({ key: k, label: v.label, color: v.color }))].map(f => (
                <button key={f.key} onClick={() => setProjectFilter(f.key)} style={{
                  padding: "6px 14px", borderRadius: 6, fontSize: 10, fontWeight: 600,
                  fontFamily: "inherit", border: "none", cursor: "pointer",
                  background: projectFilter === f.key ? (f.color ? `${f.color}18` : "rgba(255,255,255,0.06)") : "transparent",
                  color: projectFilter === f.key ? (f.color || "#ccc") : "#555",
                  transition: "all 0.2s",
                }}>
                  {f.label}
                  {f.key !== "all" && <span style={{ marginLeft: 4, opacity: 0.6 }}>{projectList.filter(p => (p.status || "en_cours") === f.key).length}</span>}
                </button>
              ))}
            </div>

            {!projectsLoaded ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#555" }}>
                <div style={{ fontSize: 14, animation: "pulse 1.5s infinite" }}>Chargement...</div>
              </div>
            ) : projectList.length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 24px", background: "#111114", borderRadius: 20, border: "1px solid #1e1e22" }}>
                <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.3 }}>🎬</div>
                <div style={{ fontSize: 16, color: "#888", marginBottom: 8 }}>Aucun projet encore</div>
                <div style={{ fontSize: 13, color: "#555" }}>Créez votre premier projet de casting</div>
              </div>
            ) : (() => {
              const filtered = projectFilter === "all" ? projectList : projectList.filter(p => (p.status || "en_cours") === projectFilter);
              return filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#555", fontSize: 13 }}>Aucun projet avec ce statut</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {filtered.map((proj, i) => {
                    const st = PROJECT_STATUSES[proj.status || "en_cours"] || PROJECT_STATUSES.en_cours;
                    return (
                      <div key={proj.id} style={{
                        display: "flex", alignItems: "center", gap: 16, padding: "20px 24px",
                        background: "#111114", borderRadius: 16, border: "1px solid #1e1e22",
                        cursor: "pointer", transition: "all 0.2s", animation: `fadeIn 0.3s ease ${i * 0.05}s both`,
                      }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "#c9a44a44"; e.currentTarget.style.background = "#141417"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e1e22"; e.currentTarget.style.background = "#111114"; }}
                        onClick={() => loadProject(proj.id)}
                      >
                        <div style={{ width: 48, height: 48, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, background: "rgba(201,164,74,0.08)", flexShrink: 0 }}>🎬</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: "#f0f0f0" }}>{proj.name || "Sans titre"}</span>
                            <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, fontWeight: 600, background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>{st.label}</span>
                          </div>
                          <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#666" }}>
                            <span>{proj.rolesCount} rôle{proj.rolesCount !== 1 ? "s" : ""}</span>
                            <span>{proj.profilesCount} profil{proj.profilesCount !== 1 ? "s" : ""}</span>
                            {proj.finalCount > 0 && <span style={{ color: "#22c55e" }}>🏆 {proj.finalCount}</span>}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                          {proj.updatedAt && <span style={{ fontSize: 10, color: "#555", marginRight: 4 }}>{new Date(proj.updatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>}
                          <select value={proj.status || "en_cours"} onChange={e => updateProjectStatus(proj.id, e.target.value)}
                            onClick={e => e.stopPropagation()}
                            style={{ padding: "4px 6px", background: "#0c0c0e", border: "1px solid #2a2a2e", borderRadius: 5, color: "#999", fontSize: 9, fontFamily: "inherit", outline: "none", cursor: "pointer" }}>
                            {Object.entries(PROJECT_STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                          </select>
                          <button onClick={e => { e.stopPropagation(); duplicateProject(proj.id); }}
                            title="Dupliquer"
                            style={{ background: "none", border: "1px solid #2a2a2e", borderRadius: 5, color: "#666", fontSize: 11, cursor: "pointer", fontFamily: "inherit", padding: "3px 7px" }}
                            onMouseEnter={e => e.currentTarget.style.color = "#c9a44a"}
                            onMouseLeave={e => e.currentTarget.style.color = "#666"}
                          >⊕</button>
                          <button onClick={e => { e.stopPropagation(); if (window.confirm(`Supprimer "${proj.name || "Sans titre"}" ?`)) deleteProject(proj.id); }}
                            style={{ background: "none", border: "1px solid #2a2a2e", borderRadius: 5, color: "#444", fontSize: 11, cursor: "pointer", fontFamily: "inherit", padding: "3px 7px" }}
                            onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                            onMouseLeave={e => e.currentTarget.style.color = "#444"}
                          >✕</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          ) : (
          /* ===== FICHIER CASTING (ACTOR DATABASE) ===== */
          <>
          {/* Shared hidden photo input */}
          <input ref={actorPhotoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
            const file = e.target.files?.[0];
            if (!file) return;
            (async () => {
              try {
                const actorId = actorEditForm?.id || actorEditForm?.name || "actor";
                const { url } = await uploadPhoto(file, "actors", actorId, actorPhotoIdx || 0);
                setActorEditForm(prev => {
                  const photos = [...(prev?.photos || [])];
                  if (actorPhotoIdx !== null && actorPhotoIdx < 3) {
                    photos[actorPhotoIdx] = url;
                  } else {
                    photos.push(url);
                  }
                  return { ...prev, photos: photos.slice(0, 3) };
                });
              } catch (err) {
                console.error("[actorPhotoUpload] Supabase failed, falling back:", err.message);
                const reader = new FileReader();
                reader.onload = async (ev) => {
                  const compressed = await compressImage(ev.target.result, 600, 0.7);
                  setActorEditForm(prev => {
                    const photos = [...(prev?.photos || [])];
                    if (actorPhotoIdx !== null && actorPhotoIdx < 3) {
                      photos[actorPhotoIdx] = compressed;
                    } else {
                      photos.push(compressed);
                    }
                    return { ...prev, photos: photos.slice(0, 3) };
                  });
                };
                reader.readAsDataURL(file);
              }
            })();
            e.target.value = "";
          }} />
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
            {actorDetail ? (
              /* --- ACTOR DETAIL VIEW --- */
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <button onClick={() => { setActorDetail(null); setActorEditMode(false); }} style={{
                    padding: "8px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid #2a2a2e",
                    borderRadius: 8, cursor: "pointer", fontSize: 12, fontFamily: "inherit", color: "#888",
                  }}>← Retour au fichier</button>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => toggleActorFavorite(actorDetail.id)} style={{
                      padding: "8px 14px", background: actorDetail._favorite ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.03)",
                      border: actorDetail._favorite ? "1px solid rgba(245,158,11,0.3)" : "1px solid #2a2a2e",
                      borderRadius: 8, cursor: "pointer", fontSize: 14, fontFamily: "inherit",
                      color: actorDetail._favorite ? "#f59e0b" : "#555",
                    }}>{actorDetail._favorite ? "★" : "☆"}</button>
                    <button onClick={() => {
                      if (actorEditMode) {
                        updateActorInDatabase(actorEditForm);
                        setActorEditMode(false);
                      } else {
                        setActorEditForm({ ...actorDetail });
                        setActorEditMode(true);
                      }
                    }} style={{
                      padding: "8px 16px", background: actorEditMode ? "rgba(34,197,94,0.1)" : "rgba(168,85,247,0.08)",
                      border: `1px solid ${actorEditMode ? "rgba(34,197,94,0.3)" : "rgba(168,85,247,0.2)"}`,
                      borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                      color: actorEditMode ? "#22c55e" : "#a855f7",
                    }}>{actorEditMode ? "✓ Sauvegarder" : "✏ Modifier"}</button>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
                  {/* Photos */}
                  <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                    {[0, 1, 2].map(i => {
                      const src = (actorEditMode ? actorEditForm : actorDetail)?.photos?.[i];
                      return (
                        <div key={i} style={{
                          width: 160, height: 200, borderRadius: 12, overflow: "hidden", background: "#111114",
                          border: actorEditMode ? "1.5px dashed #444" : "1px solid #1e1e22",
                          cursor: actorEditMode ? "pointer" : "default", position: "relative",
                        }} onClick={() => { if (actorEditMode) { setActorPhotoIdx(i); actorPhotoRef.current?.click(); } }}>
                          {src ? (
                            <>
                              <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              {actorEditMode && (
                                <div onClick={e => { e.stopPropagation(); setActorEditForm(p => ({ ...p, photos: (p?.photos || []).filter((_, j) => j !== i) })); }}
                                  style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: "50%", background: "rgba(239,68,68,0.9)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, cursor: "pointer" }}>✕</div>
                              )}
                            </>
                          ) : (
                            <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: actorEditMode ? "#666" : "#333", fontSize: actorEditMode ? 13 : 28, gap: 4 }}>
                              {actorEditMode ? <><span style={{ fontSize: 24 }}>+</span><span style={{ fontSize: 9 }}>Photo</span></> : "◎"}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {actorEditMode && (
                    <div style={{ display: "flex", gap: 6, marginTop: 6, maxWidth: 340 }}>
                      <input value={photoUrlInput} onChange={e => setPhotoUrlInput(e.target.value)} placeholder="📎 URL d'image..."
                        style={{ flex: 1, padding: "5px 8px", background: "#0c0c0e", border: "1px solid #2a2a2e", borderRadius: 6, color: "#e0e0e0", fontSize: 10, fontFamily: "'DM Sans',sans-serif", outline: "none" }} />
                      <button onClick={() => {
                        if (photoUrlInput.trim()) {
                          setActorEditForm(p => ({ ...p, photos: [...(p?.photos || []), photoUrlInput.trim()].slice(0, 3) }));
                          setPhotoUrlInput("");
                        }
                      }}
                        style={{ padding: "5px 8px", background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 6, color: "#a855f7", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                        + URL
                      </button>
                    </div>
                  )}

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 300 }}>
                    {actorEditMode ? (
                      /* EDIT MODE */
                      <div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", marginBottom: 16 }}>
                          {[
                            { key: "firstName", label: "Prénom" }, { key: "name", label: "Nom" },
                            { key: "age", label: "Âge" }, { key: "height", label: "Taille" },
                            { key: "measurements", label: "Mensurations" }, { key: "hairColor", label: "Cheveux", type: "select", options: HAIR_COLORS },
                            { key: "profileType", label: "Type", type: "select", options: PROFILE_TYPES },
                            { key: "agency", label: "Agence" },
                            { key: "email", label: "Email" }, { key: "phone", label: "Téléphone" },
                            { key: "agencyEmail", label: "Email agence" }, { key: "source", label: "Source" },
                          ].map(f => (
                            <div key={f.key}>
                              <label style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 3 }}>{f.label}</label>
                              {f.type === "select" ? (
                                <select value={actorEditForm[f.key] || ""} onChange={e => setActorEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                                  style={{ width: "100%", padding: "8px 10px", background: "#0c0c0e", border: "1px solid #2a2a2e", borderRadius: 6, color: "#e0e0e0", fontSize: 12, fontFamily: "inherit", outline: "none" }}>
                                  <option value="">—</option>
                                  {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                              ) : (
                                <input value={actorEditForm[f.key] || ""} onChange={e => setActorEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                                  style={{ width: "100%", padding: "8px 10px", background: "#0c0c0e", border: "1px solid #2a2a2e", borderRadius: 6, color: "#e0e0e0", fontSize: 12, fontFamily: "'DM Sans', sans-serif", outline: "none" }} />
                              )}
                            </div>
                          ))}
                        </div>
                        {/* Acting level edit */}
                        <div style={{ marginBottom: 12 }}>
                          <label style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Niveau de jeu</label>
                          <div style={{ display: "flex", gap: 4 }}>
                            {[1,2,3,4,5].map(n => (
                              <button key={n} type="button" onClick={() => setActorEditForm(p => ({ ...p, actingLevel: p.actingLevel === n ? 0 : n }))}
                                style={{ width: 32, height: 32, borderRadius: 6, border: "none", cursor: "pointer", fontSize: 16,
                                  background: n <= (actorEditForm.actingLevel || 0) ? "rgba(201,164,74,0.15)" : "rgba(255,255,255,0.02)",
                                  color: n <= (actorEditForm.actingLevel || 0) ? "#c9a44a" : "#333", fontFamily: "inherit",
                                }}>★</button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 3 }}>Notes</label>
                          <textarea value={actorEditForm.notes || ""} onChange={e => setActorEditForm(p => ({ ...p, notes: e.target.value }))} rows={3}
                            style={{ width: "100%", padding: "8px 10px", background: "#0c0c0e", border: "1px solid #2a2a2e", borderRadius: 6, color: "#e0e0e0", fontSize: 12, fontFamily: "'DM Sans', sans-serif", outline: "none", resize: "vertical" }} />
                        </div>
                      </div>
                    ) : (
                      /* VIEW MODE */
                      <>
                        <h2 style={{ fontSize: 26, fontWeight: 800, color: "#f0f0f0", fontFamily: "'Playfair Display', serif", marginBottom: 4 }}>
                          {actorDetail._favorite && <span style={{ color: "#f59e0b", marginRight: 8 }}>★</span>}
                          {[actorDetail.firstName, actorDetail.name].filter(Boolean).join(" ") || "Sans nom"}
                        </h2>
                        {(actorDetail.profileType || actorDetail.actingLevel > 0) && (
                          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                            {actorDetail.profileType && (
                              <span style={{ fontSize: 11, padding: "3px 10px", background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 6, color: "#a855f7", fontWeight: 600 }}>{actorDetail.profileType}</span>
                            )}
                            {actorDetail.actingLevel > 0 && (
                              <div style={{ fontSize: 16 }}>
                                {[1,2,3,4,5].map(n => <span key={n} style={{ color: n <= actorDetail.actingLevel ? "#c9a44a" : "#2a2a2e" }}>★</span>)}
                                <span style={{ fontSize: 11, color: "#666", marginLeft: 6 }}>{actorDetail.actingLevel}/5</span>
                              </div>
                            )}
                          </div>
                        )}

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px", marginBottom: 16 }}>
                          {[
                            { label: "Âge", value: actorDetail.age ? `${actorDetail.age} ans` : null },
                            { label: "Taille", value: actorDetail.height },
                            { label: "Mensurations", value: actorDetail.measurements },
                            { label: "Cheveux", value: actorDetail.hairColor },
                            { label: "Type", value: actorDetail.profileType },
                            { label: "Agence", value: actorDetail.agency },
                            { label: "Source", value: actorDetail.source },
                          ].filter(f => f.value).map(f => (
                            <div key={f.label}>
                              <div style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{f.label}</div>
                              <div style={{ fontSize: 14, color: "#ddd", fontWeight: 500 }}>{f.value}</div>
                            </div>
                          ))}
                        </div>

                        {/* Tags */}
                        <div style={{ padding: "14px 16px", background: "#111114", borderRadius: 12, border: "1px solid #1e1e22", marginBottom: 12 }}>
                          <div style={{ fontSize: 10, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Tags</div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                            {(actorDetail.tags || []).map(tag => (
                              <span key={tag} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 6, fontSize: 11, color: "#60a5fa", fontWeight: 500 }}>
                                {tag}
                                <span onClick={() => removeActorTag(actorDetail.id, tag)} style={{ cursor: "pointer", opacity: 0.6 }}>✕</span>
                              </span>
                            ))}
                            <form onSubmit={e => { e.preventDefault(); if (newTagInput.trim()) { addActorTag(actorDetail.id, newTagInput); setNewTagInput(""); } }} style={{ display: "flex", gap: 4 }}>
                              <input value={newTagInput} onChange={e => setNewTagInput(e.target.value)} placeholder="+ Ajouter un tag"
                                style={{ padding: "4px 8px", background: "transparent", border: "1px dashed #333", borderRadius: 6, color: "#888", fontSize: 11, fontFamily: "inherit", outline: "none", width: 120 }}
                                onFocus={e => e.target.style.borderColor = "#60a5fa"} onBlur={e => e.target.style.borderColor = "#333"} />
                            </form>
                          </div>
                        </div>

                        {/* Contact */}
                        <div style={{ padding: "14px 16px", background: "#111114", borderRadius: 12, border: "1px solid #1e1e22", marginBottom: 12 }}>
                          <div style={{ fontSize: 10, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Contact</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "#bbb" }}>
                            {actorDetail.email && <div>✉ {actorDetail.email}</div>}
                            {actorDetail.phone && <div>☎ {actorDetail.phone}</div>}
                            {actorDetail.agencyEmail && <div>✉ Agence: {actorDetail.agencyEmail}</div>}
                            {!actorDetail.email && !actorDetail.phone && !actorDetail.agencyEmail && <div style={{ color: "#444" }}>Aucun contact renseigné</div>}
                          </div>
                        </div>

                        {/* Projects */}
                        {actorDetail._projects?.length > 0 && (
                          <div style={{ padding: "14px 16px", background: "#111114", borderRadius: 12, border: "1px solid #1e1e22", marginBottom: 12 }}>
                            <div style={{ fontSize: 10, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Projets</div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {actorDetail._projects.map((p, i) => (
                                <span key={i} style={{ padding: "4px 10px", background: "rgba(201,164,74,0.08)", border: "1px solid rgba(201,164,74,0.2)", borderRadius: 6, fontSize: 11, color: "#c9a44a", fontWeight: 500 }}>{p}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* History */}
                        {actorDetail._history?.length > 0 && (
                          <div style={{ padding: "14px 16px", background: "#111114", borderRadius: 12, border: "1px solid #1e1e22", marginBottom: 12 }}>
                            <div style={{ fontSize: 10, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Historique</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {[...actorDetail._history].reverse().map((h, i) => {
                                const statusColors = { "ajouté": "#60a5fa", "sélectionné": "#22c55e", "refusé": "#ef4444", "peut-être": "#f59e0b", "castingDone": "#a855f7" };
                                return (
                                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: i < actorDetail._history.length - 1 ? "1px solid #1a1a1e" : "none" }}>
                                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColors[h.status] || "#555", flexShrink: 0 }} />
                                    <div style={{ flex: 1 }}>
                                      <span style={{ fontSize: 12, color: "#ddd", fontWeight: 600 }}>{h.project}</span>
                                      {h.role && <span style={{ fontSize: 11, color: "#888" }}> — {h.role}</span>}
                                    </div>
                                    <span style={{ fontSize: 10, color: statusColors[h.status] || "#555", fontWeight: 600, padding: "2px 6px", background: `${statusColors[h.status] || "#555"}12`, borderRadius: 4 }}>{h.status}</span>
                                    {h.date && <span style={{ fontSize: 9, color: "#444" }}>{new Date(h.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {actorDetail.notes && (
                          <div style={{ padding: "14px 16px", background: "#111114", borderRadius: 12, border: "1px solid #1e1e22", marginBottom: 12 }}>
                            <div style={{ fontSize: 10, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Notes</div>
                            <div style={{ fontSize: 13, color: "#bbb", lineHeight: 1.6 }}>{actorDetail.notes}</div>
                          </div>
                        )}

                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <button onClick={() => setActorImportToProject({ actor: actorDetail, step: "project" })}
                            style={{ padding: "8px 16px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8, color: "#22c55e", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                            📥 Ajouter à un projet
                          </button>
                          <button onClick={() => { if (window.confirm(`Supprimer ${[actorDetail.firstName, actorDetail.name].join(" ")} du fichier ?`)) deleteActor(actorDetail.id); }}
                            style={{ padding: "8px 16px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, color: "#ef4444", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                            Supprimer du fichier
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* --- ACTOR LIST / GRID VIEW --- */
              <>
                {/* MINI DASHBOARD STATS */}
                {actorDatabase.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 24 }}>
                    {(() => {
                      const stats = [
                        { label: "Total", value: actorDatabase.length, color: "#a855f7" },
                        { label: "Favoris", value: actorDatabase.filter(a => a._favorite).length, color: "#f59e0b" },
                        ...PROFILE_TYPES.map(t => ({ label: t + "s", value: actorDatabase.filter(a => a.profileType === t).length, color: "#60a5fa" })),
                      ].filter(s => s.value > 0);
                      return stats.map(s => (
                        <div key={s.label} style={{ padding: "12px 14px", background: "#111114", borderRadius: 12, border: "1px solid #1e1e22", textAlign: "center" }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                          <div style={{ fontSize: 9, color: "#666", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
                        </div>
                      ));
                    })()}
                  </div>
                )}

                {/* HEADER + TOOLBAR */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f0f0f0", fontFamily: "'Playfair Display', serif", marginBottom: 4 }}>
                      📁 Fichier Casting
                    </h1>
                    <p style={{ fontSize: 13, color: "#666" }}>
                      {actorDatabase.length} acteur{actorDatabase.length !== 1 ? "s" : ""} enregistré{actorDatabase.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {/* Add actor */}
                    <button onClick={() => { setActorEditForm({ firstName: "", name: "", age: "", height: "", measurements: "", hairColor: "", profileType: "", actingLevel: 0, agency: "", email: "", phone: "", agencyEmail: "", source: "", notes: "", photos: [], tags: [] }); setActorAddModal(true); }} style={{
                      padding: "10px 18px", background: "linear-gradient(135deg, #a855f7, #9333ea)",
                      border: "none", borderRadius: 10, cursor: "pointer", fontSize: 12,
                      fontWeight: 700, fontFamily: "inherit", color: "#fff",
                    }}>+ Ajouter un acteur</button>
                    {/* Export CSV */}
                    <button onClick={() => {
                      const headers = ["Prénom","Nom","Âge","Taille","Mensurations","Cheveux","Type","Niveau","Agence","Email","Téléphone","Email agence","Source","Tags","Projets","Favori","Notes"];
                      const rows = actorDatabase.map(a => [a.firstName,a.name,a.age,a.height,a.measurements,a.hairColor,a.profileType,a.actingLevel||"",a.agency,a.email,a.phone,a.agencyEmail,a.source,(a.tags||[]).join("; "),(a._projects||[]).join("; "),a._favorite?"Oui":"",a.notes]);
                      const csv = [headers,...rows].map(r => r.map(c => '"'+String(c||"").replace(/"/g,'""')+'"').join(",")).join("\n");
                      const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
                      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "fichier-casting.csv"; a.click();
                    }} style={{
                      padding: "10px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid #2a2a2e",
                      borderRadius: 10, cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit", color: "#888",
                    }}>⬇ Export CSV</button>
                    {/* Sort */}
                    <select value={actorSort} onChange={e => setActorSort(e.target.value)} style={{
                      padding: "10px 12px", background: "#111114", border: "1px solid #2a2a2e",
                      borderRadius: 10, color: "#e0e0e0", fontSize: 11, fontFamily: "inherit", outline: "none",
                    }}>
                      <option value="name">Tri: Nom</option>
                      <option value="date">Tri: Récent</option>
                      <option value="age">Tri: Âge</option>
                      <option value="level">Tri: Niveau ★</option>
                      <option value="projects">Tri: Nb projets</option>
                    </select>
                    {/* View toggle */}
                    <div style={{ display: "flex", gap: 2, background: "#0c0c0e", borderRadius: 8, padding: 2 }}>
                      <button onClick={() => setActorViewMode("grid")} style={{
                        padding: "8px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13,
                        background: actorViewMode === "grid" ? "rgba(168,85,247,0.12)" : "transparent",
                        color: actorViewMode === "grid" ? "#a855f7" : "#555",
                      }}>▦</button>
                      <button onClick={() => setActorViewMode("list")} style={{
                        padding: "8px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13,
                        background: actorViewMode === "list" ? "rgba(168,85,247,0.12)" : "transparent",
                        color: actorViewMode === "list" ? "#a855f7" : "#555",
                      }}>☰</button>
                    </div>
                  </div>
                </div>

                {/* Search & filters - reusing existing */}
                {(() => {
                  const allAgencies = [...new Set(actorDatabase.map(a => a.agency).filter(Boolean))].sort();
                  const allProjects = [...new Set(actorDatabase.flatMap(a => a._projects || []).filter(Boolean))].sort();
                  const allTags = [...new Set(actorDatabase.flatMap(a => a.tags || []).filter(Boolean))].sort();
                  const activeFilterCount = Object.entries(actorFilters).filter(([k, v]) => k === "favOnly" ? v : (v !== "all" && v !== "")).length;
                  const fSel = { padding: "8px 12px", background: "#111114", border: "1px solid #2a2a2e", borderRadius: 8, color: "#e0e0e0", fontSize: 11, fontFamily: "inherit", outline: "none" };
                  const fSelA = (key) => actorFilters[key] !== "all" && actorFilters[key] !== "" ? { ...fSel, borderColor: "#a855f744", background: "rgba(168,85,247,0.04)" } : fSel;
                  const fIn = { padding: "8px 10px", background: "#111114", border: "1px solid #2a2a2e", borderRadius: 8, color: "#e0e0e0", fontSize: 11, fontFamily: "'DM Sans',sans-serif", outline: "none", width: 70 };
                  const setF = (key, val) => setActorFilters(prev => ({ ...prev, [key]: val }));

                  return (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        <input value={actorSearch} onChange={e => setActorSearch(e.target.value)} placeholder="🔍 Rechercher par nom, prénom, agence..."
                          style={{ flex: 1, minWidth: 180, padding: "10px 16px", background: "#111114", border: "1px solid #2a2a2e", borderRadius: 10, color: "#e0e0e0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none" }}
                          onFocus={e => e.target.style.borderColor="#a855f7"} onBlur={e => e.target.style.borderColor="#2a2a2e"} />
                        <button onClick={() => setF("favOnly", !actorFilters.favOnly)} style={{
                          padding: "10px 14px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 16,
                          background: actorFilters.favOnly ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.03)",
                          color: actorFilters.favOnly ? "#f59e0b" : "#444",
                        }}>★</button>
                        <button onClick={() => setActorFiltersOpen(p => !p)} style={{
                          padding: "10px 16px", borderRadius: 10, fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                          border: "none", cursor: "pointer", position: "relative",
                          background: actorFiltersOpen || activeFilterCount > 0 ? "rgba(168,85,247,0.1)" : "rgba(255,255,255,0.03)",
                          color: actorFiltersOpen || activeFilterCount > 0 ? "#a855f7" : "#888",
                        }}>
                          ⚙ Filtres
                          {activeFilterCount > 0 && <span style={{ position: "absolute", top: -4, right: -4, fontSize: 9, fontWeight: 700, background: "#a855f7", color: "#000", borderRadius: 10, padding: "1px 5px", minWidth: 14, textAlign: "center" }}>{activeFilterCount}</span>}
                        </button>
                      </div>

                      {actorFiltersOpen && (
                        <div style={{ padding: "14px 18px", background: "#111114", borderRadius: 12, border: "1px solid #1e1e22", marginBottom: 4, animation: "fadeIn 0.2s ease" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "10px 14px" }}>
                            <div>
                              <label style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 3 }}>Type</label>
                              <select value={actorFilters.type} onChange={e => setF("type", e.target.value)} style={fSelA("type")}><option value="all">Tous</option>{PROFILE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
                            </div>
                            <div>
                              <label style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 3 }}>Cheveux</label>
                              <select value={actorFilters.hair} onChange={e => setF("hair", e.target.value)} style={fSelA("hair")}><option value="all">Tous</option>{HAIR_COLORS.map(h => <option key={h} value={h}>{h}</option>)}</select>
                            </div>
                            <div>
                              <label style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 3 }}>Agence</label>
                              <select value={actorFilters.agency} onChange={e => setF("agency", e.target.value)} style={fSelA("agency")}><option value="all">Toutes</option>{allAgencies.map(a => <option key={a} value={a}>{a}</option>)}</select>
                            </div>
                            <div>
                              <label style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 3 }}>Niveau</label>
                              <select value={actorFilters.level} onChange={e => setF("level", e.target.value)} style={fSelA("level")}><option value="all">Tous</option>{[1,2,3,4,5].map(n => <option key={n} value={String(n)}>{"★".repeat(n)}</option>)}</select>
                            </div>
                            <div>
                              <label style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 3 }}>Tag</label>
                              <select value={actorFilters.tag} onChange={e => setF("tag", e.target.value)} style={fSelA("tag")}><option value="all">Tous</option>{allTags.map(t => <option key={t} value={t}>{t}</option>)}</select>
                            </div>
                            <div>
                              <label style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 3 }}>Projet</label>
                              <select value={actorFilters.project} onChange={e => setF("project", e.target.value)} style={fSelA("project")}><option value="all">Tous</option>{allProjects.map(p => <option key={p} value={p}>{p}</option>)}</select>
                            </div>
                            <div>
                              <label style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 3 }}>Âge</label>
                              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                <input value={actorFilters.ageMin} onChange={e => setF("ageMin", e.target.value)} placeholder="Min" type="number" style={fIn} />
                                <span style={{ color: "#333" }}>—</span>
                                <input value={actorFilters.ageMax} onChange={e => setF("ageMax", e.target.value)} placeholder="Max" type="number" style={fIn} />
                              </div>
                            </div>
                            <div>
                              <label style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 3 }}>Taille (cm)</label>
                              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                <input value={actorFilters.heightMin} onChange={e => setF("heightMin", e.target.value)} placeholder="Min" type="number" style={fIn} />
                                <span style={{ color: "#333" }}>—</span>
                                <input value={actorFilters.heightMax} onChange={e => setF("heightMax", e.target.value)} placeholder="Max" type="number" style={fIn} />
                              </div>
                            </div>
                          </div>
                          {activeFilterCount > 0 && (
                            <button onClick={() => setActorFilters({ hair: "all", type: "all", agency: "all", ageMin: "", ageMax: "", heightMin: "", heightMax: "", level: "all", project: "all", tag: "all", favOnly: false })}
                              style={{ marginTop: 10, padding: "6px 14px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 8, color: "#ef4444", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                              ✕ Réinitialiser
                            </button>
                          )}
                        </div>
                      )}

                      {/* Active pills */}
                      {activeFilterCount > 0 && !actorFiltersOpen && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                          {actorFilters.favOnly && <span style={{ fontSize: 10, padding: "3px 8px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 6, color: "#f59e0b", cursor: "pointer" }} onClick={() => setF("favOnly", false)}>★ Favoris ✕</span>}
                          {actorFilters.type !== "all" && <span style={{ fontSize: 10, padding: "3px 8px", background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: 6, color: "#a855f7", cursor: "pointer" }} onClick={() => setF("type", "all")}>{actorFilters.type} ✕</span>}
                          {actorFilters.hair !== "all" && <span style={{ fontSize: 10, padding: "3px 8px", background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: 6, color: "#a855f7", cursor: "pointer" }} onClick={() => setF("hair", "all")}>💇 {actorFilters.hair} ✕</span>}
                          {actorFilters.agency !== "all" && <span style={{ fontSize: 10, padding: "3px 8px", background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: 6, color: "#a855f7", cursor: "pointer" }} onClick={() => setF("agency", "all")}>🏢 {actorFilters.agency} ✕</span>}
                          {actorFilters.level !== "all" && <span style={{ fontSize: 10, padding: "3px 8px", background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: 6, color: "#a855f7", cursor: "pointer" }} onClick={() => setF("level", "all")}>{"★".repeat(Number(actorFilters.level))}+ ✕</span>}
                          {actorFilters.tag !== "all" && <span style={{ fontSize: 10, padding: "3px 8px", background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)", borderRadius: 6, color: "#60a5fa", cursor: "pointer" }} onClick={() => setF("tag", "all")}>🏷 {actorFilters.tag} ✕</span>}
                          {actorFilters.project !== "all" && <span style={{ fontSize: 10, padding: "3px 8px", background: "rgba(201,164,74,0.06)", border: "1px solid rgba(201,164,74,0.15)", borderRadius: 6, color: "#c9a44a", cursor: "pointer" }} onClick={() => setF("project", "all")}>🎬 {actorFilters.project} ✕</span>}
                          {actorFilters.ageMin && <span style={{ fontSize: 10, padding: "3px 8px", background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: 6, color: "#a855f7", cursor: "pointer" }} onClick={() => setF("ageMin", "")}>≥{actorFilters.ageMin} ans ✕</span>}
                          {actorFilters.ageMax && <span style={{ fontSize: 10, padding: "3px 8px", background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: 6, color: "#a855f7", cursor: "pointer" }} onClick={() => setF("ageMax", "")}>≤{actorFilters.ageMax} ans ✕</span>}
                          {actorFilters.heightMin && <span style={{ fontSize: 10, padding: "3px 8px", background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: 6, color: "#a855f7", cursor: "pointer" }} onClick={() => setF("heightMin", "")}>≥{actorFilters.heightMin}cm ✕</span>}
                          {actorFilters.heightMax && <span style={{ fontSize: 10, padding: "3px 8px", background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: 6, color: "#a855f7", cursor: "pointer" }} onClick={() => setF("heightMax", "")}>≤{actorFilters.heightMax}cm ✕</span>}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {!actorsLoaded ? (
                  <div style={{ textAlign: "center", padding: "60px 0", color: "#555", fontSize: 14, animation: "pulse 1.5s infinite" }}>Chargement...</div>
                ) : actorDatabase.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "80px 24px", background: "#111114", borderRadius: 20, border: "1px solid #1e1e22" }}>
                    <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.3 }}>📁</div>
                    <div style={{ fontSize: 16, color: "#888", marginBottom: 8 }}>Fichier casting vide</div>
                    <div style={{ fontSize: 13, color: "#555" }}>Ajoutez des acteurs manuellement ou cochez "📁 Enregistrer" sur les profils de vos projets</div>
                  </div>
                ) : (() => {
                  const parseNum = (str) => { const n = parseInt(String(str).replace(/[^\d]/g, "")); return isNaN(n) ? null : n; };
                  let filtered = actorDatabase.filter(a => {
                    const fullName = [a.firstName, a.name].filter(Boolean).join(" ").toLowerCase();
                    if (actorSearch && !fullName.includes(actorSearch.toLowerCase()) && !(a.agency || "").toLowerCase().includes(actorSearch.toLowerCase())) return false;
                    if (actorFilters.favOnly && !a._favorite) return false;
                    if (actorFilters.hair !== "all" && a.hairColor !== actorFilters.hair) return false;
                    if (actorFilters.type !== "all" && a.profileType !== actorFilters.type) return false;
                    if (actorFilters.agency !== "all" && a.agency !== actorFilters.agency) return false;
                    if (actorFilters.level !== "all" && (a.actingLevel || 0) < Number(actorFilters.level)) return false;
                    if (actorFilters.project !== "all" && !(a._projects || []).includes(actorFilters.project)) return false;
                    if (actorFilters.tag !== "all" && !(a.tags || []).includes(actorFilters.tag)) return false;
                    const ageNum = parseNum(a.age);
                    if (actorFilters.ageMin && ageNum !== null && ageNum < Number(actorFilters.ageMin)) return false;
                    if (actorFilters.ageMax && ageNum !== null && ageNum > Number(actorFilters.ageMax)) return false;
                    const heightNum = parseNum(a.height);
                    if (actorFilters.heightMin && heightNum !== null && heightNum < Number(actorFilters.heightMin)) return false;
                    if (actorFilters.heightMax && heightNum !== null && heightNum > Number(actorFilters.heightMax)) return false;
                    return true;
                  });
                  filtered = sortActors(filtered);

                  return (
                    <>
                      <div style={{ fontSize: 11, color: "#555", marginBottom: 10 }}>
                        {filtered.length === actorDatabase.length ? `${filtered.length} acteur${filtered.length !== 1 ? "s" : ""}` : `${filtered.length} résultat${filtered.length !== 1 ? "s" : ""} sur ${actorDatabase.length}`}
                      </div>

                      {actorViewMode === "list" ? (
                        /* === LIST VIEW === */
                        <div style={{ background: "#111114", borderRadius: 14, border: "1px solid #1e1e22", overflow: "hidden" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "40px 1.5fr 0.6fr 0.6fr 0.5fr 0.6fr 0.8fr 0.5fr", padding: "10px 16px", borderBottom: "1px solid #1e1e22", fontSize: 9, color: "#555", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                            <span></span><span>Nom</span><span>Type</span><span>Âge/Taille</span><span>Cheveux</span><span>Agence</span><span>Tags</span><span>Niveau</span>
                          </div>
                          {filtered.map((actor, i) => (
                            <div key={actor.id} onClick={() => setActorDetail(actor)} style={{
                              display: "grid", gridTemplateColumns: "40px 1.5fr 0.6fr 0.6fr 0.5fr 0.6fr 0.8fr 0.5fr",
                              padding: "10px 16px", alignItems: "center", cursor: "pointer",
                              borderBottom: i < filtered.length - 1 ? "1px solid #1a1a1e" : "none",
                              transition: "background 0.15s",
                            }}
                              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            >
                              <div style={{ width: 30, height: 38, borderRadius: 5, overflow: "hidden", background: "#0c0c0e" }}>
                                {actor.photos?.[0] ? <img src={actor.photos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: 12 }}>◎</div>}
                              </div>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: "#f0f0f0" }}>
                                  {actor._favorite && <span style={{ color: "#f59e0b", marginRight: 4 }}>★</span>}
                                  {[actor.firstName, actor.name].filter(Boolean).join(" ") || "Sans nom"}
                                </div>
                              </div>
                              <div style={{ fontSize: 10, color: "#888" }}>{actor.profileType || "—"}</div>
                              <div style={{ fontSize: 10, color: "#888" }}>{[actor.age ? actor.age+"a" : null, actor.height].filter(Boolean).join(" · ") || "—"}</div>
                              <div style={{ fontSize: 10, color: "#888" }}>{actor.hairColor || "—"}</div>
                              <div style={{ fontSize: 10, color: "#8a7740" }}>{actor.agency || "—"}</div>
                              <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                                {(actor.tags || []).slice(0, 2).map(t => <span key={t} style={{ fontSize: 8, padding: "1px 5px", background: "rgba(96,165,250,0.06)", borderRadius: 3, color: "#60a5fa" }}>{t}</span>)}
                                {(actor.tags || []).length > 2 && <span style={{ fontSize: 8, color: "#444" }}>+{actor.tags.length - 2}</span>}
                              </div>
                              <div style={{ fontSize: 11 }}>{actor.actingLevel > 0 ? [1,2,3,4,5].map(n => <span key={n} style={{ color: n <= actor.actingLevel ? "#c9a44a" : "#2a2a2e" }}>★</span>) : <span style={{ color: "#333" }}>—</span>}</div>
                            </div>
                          ))}
                          {filtered.length === 0 && <div style={{ padding: "30px", textAlign: "center", color: "#555", fontSize: 12 }}>Aucun résultat</div>}
                        </div>
                      ) : (
                        /* === GRID VIEW === */
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
                          {filtered.map((actor, i) => (
                            <div key={actor.id} onClick={() => setActorDetail(actor)} style={{
                              background: "#111114", borderRadius: 14, border: "1px solid #1e1e22",
                              overflow: "hidden", cursor: "pointer", transition: "all 0.2s",
                              animation: `fadeIn 0.3s ease ${i * 0.02}s both`,
                            }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = "#a855f744"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e1e22"; e.currentTarget.style.transform = ""; }}
                            >
                              <div style={{ height: 170, overflow: "hidden", background: "#0c0c0e", position: "relative" }}>
                                {actor.photos?.[0] ? <img src={actor.photos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: 40 }}>◎</div>}
                                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.85))", padding: "28px 14px 10px" }}>
                                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
                                    {actor._favorite && <span style={{ color: "#f59e0b", marginRight: 4 }}>★</span>}
                                    {[actor.firstName, actor.name].filter(Boolean).join(" ") || "Sans nom"}
                                  </div>
                                  {actor.profileType && <span style={{ fontSize: 9, padding: "2px 6px", background: "rgba(255,255,255,0.15)", borderRadius: 4, color: "#ddd", fontWeight: 600 }}>{actor.profileType}</span>}
                                </div>
                                {actor.photos?.length > 1 && <div style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.6)", borderRadius: 5, padding: "2px 6px", fontSize: 9, color: "#ccc" }}>📷 {actor.photos.length}</div>}
                              </div>
                              <div style={{ padding: "10px 14px" }}>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: 10, color: "#888", marginBottom: 4 }}>
                                  {actor.age && <span>{actor.age} ans</span>}
                                  {actor.height && <span>📏 {actor.height}</span>}
                                  {actor.hairColor && <span>💇 {actor.hairColor}</span>}
                                </div>
                                {actor.actingLevel > 0 && <div style={{ marginBottom: 4, fontSize: 12 }}>{[1,2,3,4,5].map(n => <span key={n} style={{ color: n <= actor.actingLevel ? "#c9a44a" : "#2a2a2e" }}>★</span>)}</div>}
                                {actor.agency && <div style={{ fontSize: 10, color: "#8a7740", marginBottom: 4 }}>🏢 {actor.agency}</div>}
                                {(actor.tags || []).length > 0 && <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>{actor.tags.slice(0, 3).map(t => <span key={t} style={{ fontSize: 8, padding: "2px 6px", background: "rgba(96,165,250,0.06)", borderRadius: 4, color: "#60a5fa" }}>{t}</span>)}{actor.tags.length > 3 && <span style={{ fontSize: 8, color: "#444" }}>+{actor.tags.length - 3}</span>}</div>}
                                {actor._projects?.length > 0 && <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{actor._projects.slice(0, 2).map((p, j) => <span key={j} style={{ fontSize: 8, padding: "2px 5px", background: "rgba(201,164,74,0.06)", border: "1px solid rgba(201,164,74,0.12)", borderRadius: 3, color: "#c9a44a" }}>{p}</span>)}{actor._projects.length > 2 && <span style={{ fontSize: 8, color: "#555" }}>+{actor._projects.length - 2}</span>}</div>}
                              </div>
                            </div>
                          ))}
                          {filtered.length === 0 && <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "40px", color: "#555", fontSize: 13 }}>Aucun résultat</div>}
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            )}
          </div>

          {/* ADD ACTOR MODAL */}
          {actorAddModal && (
              <div onClick={() => { setActorAddModal(false); setActorEditForm(null); }} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div onClick={e => e.stopPropagation()} style={{ width: "90%", maxWidth: 600, maxHeight: "85vh", overflow: "auto", background: "#141416", borderRadius: 16, border: "1px solid #2a2a2e", padding: "24px" }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: "#f0f0f0", marginBottom: 16, fontFamily: "'Playfair Display', serif" }}>+ Ajouter un acteur</h3>
                  {/* Photos */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Photos (3 max)</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {[0, 1, 2].map(i => {
                        const src = (actorEditForm || {}).photos?.[i];
                        return (
                          <div key={i} style={{
                            width: 100, height: 120, borderRadius: 10, overflow: "hidden",
                            border: "1.5px dashed #444", cursor: "pointer", position: "relative", background: "#0c0c0e",
                          }} onClick={() => { setActorPhotoIdx(i); actorPhotoRef.current?.click(); }}>
                            {src ? (
                              <>
                                <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                <div onClick={e => { e.stopPropagation(); setActorEditForm(p => ({ ...p, photos: (p?.photos || []).filter((_, j) => j !== i) })); }}
                                  style={{ position: "absolute", top: 4, right: 4, width: 18, height: 18, borderRadius: "50%", background: "rgba(239,68,68,0.9)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, cursor: "pointer" }}>✕</div>
                              </>
                            ) : (
                              <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#555", fontSize: 11, gap: 2 }}>
                                <span style={{ fontSize: 20 }}>+</span><span style={{ fontSize: 8 }}>Photo</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {/* Photo URL import */}
                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                      <input value={photoUrlInput} onChange={e => setPhotoUrlInput(e.target.value)} placeholder="📎 Coller une URL d'image..."
                        style={{ flex: 1, padding: "6px 10px", background: "#0c0c0e", border: "1px solid #2a2a2e", borderRadius: 6, color: "#e0e0e0", fontSize: 10, fontFamily: "'DM Sans',sans-serif", outline: "none" }}
                        onFocus={e => e.target.style.borderColor="#a855f7"} onBlur={e => e.target.style.borderColor="#2a2a2e"} />
                      <button onClick={() => {
                        if (photoUrlInput.trim()) {
                          setActorEditForm(p => ({ ...(p || {}), photos: [...((p || {}).photos || []), photoUrlInput.trim()].slice(0, 3) }));
                          setPhotoUrlInput("");
                        }
                      }}
                        style={{ padding: "6px 10px", background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 6, color: "#a855f7", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                        + URL
                      </button>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 14px", marginBottom: 12 }}>
                    {[
                      { key: "firstName", label: "Prénom", ph: "Prénom" }, { key: "name", label: "Nom", ph: "Nom" },
                      { key: "age", label: "Âge", ph: "25" }, { key: "height", label: "Taille", ph: "175cm" },
                      { key: "measurements", label: "Mensurations", ph: "90-60-90" },
                      { key: "hairColor", label: "Cheveux", type: "select", options: HAIR_COLORS },
                      { key: "profileType", label: "Type", type: "select", options: PROFILE_TYPES },
                      { key: "agency", label: "Agence", ph: "Agence" },
                      { key: "email", label: "Email", ph: "email@..." }, { key: "phone", label: "Téléphone", ph: "+33..." },
                      { key: "agencyEmail", label: "Email agence", ph: "booking@..." }, { key: "source", label: "Source", ph: "Instagram, agence..." },
                    ].map(f => (
                      <div key={f.key}>
                        <label style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 3 }}>{f.label}</label>
                        {f.type === "select" ? (
                          <select value={(actorEditForm || {})[f.key] || ""} onChange={e => setActorEditForm(p => ({ ...(p || {}), [f.key]: e.target.value }))}
                            style={{ width: "100%", padding: "8px 10px", background: "#0c0c0e", border: "1px solid #2a2a2e", borderRadius: 6, color: "#e0e0e0", fontSize: 12, fontFamily: "inherit", outline: "none" }}>
                            <option value="">—</option>{f.options.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input value={(actorEditForm || {})[f.key] || ""} onChange={e => setActorEditForm(p => ({ ...(p || {}), [f.key]: e.target.value }))} placeholder={f.ph}
                            style={{ width: "100%", padding: "8px 10px", background: "#0c0c0e", border: "1px solid #2a2a2e", borderRadius: 6, color: "#e0e0e0", fontSize: 12, fontFamily: "'DM Sans',sans-serif", outline: "none" }} />
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Niveau de jeu</label>
                    <div style={{ display: "flex", gap: 4 }}>
                      {[1,2,3,4,5].map(n => (
                        <button key={n} type="button" onClick={() => setActorEditForm(p => ({ ...(p || {}), actingLevel: (p || {}).actingLevel === n ? 0 : n }))}
                          style={{ width: 32, height: 32, borderRadius: 6, border: "none", cursor: "pointer", fontSize: 16, fontFamily: "inherit",
                            background: n <= ((actorEditForm || {}).actingLevel || 0) ? "rgba(201,164,74,0.15)" : "rgba(255,255,255,0.02)",
                            color: n <= ((actorEditForm || {}).actingLevel || 0) ? "#c9a44a" : "#333",
                          }}>★</button>
                      ))}
                    </div>
                  </div>
                  <textarea value={(actorEditForm || {}).notes || ""} onChange={e => setActorEditForm(p => ({ ...(p || {}), notes: e.target.value }))} placeholder="Notes..." rows={2}
                    style={{ width: "100%", padding: "8px 10px", background: "#0c0c0e", border: "1px solid #2a2a2e", borderRadius: 6, color: "#e0e0e0", fontSize: 12, fontFamily: "'DM Sans',sans-serif", outline: "none", resize: "vertical", marginBottom: 16 }} />
                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                    <button onClick={() => { setActorAddModal(false); setActorEditForm(null); }}
                      style={{ padding: "10px 20px", background: "transparent", border: "1px solid #333", borderRadius: 10, color: "#888", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Annuler</button>
                    <button onClick={() => { addActorManually(actorEditForm || {}); setActorEditForm(null); }}
                      style={{ padding: "10px 24px", background: "linear-gradient(135deg, #a855f7, #9333ea)", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Enregistrer</button>
                  </div>
                </div>
              </div>
          )}

          {/* IMPORT ACTOR TO PROJECT MODAL */}
          {actorImportToProject && (
            <div onClick={() => setActorImportToProject(null)} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div onClick={e => e.stopPropagation()} style={{ width: "90%", maxWidth: 480, maxHeight: "70vh", overflow: "auto", background: "#141416", borderRadius: 16, border: "1px solid #2a2a2e", padding: "24px" }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#f0f0f0", marginBottom: 4, fontFamily: "'Playfair Display', serif" }}>
                  📥 Ajouter à un projet
                </h3>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 20 }}>
                  {[actorImportToProject.actor?.firstName, actorImportToProject.actor?.name].filter(Boolean).join(" ")}
                </div>

                {actorImportToProject.step === "project" ? (
                  <>
                    <div style={{ fontSize: 11, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Choisir un projet</div>
                    {projectList.length === 0 ? (
                      <div style={{ padding: "20px", textAlign: "center", color: "#555", fontSize: 12 }}>Aucun projet disponible</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {projectList.map(proj => (
                          <button key={proj.id} onClick={async () => {
                            try {
                              const data = await window.storage.get(`project:${proj.id}`);
                              if (data?.value) {
                                const parsed = JSON.parse(data.value);
                                setActorImportToProject(prev => ({ ...prev, step: "role", projectId: proj.id, projectName: proj.name, roles: parsed.roles || [] }));
                              }
                            } catch (e) {}
                          }} style={{
                            padding: "12px 16px", background: "#111114", border: "1px solid #1e1e22",
                            borderRadius: 10, cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                            transition: "border-color 0.2s", color: "#f0f0f0", fontSize: 13, fontWeight: 600,
                          }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = "#22c55e44"}
                            onMouseLeave={e => e.currentTarget.style.borderColor = "#1e1e22"}
                          >
                            🎬 {proj.name || "Sans titre"}
                            <span style={{ fontSize: 10, color: "#666", marginLeft: 8 }}>{proj.rolesCount} rôle{proj.rolesCount !== 1 ? "s" : ""}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <button onClick={() => setActorImportToProject(prev => ({ ...prev, step: "project" }))}
                      style={{ padding: "4px 10px", background: "none", border: "1px solid #2a2a2e", borderRadius: 6, color: "#888", fontSize: 10, cursor: "pointer", fontFamily: "inherit", marginBottom: 12 }}>
                      ← {actorImportToProject.projectName}
                    </button>
                    <div style={{ fontSize: 11, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Choisir un rôle</div>
                    {(actorImportToProject.roles || []).length === 0 ? (
                      <div style={{ padding: "20px", textAlign: "center", color: "#555", fontSize: 12 }}>Aucun rôle dans ce projet</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {actorImportToProject.roles.map(role => (
                          <button key={role} onClick={() => importActorToStoredProject(actorImportToProject.actor, actorImportToProject.projectId, role)}
                            style={{
                              padding: "12px 16px", background: "#111114", border: "1px solid #1e1e22",
                              borderRadius: 10, cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                              transition: "border-color 0.2s", color: "#f0f0f0", fontSize: 13, fontWeight: 600,
                            }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = "#22c55e44"}
                            onMouseLeave={e => e.currentTarget.style.borderColor = "#1e1e22"}
                          >
                            🎭 {role}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                <button onClick={() => setActorImportToProject(null)}
                  style={{ marginTop: 16, padding: "8px 16px", background: "transparent", border: "1px solid #333", borderRadius: 8, color: "#888", fontSize: 12, cursor: "pointer", fontFamily: "inherit", width: "100%" }}>
                  Annuler
                </button>
              </div>
            </div>
          )}
          </>
          )}
        </div>
      </>
    );
  }

  // ===== START SCREEN (new project) =====
  if (!state.started) {
    return (
      <>
        <style>{globalStyles}</style>
        <div style={{ position: "relative" }}>
          <button
            onClick={backToDashboard}
            style={{
              position: "absolute", top: 16, left: 16, zIndex: 10,
              padding: "8px 16px", background: "rgba(255,255,255,0.03)",
              border: "1px solid #2a2a2e", borderRadius: 8, cursor: "pointer",
              fontSize: 12, fontFamily: "inherit", color: "#888",
            }}
          >
            ← Mes projets
          </button>
          <StartScreen onStart={handleStart} />
        </div>
      </>
    );
  }

  const currentProfiles = state.profiles[activeRole] || [];
  const archivedCount = currentProfiles.filter(p => getChoice(p.id) === "no").length;
  const filteredProfiles = currentProfiles.filter(p => {
    const matchesSearch = !searchQuery || (() => {
      const q = searchQuery.toLowerCase();
      return (p.name || "").toLowerCase().includes(q) ||
        (p.firstName || "").toLowerCase().includes(q) ||
        (p.agency || "").toLowerCase().includes(q) ||
        ([p.firstName, p.name].filter(Boolean).join(" ").toLowerCase()).includes(q);
    })();
    const matchesStatus = filterStatus === "all" || p.availability === filterStatus;
    const sel = { ...(state.selections[p.id] || {}), choice: getChoice(p.id) };
    const matchesSelection = filterSelection === "all"
      || (filterSelection === "none" && (!sel.choice))
      || (filterSelection !== "none" && sel.choice === filterSelection);
    const ct = state.contacts[p.id];
    const matchesContact = filterContact === "all"
      || (filterContact === "not_contacted" && (!ct || !ct.status || ct.status === "not_contacted"))
      || (filterContact !== "not_contacted" && ct?.status === filterContact);
    const matchesArchive = showArchived || sel.choice !== "no";
    return matchesSearch && matchesStatus && matchesSelection && matchesContact && matchesArchive;
  });

  const totalProfiles = Object.values(state.profiles).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <>
      <style>{globalStyles}</style>

      <div className={lightTheme ? "light-wrapper" : ""} style={{ minHeight: "100vh", background: "#0a0a0c" }}>
        {/* Header */}
        <header style={{
          padding: "18px 32px", borderBottom: "1px solid #1a1a1e",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "rgba(10,10,12,0.9)", backdropFilter: "blur(12px)",
          position: "sticky", top: 0, zIndex: 100,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              onClick={backToDashboard}
              style={{
                padding: "5px 10px", background: "rgba(255,255,255,0.03)",
                border: "1px solid #2a2a2e", borderRadius: 6, cursor: "pointer",
                fontSize: 11, fontFamily: "inherit", color: "#888", transition: "color 0.2s",
              }}
              onMouseEnter={e => e.currentTarget.style.color = "#c9a44a"}
              onMouseLeave={e => e.currentTarget.style.color = "#888"}
            >
              {"← Projets"}
            </button>
            {/* Brand */}
              <div style={{ fontSize: 10, letterSpacing: "0.25em", textTransform: "uppercase", color: "#c9a44a", fontWeight: 600 }}>
                Casting Director
              </div>
            <div style={{ width: 1, height: 20, background: "#2a2a2e" }} />
            <h1 style={{
              fontSize: 18, fontWeight: 700, color: "#f0f0f0", letterSpacing: "-0.01em",
              fontFamily: "'Playfair Display', serif",
            }}>
              {state.projectName}
            </h1>
            {savingIndicator && (
              <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 500, animation: "fadeIn 0.2s" }}>
                ✓ Sauvegardé
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, color: "#666" }}>
                  {totalProfiles} profil{totalProfiles !== 1 ? "s" : ""} · {state.roles.length} rôle{state.roles.length !== 1 ? "s" : ""}
                </span>
                <div style={{ width: 1, height: 20, background: "#2a2a2e" }} />
                {/* Share button */}
                <button onClick={async () => {
                  if (state._shareCode) { setShareModalOpen(true); }
                  else {
                    const result = await shareProject(currentProjectId);
                    if (result) { setState(prev => ({ ...prev, _shareCode: result.code, _sharePassword: result.password })); setShareModalOpen(true); }
                  }
                }}
                  style={{ padding: "5px 12px", background: state._shareCode ? "rgba(34,197,94,0.08)" : "rgba(168,85,247,0.08)", border: `1px solid ${state._shareCode ? "rgba(34,197,94,0.2)" : "rgba(168,85,247,0.2)"}`, borderRadius: 6, cursor: "pointer", fontSize: 10, fontWeight: 600, fontFamily: "inherit", color: state._shareCode ? "#22c55e" : "#a855f7" }}>
                  {state._shareCode ? "🔗 Partagé" : "🔗 Partager"}
                </button>
                {state._shareCode && state._guestVotes && Object.keys(state._guestVotes).length > 0 && (
                  <span style={{ fontSize: 9, padding: "3px 8px", background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 6, color: "#60a5fa", fontWeight: 700 }}>
                    {Object.keys(state._guestVotes).length} vote{Object.keys(state._guestVotes).length !== 1 ? "s" : ""} RÉAL/PROD
                  </span>
                )}
                <div style={{ width: 1, height: 20, background: "#2a2a2e" }} />
            <button onClick={() => setLightTheme(!lightTheme)}
              style={{ padding: "5px 8px", background: "none", border: "1px solid #2a2a2e", borderRadius: 6, cursor: "pointer", fontSize: 14, lineHeight: 1 }}
              title={lightTheme ? "Mode sombre" : "Mode clair"}>
              {lightTheme ? "🌙" : "☀️"}
            </button>
          </div>
        </header>

        <div style={{ display: "flex", minHeight: "calc(100vh - 60px)" }}>
          {/* Sidebar — Roles */}
          <nav style={{
            width: 240, borderRight: "1px solid #1a1a1e", padding: "24px 0",
            background: "#0d0d0f", flexShrink: 0, position: "sticky", top: 60,
            height: "calc(100vh - 60px)", overflowY: "auto",
          }}>
            {/* Tab nav */}
            <div style={{ padding: "0 8px", marginBottom: 20, display: "flex", flexDirection: "column", gap: 2 }}>
              {[
                { key: "projet", icon: "📄", label: "Projet", color: "#e879f9", show: true },
                { key: "roles", icon: "🎭", label: "Rôles", color: "#c9a44a", show: true },
                { key: "contacts", icon: "📇", label: "Contacts", color: "#60a5fa", show: true, badge: (() => { const all = Object.values(state.profiles).flat(); return all.filter(p => getChoice(p.id)).length; })() },
                { key: "planning", icon: "📋", label: "Planning", color: "#a855f7", show: true, badge: state.castingDays.length },
                { key: "casting", icon: "🎬", label: "Casting", color: "#fb923c", show: true },
                { key: "final", icon: "🏆", label: "Final", color: "#22c55e", show: true, badge: Object.values(state.finalSelections).filter(f => f.selected === true).length },
                { key: "mail", icon: "✉", label: "Gmail", color: "#EA4335", show: true, badge: (state.emailLog || []).length },
              ].filter(t => t.show).map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "9px 14px",
                    borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "inherit",
                    fontSize: 12, fontWeight: 600, textAlign: "left", width: "100%",
                    transition: "all 0.2s", position: "relative",
                    background: activeTab === tab.key ? `${tab.color}18` : "transparent",
                    color: activeTab === tab.key ? tab.color : "#666",
                  }}
                  onMouseEnter={e => { if (activeTab !== tab.key) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                  onMouseLeave={e => { if (activeTab !== tab.key) e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ fontSize: 14, width: 20, textAlign: "center" }}>{tab.icon}</span>
                  <span>{tab.label}</span>
                  {activeTab === tab.key && <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 3, height: 18, borderRadius: 2, background: tab.color }} />}
                  {tab.badge > 0 && (
                    <span style={{
                      marginLeft: "auto", fontSize: 9, fontWeight: 700,
                      background: activeTab === tab.key ? tab.color : "#333",
                      color: activeTab === tab.key ? "#000" : "#888",
                      borderRadius: 10, padding: "1px 6px", minWidth: 16, textAlign: "center",
                    }}>{tab.badge}</span>
                  )}
                </button>
              ))}
            </div>


            {activeTab === "projet" && (
              <div style={{ padding: "0 8px" }}>
                <div style={{ padding: "0 8px", marginBottom: 12 }}>
                  <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "#555", fontWeight: 600 }}>Sections</div>
                </div>
                {[
                  { key: "infos", icon: "🎬", label: "Infos & Rôles" },
                  { key: "documents", icon: "📎", label: "Documents" },
                  { key: "devis", icon: "📝", label: "Devis" },
                  { key: "summary", icon: "📋", label: "Fiche synthétique" },
                ].map(item => (
                  <button key={item.key} onClick={() => setProjetSection(item.key)} style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 14px",
                    borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit",
                    fontSize: 12, fontWeight: projetSection === item.key ? 600 : 400, textAlign: "left",
                    background: projetSection === item.key ? "rgba(232,121,249,0.1)" : "transparent",
                    color: projetSection === item.key ? "#e879f9" : "#666",
                  }}>
                    <span style={{ fontSize: 14, width: 20, textAlign: "center" }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}

            {activeTab === "roles" && (
            <>
            <div style={{ padding: "0 20px", marginBottom: 20 }}>
              <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "#555", fontWeight: 600, marginBottom: 14 }}>
                Rôles
              </div>
            </div>
            {state.roles.map(role => {
              const count = (state.profiles[role] || []).length;
              const isActive = activeRole === role;
              // Selection stats per role
              const roleProfiles = state.profiles[role] || [];
              const yesCount = roleProfiles.filter(p => getChoice(p.id) === "yes").length;
              const maybeCount = roleProfiles.filter(p => getChoice(p.id) === "maybe").length;
              const noCount = roleProfiles.filter(p => getChoice(p.id) === "no").length;
              const hasSelections = yesCount + maybeCount + noCount > 0;
              // Contact stats
              const confirmedCount = roleProfiles.filter(p => state.contacts[p.id]?.status === "confirmed").length;
              const contactedCount = roleProfiles.filter(p => {
                const s = state.contacts[p.id]?.status;
                return s === "contacted" || s === "waiting";
              }).length;
              return (
                <button
                  key={role}
                  onClick={() => { setActiveRole(role); setSearchQuery(""); setFilterStatus("all"); setFilterSelection("all"); setFilterContact("all"); }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    width: "100%", padding: "10px 20px", border: "none",
                    background: isActive ? "rgba(201,164,74,0.08)" : "transparent",
                    borderLeft: isActive ? "2px solid #c9a44a" : "2px solid transparent",
                    color: isActive ? "#f0f0f0" : "#777", cursor: "pointer",
                    fontSize: 13, fontWeight: isActive ? 600 : 400, fontFamily: "inherit",
                    transition: "all 0.2s", textAlign: "left",
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{role}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {hasSelections && (viewMode === "director" || viewMode === "realisateur") && (
                      <div style={{ display: "flex", gap: 2 }}>
                        {yesCount > 0 && <span style={{ fontSize: 9, color: "#22c55e", fontWeight: 700 }}>{yesCount}✓</span>}
                        {maybeCount > 0 && <span style={{ fontSize: 9, color: "#f59e0b", fontWeight: 700 }}>{maybeCount}?</span>}
                      </div>
                    )}
                    {viewMode === "director" && confirmedCount > 0 && (
                      <span style={{ fontSize: 9, color: "#22c55e", fontWeight: 700, background: "rgba(34,197,94,0.1)", padding: "1px 4px", borderRadius: 3 }}>
                        {confirmedCount}☑
                      </span>
                    )}
                    <span style={{
                      fontSize: 11, color: isActive ? "#c9a44a" : "#444",
                      background: isActive ? "rgba(201,164,74,0.12)" : "rgba(255,255,255,0.03)",
                      padding: "2px 8px", borderRadius: 6, fontWeight: 600,
                    }}>
                      {count}
                    </span>
                  </div>
                </button>
              );
            })}

            {/* Add role (director only) */}
            {viewMode === "director" && (showAddRole ? (
              <div style={{ padding: "10px 16px" }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    value={newRoleName}
                    onChange={e => setNewRoleName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") addNewRole();
                      if (e.key === "Escape") { setShowAddRole(false); setNewRoleName(""); }
                    }}
                    autoFocus
                    placeholder="Nom du rôle"
                    style={{
                      flex: 1, padding: "7px 10px", background: "#111114", border: "1px solid #c9a44a44",
                      borderRadius: 8, color: "#e0e0e0", fontSize: 12, fontFamily: "inherit", outline: "none",
                    }}
                  />
                  <button onClick={addNewRole} style={{
                    padding: "7px 10px", background: "#c9a44a22", color: "#c9a44a",
                    border: "1px solid #c9a44a44", borderRadius: 8, cursor: "pointer",
                    fontSize: 12, fontFamily: "inherit", fontWeight: 600,
                  }}>
                    ✓
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddRole(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                  padding: "10px 20px", border: "none", background: "transparent",
                  color: "#444", cursor: "pointer", fontSize: 12, fontFamily: "inherit",
                  transition: "color 0.2s",
                }}
                onMouseEnter={e => e.currentTarget.style.color = "#888"}
                onMouseLeave={e => e.currentTarget.style.color = "#444"}
              >
                + Ajouter un rôle
              </button>
            ))}
            </>
            )}

            {/* Contacts sidebar */}
            {activeTab === "contacts" && (() => {
              const isFinal = contactSubTab === "final";

              let rolesWithContacts;
              if (isFinal) {
                rolesWithContacts = state.roles.filter(role => {
                  return (state.profiles[role] || []).some(p => state.finalSelections[p.id]?.selected != null);
                });
              } else {
                rolesWithContacts = state.roles.filter(role => {
                  return (state.profiles[role] || []).some(p => getChoice(p.id));
                });
              }
              const effectiveRole = contactActiveRole && rolesWithContacts.includes(contactActiveRole)
                ? contactActiveRole
                : rolesWithContacts[0] || null;
              if (effectiveRole && effectiveRole !== contactActiveRole) {
                setTimeout(() => setContactActiveRole(effectiveRole), 0);
              }

              return (
                <div>
                  {/* Sub-tab toggle */}
                  <div style={{ padding: "0 12px", marginBottom: 16 }}>
                    <div style={{ display: "flex", gap: 2, background: "#0c0c0e", borderRadius: 8, padding: 2 }}>
                      <button
                        onClick={() => { setContactSubTab("premier"); setContactActiveRole(null); }}
                        style={{
                          flex: 1, padding: "7px 0", borderRadius: 6, fontSize: 10, fontWeight: 600,
                          fontFamily: "inherit", border: "none", cursor: "pointer",
                          background: !isFinal ? "rgba(59,130,246,0.12)" : "transparent",
                          color: !isFinal ? "#60a5fa" : "#555",
                          transition: "all 0.2s",
                        }}
                      >
                        Premier contact
                      </button>
                      <button
                        onClick={() => { setContactSubTab("final"); setContactActiveRole(null); }}
                        style={{
                          flex: 1, padding: "7px 0", borderRadius: 6, fontSize: 10, fontWeight: 600,
                          fontFamily: "inherit", border: "none", cursor: "pointer",
                          background: isFinal ? "rgba(34,197,94,0.12)" : "transparent",
                          color: isFinal ? "#22c55e" : "#555",
                          transition: "all 0.2s",
                        }}
                      >
                        🏆 Casting final
                      </button>
                    </div>
                  </div>

                  <div style={{ padding: "0 20px", marginBottom: 16 }}>
                    <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "#555", fontWeight: 600, marginBottom: 14 }}>
                      Rôles
                    </div>
                  </div>
                  {state.roles.map(role => {
                    const roleProfiles = state.profiles[role] || [];
                    let totalEval, selCount, noCount, contactedCount, contactStore;

                    if (isFinal) {
                      contactStore = state.finalContacts;
                      selCount = roleProfiles.filter(p => state.finalSelections[p.id]?.selected === true).length;
                      noCount = roleProfiles.filter(p => state.finalSelections[p.id]?.selected === false).length;
                      totalEval = selCount + noCount;
                      contactedCount = roleProfiles.filter(p => {
                        const fs = state.finalSelections[p.id];
                        if (!fs || fs.selected == null) return false;
                        const s = contactStore[p.id]?.status;
                        return s && s !== "not_contacted";
                      }).length;
                    } else {
                      contactStore = state.contacts;
                      selCount = roleProfiles.filter(p => {
                        const s = getChoice(p.id);
                        return s === "yes" || s === "maybe";
                      }).length;
                      noCount = roleProfiles.filter(p => getChoice(p.id) === "no").length;
                      totalEval = selCount + noCount;
                      const evaluatedProfiles = roleProfiles.filter(p => getChoice(p.id));
                      contactedCount = evaluatedProfiles.filter(p => {
                        const s = contactStore[p.id]?.status;
                        return s && s !== "not_contacted";
                      }).length;
                    }

                    if (totalEval === 0) return null;
                    const isActive = effectiveRole === role;
                    const accentColor = isFinal ? "#22c55e" : "#60a5fa";

                    return (
                      <button
                        key={role}
                        onClick={() => setContactActiveRole(role)}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          width: "100%", padding: "10px 20px", border: "none",
                          background: isActive ? (isFinal ? "rgba(34,197,94,0.08)" : "rgba(59,130,246,0.08)") : "transparent",
                          borderLeft: isActive ? `2px solid ${accentColor}` : "2px solid transparent",
                          color: isActive ? "#f0f0f0" : "#777", cursor: "pointer",
                          fontSize: 13, fontWeight: isActive ? 600 : 400, fontFamily: "inherit",
                          transition: "all 0.2s", textAlign: "left",
                        }}
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                          {role}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                          {selCount > 0 && <span style={{ fontSize: 9, color: "#22c55e", fontWeight: 700 }}>{selCount}✓</span>}
                          {noCount > 0 && <span style={{ fontSize: 9, color: "#ef4444", fontWeight: 700 }}>{noCount}✕</span>}
                          {contactedCount > 0 && (
                            <span style={{
                              fontSize: 9, color: accentColor, fontWeight: 700,
                              background: `${accentColor}18`, padding: "1px 5px", borderRadius: 3,
                            }}>
                              {contactedCount}/{totalEval}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  {rolesWithContacts.length === 0 && (
                    <div style={{ padding: "20px", textAlign: "center", color: "#444", fontSize: 12 }}>
                      {isFinal ? "Aucune décision prise dans l'onglet Casting" : "Aucun profil évalué"}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Planning sidebar */}
            {activeTab === "planning" && (
              <div>
                <div style={{ padding: "0 20px", marginBottom: 16 }}>
                  <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "#555", fontWeight: 600, marginBottom: 14 }}>
                    Journées de casting
                  </div>
                </div>
                {state.castingDays.map(day => {
                  const isActive = activeCastingDay === day.id;
                  return (
                    <button
                      key={day.id}
                      onClick={() => setActiveCastingDay(day.id)}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        width: "100%", padding: "10px 20px", border: "none",
                        background: isActive ? "rgba(168,85,247,0.08)" : "transparent",
                        borderLeft: isActive ? "2px solid #a855f7" : "2px solid transparent",
                        color: isActive ? "#f0f0f0" : "#777", cursor: "pointer",
                        fontSize: 13, fontWeight: isActive ? 600 : 400, fontFamily: "inherit",
                        transition: "all 0.2s", textAlign: "left",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {day.date ? new Date(day.date + "T00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) : "Date à définir"}
                        </div>
                        {day.location && <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{day.location}</div>}
                      </div>
                      <span style={{
                        fontSize: 11, color: isActive ? "#a855f7" : "#444",
                        background: isActive ? "rgba(168,85,247,0.12)" : "rgba(255,255,255,0.03)",
                        padding: "2px 8px", borderRadius: 6, fontWeight: 600,
                      }}>
                        {day.slots.length}
                      </span>
                    </button>
                  );
                })}
                {showAddDay ? (
                  <div style={{ padding: "10px 16px" }}>
                    <input
                      type="date"
                      id="newDayDate"
                      style={{
                        width: "100%", padding: "8px 10px", background: "#111114", border: "1px solid #2a2a2e",
                        borderRadius: 8, color: "#e0e0e0", fontSize: 12, fontFamily: "inherit",
                        outline: "none", marginBottom: 6,
                      }}
                    />
                    <input
                      id="newDayLocation"
                      placeholder="Lieu (optionnel)"
                      style={{
                        width: "100%", padding: "8px 10px", background: "#111114", border: "1px solid #2a2a2e",
                        borderRadius: 8, color: "#e0e0e0", fontSize: 12, fontFamily: "inherit",
                        outline: "none", marginBottom: 6,
                      }}
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => {
                          const date = document.getElementById("newDayDate")?.value || "";
                          const loc = document.getElementById("newDayLocation")?.value || "";
                          addCastingDay(date, loc);
                        }}
                        style={{
                          flex: 1, padding: "8px", background: "#a855f7", color: "#000",
                          border: "none", borderRadius: 8, cursor: "pointer",
                          fontSize: 12, fontFamily: "inherit", fontWeight: 600,
                        }}
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setShowAddDay(false)}
                        style={{
                          padding: "8px 12px", background: "transparent", color: "#666",
                          border: "1px solid #333", borderRadius: 8, cursor: "pointer",
                          fontSize: 12, fontFamily: "inherit",
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddDay(true)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, width: "100%",
                      padding: "10px 20px", border: "none", background: "transparent",
                      color: "#444", cursor: "pointer", fontSize: 12, fontFamily: "inherit",
                      transition: "color 0.2s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = "#a855f7"}
                    onMouseLeave={e => e.currentTarget.style.color = "#444"}
                  >
                    + Nouvelle journée
                  </button>
                )}
              </div>
            )}

            {/* Casting sidebar */}
            {(activeTab === "casting" || activeTab === "final") && (
              <div>
                {activeTab === "casting" && !guestMode && (
                  <>
                    {/* Planning days nav */}
                    <div style={{ padding: "0 12px", marginBottom: 12 }}>
                      <div style={{ display: "flex", gap: 2, background: "#0c0c0e", borderRadius: 8, padding: 2 }}>
                        <button onClick={() => setCastingDayFilter("all")}
                          style={{ flex: 1, padding: "7px 0", borderRadius: 6, fontSize: 10, fontWeight: 600, fontFamily: "inherit", border: "none", cursor: "pointer", background: castingDayFilter === "all" ? "rgba(251,146,60,0.12)" : "transparent", color: castingDayFilter === "all" ? "#fb923c" : "#555", transition: "all 0.2s" }}>
                          Tous
                        </button>
                        <button onClick={() => setCastingDayFilter("unplanned")}
                          style={{ flex: 1, padding: "7px 0", borderRadius: 6, fontSize: 10, fontWeight: 600, fontFamily: "inherit", border: "none", cursor: "pointer", background: castingDayFilter === "unplanned" ? "rgba(245,158,11,0.12)" : "transparent", color: castingDayFilter === "unplanned" ? "#f59e0b" : "#555", transition: "all 0.2s" }}>
                          Non planifiés
                        </button>
                      </div>
                    </div>
                    {/* Days list */}
                    {state.castingDays.map(day => {
                      const daySlotProfileIds = day.slots.map(s => s.profileId);
                      const count = daySlotProfileIds.length;
                      const passed = daySlotProfileIds.filter(pid => state.castingSessions[pid]?.passStatus === "passed").length;
                      const isActive = castingDayFilter === day.id;
                      const dateLabel = day.date ? new Date(day.date + "T00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) : "Date TBD";
                      return (
                        <button key={day.id} onClick={() => setCastingDayFilter(day.id)}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            width: "100%", padding: "10px 20px", border: "none",
                            background: isActive ? "rgba(251,146,60,0.08)" : "transparent",
                            borderLeft: isActive ? "2px solid #fb923c" : "2px solid transparent",
                            color: isActive ? "#f0f0f0" : "#777", cursor: "pointer",
                            fontSize: 12, fontWeight: isActive ? 600 : 400, fontFamily: "inherit",
                            transition: "all 0.2s", textAlign: "left",
                          }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>📅 {dateLabel}</div>
                            {day.location && <div style={{ fontSize: 9, color: "#555", marginTop: 2 }}>📍 {day.location}</div>}
                          </div>
                          <span style={{ fontSize: 9, color: "#22c55e", fontWeight: 700 }}>{passed}/{count}</span>
                        </button>
                      );
                    })}
                    <div style={{ height: 1, background: "#1e1e22", margin: "10px 16px" }} />
                  </>
                )}

                {/* Roles list */}
                <div style={{ padding: "0 20px", marginBottom: 10 }}>
                  <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "#555", fontWeight: 600 }}>
                    {activeTab === "final" ? "Casting définitif" : "Par rôle"}
                  </div>
                </div>
                {state.roles.map(role => {
                  const roleProfiles = state.profiles[role] || [];
                  let filtered;
                  if (activeTab === "final") {
                    filtered = roleProfiles.filter(p => state.finalSelections[p.id]?.selected != null);
                  } else {
                    filtered = roleProfiles.filter(p => {
                      const s = getChoice(p.id);
                      return s === "yes" || s === "maybe";
                    });
                  }
                  if (filtered.length === 0) return null;
                  const rc = getRoleColor(role);
                  const isActive = castingActiveRole === role;
                  const passedCount = filtered.filter(p => state.castingSessions[p.id]?.passStatus === "passed").length;
                  return (
                    <button key={role} onClick={() => setCastingActiveRole(role)}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        width: "100%", padding: "9px 20px", border: "none",
                        background: isActive ? rc.bg : "transparent",
                        borderLeft: isActive ? `2px solid ${rc.color}` : "2px solid transparent",
                        color: isActive ? "#f0f0f0" : "#777", cursor: "pointer",
                        fontSize: 13, fontWeight: isActive ? 600 : 400, fontFamily: "inherit",
                        transition: "all 0.2s", textAlign: "left",
                      }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{role}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        {activeTab === "casting" && <span style={{ fontSize: 9, color: "#22c55e", fontWeight: 700 }}>{passedCount}/{filtered.length}</span>}
                        {activeTab === "final" && <span style={{ fontSize: 9, color: "#22c55e", fontWeight: 700 }}>{filtered.length}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </nav>

          {/* Main Content */}
          <main style={{ flex: 1, padding: "28px 36px" }}>


            {/* ===== PROJET VIEW ===== */}
            {activeTab === "projet" ? (
              <div style={{ maxWidth: 900 }}>

              {/* -- INFOS & RÔLES -- */}
              {projetSection === "infos" && (
                <div>
                {projetValidated && !projetEditMode ? (
                  /* VALIDATED FICHE */
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                      <h2 style={{ fontSize: 22, fontWeight: 700, color: "#f0f0f0" }}>Fiche projet</h2>
                      <button onClick={() => setProjetEditMode(true)} style={{ padding: "8px 18px", background: "rgba(232,121,249,0.08)", border: "1px solid rgba(232,121,249,0.2)", borderRadius: 8, color: "#e879f9", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>✏️ Modifier</button>
                    </div>
                    <div style={{ background: "#141416", borderRadius: 16, border: "1px solid #222226", padding: "28px 32px", marginBottom: 20 }}>
                      <h1 style={{ fontSize: 24, fontWeight: 800, color: "#f0f0f0", marginBottom: 16 }}>{state.projectName || "Sans titre"}</h1>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 32px" }}>
                        {[{ l: "Production", v: pi.production }, { l: "Réalisateur·rice", v: pi.director }, { l: "Photographe", v: pi.photographer }, { l: "Jours de tournage", v: pi.shootingDays }, { l: "Rémunération", v: pi.salary?.amount ? `${pi.salary.amount} € (${pi.salary.type === "facture" ? "Facture" : "Fiche de paie"})` : null }].filter(x => x.v).map(x => (
                          <div key={x.l} style={{ fontSize: 13 }}><span style={{ color: "#555", fontWeight: 600 }}>{x.l}: </span><span style={{ color: "#e0e0e0" }}>{x.v}</span></div>
                        ))}
                      </div>
                      {projetDateChips.length > 0 && (
                        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #1e1e22" }}>
                          <div style={{ fontSize: 10, color: "#c9a44a", fontWeight: 600, textTransform: "uppercase", marginBottom: 10 }}>Planning</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {projetDateChips.map((x, i) => (
                              <div key={i} style={{ padding: "7px 12px", background: "rgba(201,164,74,0.06)", border: "1px solid rgba(201,164,74,0.15)", borderRadius: 8, fontSize: 11 }}>
                                {x.icon} <span style={{ color: "#888", fontWeight: 600 }}>{x.label}:</span> <span style={{ color: "#e0e0e0" }}>{x.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Validated role cards */}
                    {state.roles.map((role, ri) => {
                      const rd = state.roleDetails?.[role] || {};
                      const rc = ROLE_COLORS[ri % ROLE_COLORS.length];
                      const tD = rd.profileType === "Autres" ? (rd.profileTypeCustom || "Autres") : rd.profileType;
                      const sD = rd.actingStyle === "Autres" ? (rd.actingStyleCustom || "Autres") : rd.actingStyle;
                      return (
                        <div key={role} style={{ background: "#141416", borderRadius: 16, border: `1px solid ${rc.border}`, marginBottom: 14, overflow: "hidden" }}>
                          <div style={{ padding: "14px 24px", background: rc.bg, display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${rc.border}` }}>
                            <div style={{ width: 10, height: 10, borderRadius: "50%", background: rc.color }} />
                            <span style={{ fontSize: 16, fontWeight: 700, color: rc.color, flex: 1 }}>{role}</span>
                            {rd.nbComediens && <span style={{ fontSize: 11, padding: "3px 10px", background: `${rc.color}15`, borderRadius: 8, color: rc.color, fontWeight: 600 }}>{rd.nbComediens} comédien{parseInt(rd.nbComediens) > 1 ? "s" : ""}</span>}
                            {rd.nbJoursTournage && <span style={{ fontSize: 11, padding: "3px 10px", background: "rgba(201,164,74,0.08)", borderRadius: 8, color: "#c9a44a", fontWeight: 600 }}>{rd.nbJoursTournage}j / comédien</span>}
                          </div>
                          <div style={{ padding: "18px 24px" }}>
                            {(rd.referencePhotos || []).length > 0 && <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>{rd.referencePhotos.map((p, i) => <div key={i} style={{ width: 56, height: 70, borderRadius: 8, overflow: "hidden", border: `1px solid ${rc.border}` }}><img src={p} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>)}</div>}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px 20px" }}>
                              {rd.sex && <div><div style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Sexe</div><div style={{ fontSize: 13, color: "#e0e0e0" }}>{rd.sex}</div></div>}
                              {rd.ageStyle && <div><div style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Âge</div><div style={{ fontSize: 13, color: "#e0e0e0" }}>{rd.ageStyle}</div></div>}
                              {(rd.ageMin || rd.ageMax) && <div><div style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Tranche</div><div style={{ fontSize: 13, color: "#e0e0e0" }}>{rd.ageMin || "?"} — {rd.ageMax || "?"} ans</div></div>}
                              {tD && <div><div style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Type</div><div style={{ fontSize: 13, color: "#e0e0e0" }}>{tD}</div></div>}
                              {sD && <div><div style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Jeu</div><div style={{ fontSize: 13, color: "#e0e0e0" }}>{sD}</div></div>}
                              {rd.cachet && <div><div style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Rému</div><div style={{ fontSize: 14, color: (rd.cachetType === "ht" || rd.cachetType === "facture") ? "#e879f9" : "#c9a44a", fontWeight: 600 }}>{rd.cachet} € {(rd.cachetType === "ht" || rd.cachetType === "facture") ? "HT" : "BRUT"}</div></div>}
                              {rd.droits && <div><div style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Droits</div><div style={{ fontSize: 14, color: "#f59e0b", fontWeight: 600 }}>{rd.droits} €</div></div>}
                            </div>
                            {(rd.ethnicities || []).length > 0 && <div style={{ marginTop: 10 }}>{rd.ethnicities.map(e => <span key={e} style={{ fontSize: 11, padding: "3px 10px", background: `${rc.color}18`, borderRadius: 12, color: rc.color, marginRight: 6 }}>{e}</span>)}</div>}
                            {rd.notes && <div style={{ marginTop: 10, padding: "10px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 8, borderLeft: `3px solid ${rc.color}44`, fontSize: 13, color: "#aaa" }}>📝 {rd.notes}</div>}
                            {rd.specificities && <div style={{ marginTop: 6, padding: "10px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 8, borderLeft: "3px solid #f59e0b44", fontSize: 13, color: "#aaa" }}>⚡ {rd.specificities}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* EDIT MODE */
                  <div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: "#f0f0f0", marginBottom: 6 }}>Informations du projet</h2>
                    <p style={{ fontSize: 12, color: "#555", marginBottom: 24 }}>Renseignez les infos, ajoutez vos rôles puis validez.</p>

                    {/* Project info */}
                    <div style={{ background: "#141416", borderRadius: 14, border: "1px solid #222226", padding: "22px 26px", marginBottom: 20 }}>
                      <div style={{ fontSize: 11, color: "#c9a44a", fontWeight: 600, textTransform: "uppercase", marginBottom: 16 }}>🏢 Projet</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
                        {[
                          { l: "Nom du projet", v: state.projectName, fn: v => setState(p => ({ ...p, projectName: v })), ph: "Ex: Pub Nike — Été 2026" },
                          { l: "Production", v: pi.production, fn: v => uPI("production", v), ph: "Boîte de prod" },
                          { l: "Réalisateur·rice", v: pi.director, fn: v => uPI("director", v), ph: "Nom" },
                          { l: "Photographe", v: pi.photographer, fn: v => uPI("photographer", v), ph: "Nom" },
                          { l: "Jours de tournage", v: pi.shootingDays, fn: v => uPI("shootingDays", v), ph: "Ex: 3" },
                        ].map(f => (
                          <div key={f.l} style={{ marginBottom: 12 }}>
                            <label style={{ display: "block", fontSize: 10, color: "#888", marginBottom: 6, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{f.l}</label>
                            <input value={f.v || ""} onChange={e => f.fn(e.target.value)} placeholder={f.ph} style={{ width: "100%", padding: "10px 14px", background: "#111114", border: "1px solid #2a2a2e", borderRadius: 10, color: "#e0e0e0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" }} />
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 8, paddingTop: 14, borderTop: "1px solid #1e1e22" }}>
                        <div style={{ fontSize: 10, color: "#888", fontWeight: 600, textTransform: "uppercase", marginBottom: 10 }}>Ma rémunération</div>
                        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                          <div style={{ flex: 1 }}>
                            <input value={pi.salary?.amount || ""} onChange={e => uPI("salary", { ...(pi.salary || {}), amount: e.target.value })} placeholder="Montant €" style={{ width: "100%", padding: "10px 14px", background: "#111114", border: "1px solid #2a2a2e", borderRadius: 10, color: "#e0e0e0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" }} />
                          </div>
                          <div style={{ display: "flex", gap: 4 }}>
                            {PROJET_SALARY_OPTS.map(o => (
                              <button key={o.value} onClick={() => uPI("salary", { ...(pi.salary || {}), type: o.value })} style={{ padding: "10px 18px", borderRadius: 10, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", border: "1px solid", background: (pi.salary?.type || "facture") === o.value ? "rgba(232,121,249,0.12)" : "rgba(255,255,255,0.02)", color: (pi.salary?.type || "facture") === o.value ? "#e879f9" : "#666", borderColor: (pi.salary?.type || "facture") === o.value ? "rgba(232,121,249,0.3)" : "#2a2a2e" }}>{o.label}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Dates */}
                    <div style={{ background: "#141416", borderRadius: 14, border: "1px solid #222226", padding: "22px 26px", marginBottom: 24 }}>
                      <div style={{ fontSize: 11, color: "#60a5fa", fontWeight: 600, textTransform: "uppercase", marginBottom: 16 }}>📅 Dates clés</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px 14px", marginBottom: 14 }}>
                        <div style={{ gridColumn: "1 / 3" }}>
                          <label style={{ display: "block", fontSize: 10, color: "#888", marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>Date de tournage</label>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <input type="date" value={pi.dateTournageDe || pi.dateTournage || ""} onChange={e => uPI("dateTournageDe", e.target.value)} style={{ flex: 1, padding: "9px 12px", background: "#0c0c0e", border: "1px solid #2a2a2e", borderRadius: 8, color: "#e0e0e0", fontSize: 12, fontFamily: "'DM Sans',sans-serif", outline: "none", cursor: "pointer", boxSizing: "border-box" }} />
                            <span style={{ color: "#555", fontSize: 11, fontWeight: 600 }}>au</span>
                            <input type="date" value={pi.dateTournageA || ""} onChange={e => uPI("dateTournageA", e.target.value)} placeholder="(optionnel)" style={{ flex: 1, padding: "9px 12px", background: "#0c0c0e", border: "1px solid #2a2a2e", borderRadius: 8, color: "#e0e0e0", fontSize: 12, fontFamily: "'DM Sans',sans-serif", outline: "none", cursor: "pointer", boxSizing: "border-box" }} />
                          </div>
                        </div>
                        {[{ l: "Rendu 1ère salve profils", k: "dateRenduProfils" }, { l: "Date PPM", k: "datePPM" }, { l: "Date validation", k: "dateValidation" }].map(d => (
                          <div key={d.k}>
                            <label style={{ display: "block", fontSize: 10, color: "#888", marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>{d.l}</label>
                            <input type="date" value={pi[d.k] || ""} onChange={e => uPI(d.k, e.target.value)} style={{ width: "100%", padding: "9px 12px", background: "#0c0c0e", border: "1px solid #2a2a2e", borderRadius: 8, color: "#e0e0e0", fontSize: 12, fontFamily: "'DM Sans',sans-serif", outline: "none", cursor: "pointer", boxSizing: "border-box" }} />
                          </div>
                        ))}
                      </div>
                      {/* Custom dates */}
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <label style={{ fontSize: 10, color: "#f59e0b", fontWeight: 600, textTransform: "uppercase" }}>📌 Dates supplémentaires</label>
                          <button onClick={addCustomDate} style={{ padding: "4px 12px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 6, color: "#f59e0b", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>+ Ajouter</button>
                        </div>
                        {(pi.customDates || []).map((cd, i) => (
                          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
                            <input value={cd.label || ""} onChange={e => updateCustomDate(i, "label", e.target.value)} placeholder="Nature (ex: Essayage)" style={{ width: 160, padding: "8px 12px", background: "#0c0c0e", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 8, color: "#f59e0b", fontSize: 12, fontFamily: "'DM Sans',sans-serif", outline: "none" }} />
                            <input type="date" value={cd.date || ""} onChange={e => updateCustomDate(i, "date", e.target.value)} style={{ flex: 1, padding: "8px 12px", background: "#0c0c0e", border: "1px solid #2a2a2e", borderRadius: 8, color: "#e0e0e0", fontSize: 12, fontFamily: "'DM Sans',sans-serif", outline: "none", cursor: "pointer" }} />
                            <button onClick={() => removeCustomDate(i)} style={{ background: "none", border: "none", color: "#44444488", cursor: "pointer", fontSize: 13 }}>×</button>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <label style={{ fontSize: 10, color: "#60a5fa", fontWeight: 600, textTransform: "uppercase" }}>Dates de casting</label>
                        <button onClick={addProjetCastingDate} style={{ padding: "4px 12px", background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 6, color: "#60a5fa", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>+ Ajouter</button>
                      </div>
                      {(pi.castingDates || []).length === 0 && <div style={{ fontSize: 11, color: "#444", fontStyle: "italic" }}>Aucune date — cliquez "+ Ajouter"</div>}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {(pi.castingDates || []).map((d, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ position: "relative" }}>
                              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 9, color: "#60a5fa", fontWeight: 700, pointerEvents: "none", zIndex: 1 }}>{"#" + (i + 1)}</span>
                              <input type="date" value={d || ""} onChange={e => updateProjetCastingDate(i, e.target.value)} style={{ padding: "8px 12px 8px 32px", background: "#111114", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 8, color: "#e0e0e0", fontSize: 12, fontFamily: "'DM Sans',sans-serif", outline: "none", cursor: "pointer" }} />
                            </div>
                            <button onClick={() => removeProjetCastingDate(i)} style={{ background: "none", border: "none", color: "#44444488", cursor: "pointer", fontSize: 13 }}>×</button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Roles */}
                    <div style={{ fontSize: 11, color: "#e879f9", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>🎭 Rôles ({state.roles.length})</div>

                    {state.roles.length === 0 && !projetShowAddRole && (
                      <div style={{ textAlign: "center", padding: "36px 20px", background: "#141416", borderRadius: 14, border: "1px dashed #2a2a2e", marginBottom: 14 }}>
                        <div style={{ fontSize: 28, marginBottom: 10 }}>🎭</div>
                        <div style={{ fontSize: 13, color: "#666", marginBottom: 14 }}>Aucun rôle</div>
                        <button onClick={() => setProjetShowAddRole(true)} style={{ padding: "10px 22px", background: "rgba(232,121,249,0.12)", border: "1px solid rgba(232,121,249,0.3)", borderRadius: 10, color: "#e879f9", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>+ Ajouter mon premier rôle</button>
                      </div>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {state.roles.map((role, ri) => {
                        const rd = state.roleDetails?.[role] || {};
                        const rc = ROLE_COLORS[ri % ROLE_COLORS.length];
                        const isOpen = projetExpanded[role] !== false;
                        const allEth = [...PROJET_ETH_OPTS, ...(pi.customEthnicities || [])];
                        const sInput = { width: "100%", padding: "9px 12px", background: "#0c0c0e", border: "1px solid #2a2a2e", borderRadius: 8, color: "#e0e0e0", fontSize: 12, fontFamily: "'DM Sans',sans-serif", outline: "none", cursor: "pointer", boxSizing: "border-box" };
                        return (
                          <div key={role} style={{ background: "#141416", borderRadius: 14, border: `1px solid ${rc.border}`, overflow: "hidden" }}>
                            <div onClick={() => setProjetExpanded(p => ({ ...p, [role]: !isOpen }))} style={{ padding: "12px 22px", background: rc.bg, display: "flex", alignItems: "center", gap: 10, borderBottom: isOpen ? `1px solid ${rc.border}` : "none", cursor: "pointer", userSelect: "none" }}>
                              <div style={{ width: 8, height: 8, borderRadius: "50%", background: rc.color }} />
                              <span style={{ fontSize: 15, fontWeight: 700, color: rc.color, flex: 1 }}>{role}</span>
                              <button onClick={e => { e.stopPropagation(); if (window.confirm('Supprimer "' + role + '" ?')) { setState(p => { const nr = p.roles.filter(r => r !== role); const np = { ...p.profiles }; delete np[role]; const nd = { ...p.roleDetails }; delete nd[role]; return { ...p, roles: nr, profiles: np, roleDetails: nd }; }); } }} style={{ background: "none", border: "none", color: "#44444488", cursor: "pointer", fontSize: 13 }}>🗑</button>
                              <span style={{ fontSize: 13, color: "#555", transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>▾</span>
                            </div>
                            {isOpen && (
                              <div style={{ padding: "18px 22px" }}>
                                {/* Nb comédiens + jours */}
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16, padding: "12px 16px", background: "rgba(201,164,74,0.04)", borderRadius: 8, border: "1px solid rgba(201,164,74,0.12)" }}>
                                  <div>
                                    <label style={{ display: "block", fontSize: 10, color: "#c9a44a", marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>Nombre de comédiens</label>
                                    <input value={rd.nbComediens || ""} onChange={e => uRoleDetail(role, "nbComediens", e.target.value)} placeholder="Ex: 3" type="number" min="1" style={sInput} />
                                  </div>
                                  <div>
                                    <label style={{ display: "block", fontSize: 10, color: "#c9a44a", marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>Nb de jours de tournage</label>
                                    <input value={rd.nbJoursTournage || ""} onChange={e => uRoleDetail(role, "nbJoursTournage", e.target.value)} placeholder="Ex: 2" type="number" min="1" style={sInput} />
                                  </div>
                                </div>
                                {/* Sub-comedians — always visible */}
                                {(() => {
                                  const comedians = rd.comedians || [];
                                  const max = Math.max(parseInt(rd.nbComediens) || 1, 1);
                                  const updateComedian = (idx, field, value) => {
                                    const arr = [...(rd.comedians || [])];
                                    arr[idx] = { ...arr[idx], [field]: value };
                                    uRoleDetail(role, "comedians", arr);
                                  };
                                  const addComedian = () => {
                                    const arr = [...(rd.comedians || [])];
                                    arr.push({ id: "c" + Date.now(), label: "", sex: "", ageMin: "", ageMax: "", profileType: "", ethnicities: [], notes: "", cachet: "", cachetType: "brut", droits: "", referencePhotos: [] });
                                    uRoleDetail(role, "comedians", arr);
                                  };
                                  const removeComedian = (idx) => {
                                    const arr = [...(rd.comedians || [])];
                                    arr.splice(idx, 1);
                                    uRoleDetail(role, "comedians", arr);
                                  };
                                  const addComPhoto = (ci, url) => {
                                    const arr = [...(rd.comedians || [])];
                                    arr[ci] = { ...arr[ci], referencePhotos: [...(arr[ci].referencePhotos || []), url] };
                                    uRoleDetail(role, "comedians", arr);
                                  };
                                  const removeComPhoto = (ci, pi2) => {
                                    const arr = [...(rd.comedians || [])];
                                    arr[ci] = { ...arr[ci], referencePhotos: (arr[ci].referencePhotos || []).filter((_, j) => j !== pi2) };
                                    uRoleDetail(role, "comedians", arr);
                                  };
                                  return (
                                    <div style={{ marginBottom: 16 }}>
                                      <label style={{ display: "block", fontSize: 10, color: "#e879f9", marginBottom: 8, fontWeight: 600, textTransform: "uppercase" }}>🎭 Comédiens ({comedians.length}/{max})</label>
                                      {comedians.map((c, ci) => (
                                        <div key={c.id || ci} style={{ marginBottom: 10, padding: "14px 16px", background: "rgba(232,121,249,0.03)", borderRadius: 10, border: "1px solid rgba(232,121,249,0.12)" }}>
                                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                                            <input value={c.label || ""} onChange={e => updateComedian(ci, "label", e.target.value)} placeholder="Nom du rôle..." style={{ background: "none", border: "none", color: "#e879f9", fontSize: 13, fontWeight: 700, fontFamily: "inherit", outline: "none", padding: 0, width: "70%" }} />
                                            <button onClick={() => removeComedian(ci)} style={{ background: "none", border: "none", color: "#44444488", cursor: "pointer", fontSize: 13 }}>×</button>
                                          </div>
                                          {/* Photos de reference */}
                                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                                            {(c.referencePhotos || []).map((ph, phi) => (
                                              <div key={phi} style={{ position: "relative", width: 56, height: 70, borderRadius: 6, overflow: "hidden", border: "1px solid rgba(232,121,249,0.2)" }}>
                                                <img src={ph} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                                <button onClick={() => removeComPhoto(ci, phi)} style={{ position: "absolute", top: 1, right: 1, background: "rgba(0,0,0,0.7)", color: "#fff", border: "none", borderRadius: "50%", width: 14, height: 14, cursor: "pointer", fontSize: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                                              </div>
                                            ))}
                                            <button onClick={() => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.multiple = true; inp.onchange = ev => { Array.from(ev.target.files || []).forEach(async (f) => { try { const { url } = await uploadPhoto(f, "default", role + "_c" + ci, (c.referencePhotos || []).length); addComPhoto(ci, url); } catch(e2) { const r = new FileReader(); r.onload = async () => { const compressed = await compressImage(r.result, 600, 0.7); addComPhoto(ci, compressed); }; r.readAsDataURL(f); } }); }; inp.click(); }} style={{ width: 56, height: 70, borderRadius: 6, border: "1px dashed rgba(232,121,249,0.3)", background: "rgba(255,255,255,0.02)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#555", fontSize: 9, fontFamily: "inherit", gap: 2 }}>
                                              <span style={{ fontSize: 14 }}>+</span><span>Photo</span>
                                            </button>
                                          </div>
                                          {/* Criteres */}
                                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                                            <select value={c.sex || ""} onChange={e => updateComedian(ci, "sex", e.target.value)} style={sInput}><option value="">Sexe —</option>{PROJET_SEX_OPTS.map(o => <option key={o} value={o}>{o}</option>)}</select>
                                            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                              <input value={c.ageMin || ""} onChange={e => updateComedian(ci, "ageMin", e.target.value)} placeholder="Âge min" style={{ ...sInput, textAlign: "center" }} />
                                              <span style={{ color: "#555", fontSize: 10 }}>—</span>
                                              <input value={c.ageMax || ""} onChange={e => updateComedian(ci, "ageMax", e.target.value)} placeholder="Âge max" style={{ ...sInput, textAlign: "center" }} />
                                            </div>
                                            <select value={c.profileType || ""} onChange={e => updateComedian(ci, "profileType", e.target.value)} style={sInput}><option value="">Type —</option>{PROJET_TYPE_OPTS.map(o => <option key={o} value={o}>{o}</option>)}</select>
                                          </div>
                                          {/* Ethnies */}
                                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                                            {PROJET_ETH_OPTS.map(eth => {
                                              const active = (c.ethnicities || []).includes(eth);
                                              return <button key={eth} onClick={() => { if (eth === "Toutes") updateComedian(ci, "ethnicities", active ? [] : ["Toutes"]); else { const cur = (c.ethnicities || []).filter(e => e !== "Toutes"); updateComedian(ci, "ethnicities", active ? cur.filter(e => e !== eth) : [...cur, eth]); } }} style={{ padding: "3px 10px", borderRadius: 14, fontSize: 9, fontWeight: 500, fontFamily: "inherit", cursor: "pointer", border: "1px solid", background: active ? "#e879f920" : "rgba(255,255,255,0.02)", color: active ? "#e879f9" : "#555", borderColor: active ? "#e879f955" : "#2a2a2e" }}>{active ? "✓ " : ""}{eth}</button>;
                                            })}
                                          </div>
                                          {/* Remuneration */}
                                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 6 }}>
                                            <div>
                                              <div style={{ display: "flex", gap: 3, marginBottom: 4 }}>
                                                {[{ k: "brut", l: "Brut", col: "#c9a44a" }, { k: "ht", l: "HT", col: "#e879f9" }].map(opt => {
                                                  const ct = c.cachetType === "ht" ? "ht" : "brut";
                                                  return <button key={opt.k} onClick={() => updateComedian(ci, "cachetType", opt.k)} style={{ flex: 1, padding: "5px 0", borderRadius: 5, fontSize: 9, fontWeight: 700, fontFamily: "inherit", border: "1px solid", cursor: "pointer", background: ct === opt.k ? opt.col + "20" : "rgba(255,255,255,0.02)", color: ct === opt.k ? opt.col : "#555", borderColor: ct === opt.k ? opt.col + "55" : "#2a2a2e" }}>{opt.l}</button>;
                                                })}
                                              </div>
                                              <div style={{ position: "relative" }}>
                                                <input value={c.cachet || ""} onChange={e => updateComedian(ci, "cachet", e.target.value)} placeholder="Montant" style={{ ...sInput, paddingRight: 45, fontSize: 11 }} />
                                                <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 9, fontWeight: 700, color: c.cachetType === "ht" ? "#e879f9" : "#c9a44a" }}>{c.cachetType === "ht" ? "€ HT" : "€ BRUT"}</span>
                                              </div>
                                            </div>
                                            <div>
                                              <label style={{ display: "block", fontSize: 8, color: "#f59e0b", marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>Droits</label>
                                              <div style={{ position: "relative" }}>
                                                <input value={c.droits || ""} onChange={e => updateComedian(ci, "droits", e.target.value)} placeholder="Montant droits" style={{ ...sInput, paddingRight: 20, fontSize: 11 }} />
                                                <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 9, fontWeight: 700, color: "#f59e0b" }}>€</span>
                                              </div>
                                            </div>
                                          </div>
                                          {/* Notes */}
                                          <input value={c.notes || ""} onChange={e => updateComedian(ci, "notes", e.target.value)} placeholder="Notes..." style={{ ...sInput, fontSize: 11 }} />
                                        </div>
                                      ))}
                                      {comedians.length < max && (
                                        <button onClick={addComedian} style={{ padding: "8px 16px", background: "rgba(232,121,249,0.06)", border: "1px dashed rgba(232,121,249,0.25)", borderRadius: 8, color: "#e879f9", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>+ Ajouter comédien ({comedians.length + 1}/{max})</button>
                                      )}
                                    </div>
                                  );
                                })()}
                                {/* Photos */}
                                <div style={{ marginBottom: 16 }}>
                                  <label style={{ display: "block", fontSize: 10, color: "#888", marginBottom: 8, fontWeight: 600, textTransform: "uppercase" }}>Photos de référence</label>
                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                    {(rd.referencePhotos || []).map((ph, idx) => (
                                      <div key={idx} style={{ position: "relative", width: 68, height: 85, borderRadius: 8, overflow: "hidden", border: `1px solid ${rc.border}` }}>
                                        <img src={ph} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                        <button onClick={() => uRoleDetail(role, "referencePhotos", (rd.referencePhotos || []).filter((_, i) => i !== idx))} style={{ position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,0.7)", color: "#fff", border: "none", borderRadius: "50%", width: 16, height: 16, cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                                      </div>
                                    ))}
                                    <button onClick={() => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.multiple = true; inp.onchange = ev => { Array.from(ev.target.files || []).forEach(async (f, fi) => { try { const { url } = await uploadPhoto(f, "default", role + "_ref", (rd.referencePhotos || []).length + fi); uRoleDetail(role, "referencePhotos", [...(rd.referencePhotos || []), url]); } catch(err) { console.error("[refPhoto] fallback base64:", err.message); const r = new FileReader(); r.onload = async () => { const compressed = await compressImage(r.result, 600, 0.7); uRoleDetail(role, "referencePhotos", [...(rd.referencePhotos || []), compressed]); }; r.readAsDataURL(f); } }); }; inp.click(); }} style={{ width: 68, height: 85, borderRadius: 8, border: `1.5px dashed ${rc.border}`, background: "rgba(255,255,255,0.02)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#555", fontSize: 10, fontFamily: "inherit", gap: 3 }}>
                                      <span style={{ fontSize: 18 }}>+</span><span>Photo</span>
                                    </button>
                                  </div>
                                </div>
                                {/* Sex/Age/Type/Style/Remu/Ethnie moved to sub-comedian slots */}
                                {/* Notes */}
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                  <div style={{ marginBottom: 12 }}><label style={{ display: "block", fontSize: 10, color: "#888", marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>Notes</label><textarea value={rd.notes || ""} onChange={e => uRoleDetail(role, "notes", e.target.value)} placeholder="Description..." rows={3} style={{ ...sInput, resize: "vertical" }} /></div>
                                  <div style={{ marginBottom: 12 }}><label style={{ display: "block", fontSize: 10, color: "#888", marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>Spécificités</label><textarea value={rd.specificities || ""} onChange={e => uRoleDetail(role, "specificities", e.target.value)} placeholder="Tatouages, compétences..." rows={3} style={{ ...sInput, resize: "vertical" }} /></div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Add role */}
                    {projetShowAddRole ? (
                      <div style={{ display: "flex", gap: 8, marginTop: 12, marginBottom: 18 }}>
                        <input value={projetNewRole} onChange={e => setProjetNewRole(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && projetNewRole.trim()) { const n = projetNewRole.trim(); if (!state.roles.includes(n)) { setState(p => ({ ...p, roles: [...p.roles, n], profiles: { ...p.profiles, [n]: [] } })); setProjetExpanded(p => ({ ...p, [n]: true })); } setProjetNewRole(""); setProjetShowAddRole(false); } if (e.key === "Escape") { setProjetShowAddRole(false); setProjetNewRole(""); } }} autoFocus placeholder="Nom du rôle..." style={{ flex: 1, padding: "12px 16px", background: "#111114", border: "1px solid #e879f944", borderRadius: 10, color: "#e0e0e0", fontSize: 14, fontFamily: "'DM Sans',sans-serif", outline: "none" }} />
                        <button onClick={() => { const n = projetNewRole.trim(); if (n && !state.roles.includes(n)) { setState(p => ({ ...p, roles: [...p.roles, n], profiles: { ...p.profiles, [n]: [] } })); setProjetExpanded(p => ({ ...p, [n]: true })); } setProjetNewRole(""); setProjetShowAddRole(false); }} style={{ padding: "12px 20px", background: "rgba(232,121,249,0.12)", border: "1px solid rgba(232,121,249,0.3)", borderRadius: 10, color: "#e879f9", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✓</button>
                        <button onClick={() => { setProjetShowAddRole(false); setProjetNewRole(""); }} style={{ padding: "12px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid #2a2a2e", borderRadius: 10, color: "#666", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>×</button>
                      </div>
                    ) : state.roles.length > 0 && (
                      <button onClick={() => setProjetShowAddRole(true)} style={{ marginTop: 12, marginBottom: 18, padding: "10px 20px", background: "transparent", border: "1px dashed #333", borderRadius: 10, color: "#555", fontSize: 12, cursor: "pointer", fontFamily: "inherit", width: "100%" }}>+ Ajouter un rôle</button>
                    )}

                    {(state.projectName || state.roles.length > 0) && (
                      <button onClick={() => { setProjetValidated(true); setProjetEditMode(false); }} style={{ width: "100%", padding: "16px", marginTop: 8, background: "linear-gradient(135deg,#c9a44a,#a67c2e)", border: "none", borderRadius: 14, cursor: "pointer", fontSize: 15, fontWeight: 700, fontFamily: "inherit", color: "#000", boxShadow: "0 4px 24px rgba(201,164,74,0.3)" }}>✓ Valider la fiche projet</button>
                    )}
                  </div>
                )}
                </div>
              )}

              {/* -- DOCUMENTS -- */}
              {projetSection === "documents" && (
                <div style={{ maxWidth: 720 }}>
                  <h2 style={{ fontSize: 22, fontWeight: 700, color: "#f0f0f0", marginBottom: 6 }}>Documents</h2>
                  <p style={{ fontSize: 12, color: "#555", marginBottom: 24 }}>Dossier artistique, moodboard, scénario, casting sheets.</p>
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: 11, color: "#c9a44a", fontWeight: 600, textTransform: "uppercase", marginBottom: 12 }}>📎 Documents</div>
                    <label style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "24px", borderRadius: 14, border: "2px dashed #2a2a2e", cursor: "pointer", marginBottom: 12 }}>
                      <span style={{ fontSize: 22, marginBottom: 4 }}>📎</span><span style={{ fontSize: 12, color: "#888" }}>Cliquer pour ajouter</span>
                      <input type="file" accept="image/*,.pdf" multiple hidden onChange={e => { Array.from(e.target.files || []).forEach(f => { const r = new FileReader(); r.onload = () => uPI("documents", [...(pi.documents || []), { id: "d" + Date.now() + Math.random(), name: f.name, dataUrl: r.result, type: f.type }]); r.readAsDataURL(f); }); e.target.value = ""; }} />
                    </label>
                    {(pi.documents || []).map(d => <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: "#141416", borderRadius: 10, border: "1px solid #222226", marginBottom: 6 }}><span>{d.type && d.type.includes("pdf") ? "📕" : "🖼️"}</span><span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#e0e0e0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span><button onClick={() => uPI("documents", (pi.documents || []).filter(x => x.id !== d.id))} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 16 }}>×</button></div>)}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#60a5fa", fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>📋 Casting Sheets</div>
                    <label style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "24px", borderRadius: 14, border: "2px dashed #2a2a2e", cursor: "pointer", marginBottom: 12 }}>
                      <span style={{ fontSize: 18, marginBottom: 4 }}>📋</span><span style={{ fontSize: 12, color: "#888" }}>Importer</span>
                      <input type="file" accept=".pdf,image/*" multiple hidden onChange={e => { Array.from(e.target.files || []).forEach(f => { const r = new FileReader(); r.onload = () => uPI("castingSheets", [...(pi.castingSheets || []), { id: "cs" + Date.now(), name: f.name, dataUrl: r.result }]); r.readAsDataURL(f); }); e.target.value = ""; }} />
                    </label>
                    {(pi.castingSheets || []).map(c => <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: "#141416", borderRadius: 10, border: "1px solid #222226", marginBottom: 6 }}><span>📋</span><span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#e0e0e0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span><button onClick={() => uPI("castingSheets", (pi.castingSheets || []).filter(x => x.id !== c.id))} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 16 }}>×</button></div>)}
                  </div>
                </div>
              )}

              {/* -- DEVIS -- */}
              {projetSection === "devis" && (
                <div style={{ maxWidth: 860 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: "#f0f0f0" }}>Générateur de devis</h2>
                    <button onClick={() => window.print()} style={{ padding: "8px 18px", background: "linear-gradient(135deg,#c9a44a,#a67c2e)", border: "none", borderRadius: 8, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>📄 Exporter PDF</button>
                  </div>
                  <p style={{ fontSize: 12, color: "#555", marginBottom: 20 }}>Devis / bon de commande.</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
                    <div style={{ background: "#141416", borderRadius: 14, border: "1px solid #222226", padding: "18px 22px" }}>
                      <div style={{ fontSize: 11, color: "#c9a44a", fontWeight: 600, textTransform: "uppercase", marginBottom: 12 }}>Émetteur</div>
                      {[{ l: "Nom", k: "emitterName", ph: "Joana Fontaine" }, { l: "Statut", k: "emitterStatus", ph: "Directrice de Casting" }, { l: "SIRET", k: "emitterSiret", ph: "000 000 000 00000" }, { l: "Adresse", k: "emitterAddress", ph: "Adresse" }].map(f => <div key={f.k} style={{ marginBottom: 12 }}><label style={{ display: "block", fontSize: 10, color: "#888", marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>{f.l}</label><input value={pi.devis?.fields?.[f.k] || ""} onChange={e => uDevisField(f.k, e.target.value)} placeholder={f.ph} style={{ width: "100%", padding: "10px 14px", background: "#111114", border: "1px solid #2a2a2e", borderRadius: 10, color: "#e0e0e0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" }} /></div>)}
                    </div>
                    <div style={{ background: "#141416", borderRadius: 14, border: "1px solid #222226", padding: "18px 22px" }}>
                      <div style={{ fontSize: 11, color: "#e879f9", fontWeight: 600, textTransform: "uppercase", marginBottom: 12 }}>Client</div>
                      {[{ l: "Société", k: "clientName", ph: pi.production || "Production" }, { l: "SIRET", k: "clientSiret", ph: "000 000 000 00000" }, { l: "Adresse", k: "clientAddress", ph: "Adresse" }, { l: "Contact", k: "clientContact", ph: "Nom" }].map(f => <div key={f.k} style={{ marginBottom: 12 }}><label style={{ display: "block", fontSize: 10, color: "#888", marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>{f.l}</label><input value={pi.devis?.fields?.[f.k] || ""} onChange={e => uDevisField(f.k, e.target.value)} placeholder={f.ph} style={{ width: "100%", padding: "10px 14px", background: "#111114", border: "1px solid #2a2a2e", borderRadius: 10, color: "#e0e0e0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" }} /></div>)}
                    </div>
                  </div>
                  <div style={{ background: "#141416", borderRadius: 14, border: "1px solid #222226", padding: "18px 22px", marginBottom: 18 }}>
                    <div style={{ fontSize: 11, color: "#60a5fa", fontWeight: 600, textTransform: "uppercase", marginBottom: 12 }}>Infos devis</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0 12px" }}>
                      {[{ l: "N° devis", k: "devisNumber", ph: "DC-2026-001" }, { l: "Date", k: "devisDate", ph: new Date().toLocaleDateString("fr-FR") }, { l: "Validité", k: "validityDays", ph: "30 jours" }, { l: "Projet", k: "projectTitle", ph: state.projectName || "Titre" }].map(f => <div key={f.k} style={{ marginBottom: 12 }}><label style={{ display: "block", fontSize: 10, color: "#888", marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>{f.l}</label><input value={pi.devis?.fields?.[f.k] || ""} onChange={e => uDevisField(f.k, e.target.value)} placeholder={f.ph} style={{ width: "100%", padding: "10px 14px", background: "#111114", border: "1px solid #2a2a2e", borderRadius: 10, color: "#e0e0e0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" }} /></div>)}
                    </div>
                  </div>
                  <div style={{ background: "#141416", borderRadius: 14, border: "1px solid #222226", padding: "18px 22px", marginBottom: 18 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: "#22c55e", fontWeight: 600, textTransform: "uppercase" }}>Lignes de prestation</div>
                      <button onClick={addDevisLine} style={{ padding: "6px 14px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8, color: "#22c55e", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>+ Ligne</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 60px 80px 90px 60px 40px", gap: 8, marginBottom: 8 }}>
                      {["Description", "Qté", "Unité", "Prix €", "TVA %", ""].map(h => <div key={h} style={{ fontSize: 9, color: "#555", fontWeight: 700, textTransform: "uppercase" }}>{h}</div>)}
                    </div>
                    {devisLines.length === 0 && <div style={{ textAlign: "center", padding: 18, color: "#444", fontSize: 12 }}>Cliquez "+ Ligne"</div>}
                    {devisLines.map(l => (
                      <div key={l.id} style={{ display: "grid", gridTemplateColumns: "2fr 60px 80px 90px 60px 40px", gap: 8, marginBottom: 6, alignItems: "center" }}>
                        <input value={l.description} onChange={e => updateDevisLine(l.id, "description", e.target.value)} placeholder="Direction casting" style={{ padding: "8px 10px", background: "#0c0c0e", border: "1px solid #2a2a2e", borderRadius: 6, color: "#e0e0e0", fontSize: 12, fontFamily: "'DM Sans',sans-serif", outline: "none" }} />
                        <input value={l.qty} onChange={e => updateDevisLine(l.id, "qty", e.target.value)} style={{ padding: "8px 6px", background: "#0c0c0e", border: "1px solid #2a2a2e", borderRadius: 6, color: "#e0e0e0", fontSize: 12, fontFamily: "'DM Sans',sans-serif", outline: "none", textAlign: "center" }} />
                        <select value={l.unit} onChange={e => updateDevisLine(l.id, "unit", e.target.value)} style={{ padding: "8px 6px", background: "#0c0c0e", border: "1px solid #2a2a2e", borderRadius: 6, color: "#e0e0e0", fontSize: 11, fontFamily: "'DM Sans',sans-serif", outline: "none", cursor: "pointer" }}><option value="forfait">Forfait</option><option value="jour">Jour</option><option value="heure">Heure</option><option value="unite">Unité</option></select>
                        <input value={l.unitPrice} onChange={e => updateDevisLine(l.id, "unitPrice", e.target.value)} placeholder="0.00" style={{ padding: "8px 6px", background: "#0c0c0e", border: "1px solid #2a2a2e", borderRadius: 6, color: "#e0e0e0", fontSize: 12, fontFamily: "'DM Sans',sans-serif", outline: "none", textAlign: "right" }} />
                        <input value={l.tva} onChange={e => updateDevisLine(l.id, "tva", e.target.value)} style={{ padding: "8px 6px", background: "#0c0c0e", border: "1px solid #2a2a2e", borderRadius: 6, color: "#e0e0e0", fontSize: 12, fontFamily: "'DM Sans',sans-serif", outline: "none", textAlign: "center" }} />
                        <button onClick={() => removeDevisLine(l.id)} style={{ background: "none", border: "none", color: "#44444488", cursor: "pointer", fontSize: 14 }}>🗑</button>
                      </div>
                    ))}
                    {devisLines.length > 0 && (
                      <div style={{ borderTop: "1px solid #2a2a2e", marginTop: 12, paddingTop: 12, display: "flex", justifyContent: "flex-end" }}>
                        <div style={{ textAlign: "right", fontSize: 13 }}>
                          <div style={{ color: "#888", marginBottom: 4 }}>Total HT: <span style={{ color: "#e0e0e0", fontWeight: 700 }}>{devisTotalHT.toFixed(2)} €</span></div>
                          <div style={{ color: "#888", marginBottom: 4 }}>TVA: <span style={{ color: "#e0e0e0" }}>{devisTotalTVA.toFixed(2)} €</span></div>
                          <div style={{ color: "#c9a44a", fontWeight: 700, fontSize: 15 }}>Total TTC: {(devisTotalHT + devisTotalTVA).toFixed(2)} €</div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ background: "#141416", borderRadius: 14, border: "1px solid #222226", padding: "18px 22px" }}>
                    {[{ l: "Conditions", k: "conditions", ph: "Paiement à 30 jours..." }, { l: "Notes", k: "notes", ph: "Infos complémentaires..." }].map(f => <div key={f.k} style={{ marginBottom: 12 }}><label style={{ display: "block", fontSize: 10, color: "#888", marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>{f.l}</label><textarea value={pi.devis?.fields?.[f.k] || ""} onChange={e => uDevisField(f.k, e.target.value)} placeholder={f.ph} rows={3} style={{ width: "100%", padding: "10px 14px", background: "#111114", border: "1px solid #2a2a2e", borderRadius: 10, color: "#e0e0e0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none", resize: "vertical", boxSizing: "border-box" }} /></div>)}
                  </div>
                </div>
              )}

              {/* -- FICHE SYNTHÉTIQUE -- */}
              {projetSection === "summary" && (
                <div style={{ maxWidth: 800 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: "#f0f0f0" }}>Fiche synthétique</h2>
                    <button onClick={() => window.print()} style={{ padding: "8px 18px", background: "linear-gradient(135deg,#c9a44a,#a67c2e)", border: "none", borderRadius: 8, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>📄 Exporter PDF</button>
                  </div>
                  {!state.projectName && !pi.production && state.roles.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 60, color: "#444" }}><div style={{ fontSize: 36, marginBottom: 14 }}>📋</div><div>Remplissez d'abord les infos.</div></div>
                  ) : (
                    <>
                      <div style={{ background: "#141416", borderRadius: 16, border: "1px solid #222226", padding: "28px 32px", marginBottom: 20 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
                          <div>
                            <div style={{ fontSize: 10, color: "#e879f9", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 8 }}>Fiche projet</div>
                            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#f0f0f0", margin: 0 }}>{state.projectName || "Sans titre"}</h1>
                          </div>
                          <div style={{ textAlign: "right", fontSize: 11, color: "#555", lineHeight: 1.8 }}>
                            <div style={{ color: "#c9a44a", fontWeight: 700, fontSize: 12 }}>Joana Fontaine</div>
                            <div>Casting Director</div>
                            <div style={{ color: "#333", marginTop: 4 }}>{new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</div>
                          </div>
                        </div>
                        <div style={{ height: 1, background: "#222226", marginBottom: 18 }} />
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 36px" }}>
                          {[{ l: "Production", v: pi.production, i: "🏢" }, { l: "Réalisateur·rice", v: pi.director, i: "🎬" }, { l: "Photographe", v: pi.photographer, i: "📸" }, { l: "Jours de tournage", v: pi.shootingDays ? pi.shootingDays + " jours" : null, i: "📅" }, { l: "Rémunération", v: pi.salary?.amount ? pi.salary.amount + " €" : null, i: "💰" }, { l: "Rôles", v: state.roles.length + "", i: "🎭" }, { l: "Comédiens total", v: totalComediens > 0 ? totalComediens + "" : null, i: "👥" }].filter(x => x.v).map(x => (
                            <div key={x.l} style={{ display: "flex", gap: 10 }}><span style={{ fontSize: 14 }}>{x.i}</span><div><div style={{ fontSize: 10, color: "#555", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>{x.l}</div><div style={{ fontSize: 14, color: "#e0e0e0", fontWeight: 500 }}>{x.v}</div></div></div>
                          ))}
                        </div>
                        {projetDateChips.length > 0 && (
                          <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid #1e1e22" }}>
                            <div style={{ fontSize: 10, color: "#60a5fa", fontWeight: 600, textTransform: "uppercase", marginBottom: 10 }}>📅 Planning</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{projetDateChips.map((x, i) => <div key={i} style={{ padding: "7px 12px", background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)", borderRadius: 8, fontSize: 11 }}>{x.icon} <span style={{ color: "#888", fontWeight: 600 }}>{x.label}:</span> <span style={{ color: "#e0e0e0" }}>{x.value}</span></div>)}</div>
                          </div>
                        )}
                      </div>
                      {state.roles.length > 0 && <div style={{ fontSize: 11, color: "#e879f9", fontWeight: 600, textTransform: "uppercase", marginBottom: 12 }}>Détail des rôles</div>}
                      {state.roles.map((role, ri) => {
                        const rd = state.roleDetails?.[role] || {};
                        const rc = ROLE_COLORS[ri % ROLE_COLORS.length];
                        const tD = rd.profileType === "Autres" ? (rd.profileTypeCustom || "Autres") : rd.profileType;
                        const sD = rd.actingStyle === "Autres" ? (rd.actingStyleCustom || "Autres") : rd.actingStyle;
                        return (
                          <div key={role} style={{ background: "#141416", borderRadius: 16, border: `1px solid ${rc.border}`, marginBottom: 14, overflow: "hidden" }}>
                            <div style={{ padding: "14px 24px", background: rc.bg, display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${rc.border}` }}>
                              <div style={{ width: 10, height: 10, borderRadius: "50%", background: rc.color }} />
                              <span style={{ fontSize: 16, fontWeight: 700, color: rc.color, flex: 1 }}>{role}</span>
                              {rd.nbComediens && <span style={{ fontSize: 11, padding: "3px 10px", background: `${rc.color}15`, borderRadius: 8, color: rc.color, fontWeight: 600 }}>{rd.nbComediens} comédien{parseInt(rd.nbComediens) > 1 ? "s" : ""}</span>}
                              {rd.nbJoursTournage && <span style={{ fontSize: 11, padding: "3px 10px", background: "rgba(201,164,74,0.08)", borderRadius: 8, color: "#c9a44a", fontWeight: 600 }}>{rd.nbJoursTournage}j / comédien</span>}
                            </div>
                            <div style={{ padding: "18px 24px" }}>
                              {(rd.referencePhotos || []).length > 0 && <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>{rd.referencePhotos.map((p, i) => <div key={i} style={{ width: 52, height: 65, borderRadius: 8, overflow: "hidden", border: `1px solid ${rc.border}` }}><img src={p} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>)}</div>}
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px 20px", marginBottom: 10 }}>
                                {rd.sex && <div><div style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Sexe</div><div style={{ fontSize: 13, color: "#e0e0e0" }}>{rd.sex}</div></div>}
                                {rd.ageStyle && <div><div style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Âge</div><div style={{ fontSize: 13, color: "#e0e0e0" }}>{rd.ageStyle}</div></div>}
                                {(rd.ageMin || rd.ageMax) && <div><div style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Tranche</div><div style={{ fontSize: 13, color: "#e0e0e0" }}>{rd.ageMin || "?"} — {rd.ageMax || "?"} ans</div></div>}
                                {tD && <div><div style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Type</div><div style={{ fontSize: 13, color: "#e0e0e0" }}>{tD}</div></div>}
                                {sD && <div><div style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Style de jeu</div><div style={{ fontSize: 13, color: "#e0e0e0" }}>{sD}</div></div>}
                                {rd.cachet && <div><div style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Rému</div><div style={{ fontSize: 14, color: (rd.cachetType === "ht" || rd.cachetType === "facture") ? "#e879f9" : "#c9a44a", fontWeight: 700 }}>{rd.cachet} € {(rd.cachetType === "ht" || rd.cachetType === "facture") ? "HT" : "BRUT"}</div></div>}
                                {rd.droits && <div><div style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Droits</div><div style={{ fontSize: 14, color: "#f59e0b", fontWeight: 700 }}>{rd.droits} €</div></div>}
                                {rd.nbComediens && <div><div style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Nb comédiens</div><div style={{ fontSize: 13, color: "#e0e0e0" }}>{rd.nbComediens}</div></div>}
                                {rd.nbJoursTournage && <div><div style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Jours / comédien</div><div style={{ fontSize: 13, color: "#e0e0e0" }}>{rd.nbJoursTournage}j</div></div>}
                              </div>
                              {(rd.ethnicities || []).length > 0 && <div style={{ marginBottom: 10 }}><div style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>Ethnie</div><div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{rd.ethnicities.map(e => <span key={e} style={{ fontSize: 11, padding: "3px 12px", background: `${rc.color}15`, borderRadius: 12, color: rc.color }}>{e}</span>)}</div></div>}
                              {rd.notes && <div style={{ marginBottom: 6, padding: "10px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 8, borderLeft: `3px solid ${rc.color}44` }}><div style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Notes</div><div style={{ fontSize: 13, color: "#aaa", lineHeight: 1.5 }}>{rd.notes}</div></div>}
                              {rd.specificities && <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 8, borderLeft: "3px solid #f59e0b44" }}><div style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Spécificités</div><div style={{ fontSize: 13, color: "#aaa", lineHeight: 1.5 }}>{rd.specificities}</div></div>}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}

              </div>
            ) :

            /* ===== CONTACTS VIEW ===== */
            activeTab === "contacts" ? (
              <div>
                {(() => {
                  const isFinal = contactSubTab === "final";
                  const contactStore = isFinal ? state.finalContacts : state.contacts;
                  const onUpdate = isFinal ? updateFinalContact : updateContact;

                  // Determine roles
                  let rolesWithContacts;
                  if (isFinal) {
                    rolesWithContacts = state.roles.filter(role =>
                      (state.profiles[role] || []).some(p => state.finalSelections[p.id]?.selected != null)
                    );
                  } else {
                    rolesWithContacts = state.roles.filter(role =>
                      (state.profiles[role] || []).some(p => getChoice(p.id))
                    );
                  }
                  const currentRole = contactActiveRole && rolesWithContacts.includes(contactActiveRole)
                    ? contactActiveRole : rolesWithContacts[0] || null;

                  if (!currentRole) {
                    return (
                      <div style={{
                        display: "flex", flexDirection: "column", alignItems: "center",
                        justifyContent: "center", minHeight: 400, color: "#444",
                      }}>
                        <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>{isFinal ? "🏆" : "✉"}</div>
                        <div style={{ fontSize: 14 }}>
                          {isFinal ? "Aucune décision de casting définitif" : "Aucun profil évalué"}
                        </div>
                        <div style={{ fontSize: 12, color: "#555", marginTop: 6 }}>
                          {isFinal ? "Faites vos choix dans l'onglet Casting" : "Évaluez des profils dans l'onglet Casting"}
                        </div>
                      </div>
                    );
                  }

                  // Build profile lists
                  const roleProfiles = (state.profiles[currentRole] || []).map(p => ({
                    ...p, _role: currentRole, _selection: { ...(state.selections[p.id] || {}), choice: getChoice(p.id) },
                  }));

                  let selected, notSelected, allEval;
                  if (isFinal) {
                    selected = roleProfiles.filter(p => state.finalSelections[p.id]?.selected === true);
                    notSelected = roleProfiles.filter(p => state.finalSelections[p.id]?.selected === false);
                    allEval = [...selected, ...notSelected];
                  } else {
                    selected = roleProfiles.filter(p => p._selection?.choice === "yes" || p._selection?.choice === "maybe");
                    notSelected = roleProfiles.filter(p => p._selection?.choice === "no");
                    allEval = [...selected, ...notSelected];
                  }

                  const stats = {
                    not_contacted: allEval.filter(p => !contactStore[p.id]?.status || contactStore[p.id]?.status === "not_contacted").length,
                    contacted: allEval.filter(p => contactStore[p.id]?.status === "contacted").length,
                    waiting: allEval.filter(p => contactStore[p.id]?.status === "waiting").length,
                    confirmed: allEval.filter(p => contactStore[p.id]?.status === "confirmed").length,
                  };

                  const renderContactRow = (p, i, total) => {
                    const ct = contactStore[p.id] || {};
                    const sel = { ...(state.selections[p.id] || {}), choice: getChoice(p.id) };
                    const finalSel = state.finalSelections[p.id];
                    const ctStatus = CONTACT_STATUS[ct.status || "not_contacted"];
                    const ctMethod = ct.method ? CONTACT_METHODS[ct.method] : null;
                    const fullName = [p.firstName, p.name].filter(Boolean).join(" ") || "Sans nom";
                    return (
                      <div
                        key={p.id}
                        style={{
                          padding: "16px 20px", display: "flex", alignItems: "center", gap: 16,
                          borderBottom: i < total - 1 ? "1px solid #1a1a1e" : "none",
                          transition: "background 0.15s", cursor: "pointer",
                          animation: `fadeIn 0.3s ease ${i * 0.03}s both`,
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        onClick={() => { setContactingProfile({ ...p, _contactMode: isFinal ? "final" : "premier" }); setContactModalOpen(true); }}
                      >
                        {/* Photo */}
                        <div style={{ width: 44, height: 54, borderRadius: 8, overflow: "hidden", background: "#0c0c0e", flexShrink: 0 }}>
                          {p.photos?.[0] ? (
                            <img src={p.photos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: 16 }}>◎</div>
                          )}
                        </div>

                        {/* Name & agency */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f0f0", marginBottom: 2 }}>{fullName}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            {p.agency && <span style={{ fontSize: 10, color: "#8a7740" }}>🏢 {p.agency}</span>}
                            {(p.email || p.agencyEmail) && <span style={{ fontSize: 10, color: "#555" }}>✉ {p.email || p.agencyEmail}</span>}
                          </div>
                        </div>

                        {/* Selection badge */}
                        <div style={{ flexShrink: 0 }}>
                          {isFinal ? (
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 12px",
                              background: finalSel?.selected ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                              color: finalSel?.selected ? "#22c55e" : "#ef4444",
                              border: `1px solid ${finalSel?.selected ? "#22c55e" : "#ef4444"}33`,
                              borderRadius: 8, fontSize: 11, fontWeight: 600,
                            }}>
                              {finalSel?.selected ? "🏆 Retenu" : "✕ Non retenu"}
                            </span>
                          ) : sel?.choice && (
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 12px",
                              background: SELECTION[sel.choice].bg, color: SELECTION[sel.choice].color,
                              border: `1px solid ${SELECTION[sel.choice].color}33`,
                              borderRadius: 8, fontSize: 11, fontWeight: 600,
                            }}>
                              {SELECTION[sel.choice].icon} {SELECTION[sel.choice].label}
                            </span>
                          )}
                        </div>

                        {/* Method */}
                        <div style={{ flexShrink: 0, minWidth: 75, textAlign: "center" }}>
                          {ctMethod ? (
                            <span style={{ fontSize: 11, color: "#999" }}>{ctMethod.icon} {ctMethod.label}</span>
                          ) : (
                            <span style={{ fontSize: 11, color: "#333" }}>—</span>
                          )}
                        </div>

                        {/* Status */}
                        <div style={{ flexShrink: 0 }}>
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 12px",
                            background: ctStatus.bg, color: ctStatus.color,
                            border: `1px solid ${ctStatus.color}33`,
                            borderRadius: 8, fontSize: 11, fontWeight: 600,
                          }}>
                            {ctStatus.icon} {ctStatus.label}
                          </span>
                        </div>

                        {/* Action arrow */}
                        <div style={{ flexShrink: 0, fontSize: 14, color: "#333" }}>→</div>
                      </div>
                    );
                  };

                  const renderTable = (profiles) => (
                    <div style={{
                      background: "#111114", borderRadius: 14, border: "1px solid #1e1e22",
                      overflow: "hidden",
                    }}>
                      {/* Header */}
                      <div style={{
                        display: "flex", alignItems: "center", gap: 16,
                        padding: "10px 20px", borderBottom: "1px solid #1e1e22",
                        fontSize: 9, color: "#555", fontWeight: 600, letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}>
                        <span style={{ width: 44 }}></span>
                        <span style={{ flex: 1 }}>Profil</span>
                        <span style={{ flexShrink: 0 }}>{isFinal ? "Décision" : "Sélection"}</span>
                        <span style={{ minWidth: 75, textAlign: "center" }}>Méthode</span>
                        <span style={{ flexShrink: 0 }}>Statut</span>
                        <span style={{ width: 14 }}></span>
                      </div>
                      {profiles.map((p, i) => renderContactRow(p, i, profiles.length))}
                    </div>
                  );

                  const accentColor = isFinal ? "#22c55e" : "#60a5fa";
                  const selLabel = isFinal ? "🏆 Profils retenus" : "✓ Profils sélectionnés";
                  const notSelLabel = isFinal ? "✕ Profils non retenus" : "✕ Profils non sélectionnés";
                  const selEmptyMsg = isFinal ? "Aucun profil retenu pour ce rôle" : "Aucun profil sélectionné pour ce rôle";
                  const notSelEmptyMsg = isFinal ? "Aucun profil refusé pour ce rôle" : "Aucun profil refusé pour ce rôle";

                  return (
                    <>
                      {/* Header */}
                      <div style={{ marginBottom: 24 }}>
                        <h2 style={{
                          fontSize: 22, fontWeight: 700, color: "#f0f0f0", letterSpacing: "-0.01em",
                          fontFamily: "'Playfair Display', serif", marginBottom: 4,
                        }}>
                          {isFinal && "🏆 "}{currentRole}
                        </h2>
                        <p style={{ fontSize: 13, color: "#666", margin: 0 }}>
                          {isFinal ? "Contact casting définitif" : "Suivi des contacts"} · {allEval.length} profil{allEval.length !== 1 ? "s" : ""}
                        </p>
                      </div>

                      {/* Stats bar */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
                        {Object.entries(CONTACT_STATUS).map(([key, s]) => (
                          <div key={key} style={{
                            padding: "16px 20px", background: "#111114",
                            borderRadius: 14, border: `1px solid ${stats[key] > 0 ? s.color + "33" : "#1e1e22"}`,
                            display: "flex", alignItems: "center", gap: 14,
                          }}>
                            <div style={{
                              width: 44, height: 44, borderRadius: 12,
                              background: `${s.color}14`, display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 18,
                            }}>
                              {s.icon}
                            </div>
                            <div>
                              <div style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>{stats[key]}</div>
                              <div style={{ fontSize: 10, color: "#888", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase", marginTop: 2 }}>
                                {s.label}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* ---- Sélectionnés ---- */}
                      <div style={{ marginBottom: 24 }}>
                        <button
                          onClick={() => setContactSectionOpen(prev => ({ ...prev, selected: !prev.selected }))}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            width: "100%", padding: "14px 20px", marginBottom: contactSectionOpen.selected ? 12 : 0,
                            background: "#111114", border: "1px solid #1e1e22", borderRadius: 12,
                            cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{
                              fontSize: 16, transition: "transform 0.2s",
                              transform: contactSectionOpen.selected ? "rotate(90deg)" : "rotate(0deg)",
                              display: "inline-block",
                            }}>▶</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: "#22c55e" }}>
                              {selLabel}
                            </span>
                            <span style={{
                              fontSize: 11, color: "#22c55e", background: "rgba(34,197,94,0.1)",
                              padding: "2px 10px", borderRadius: 10, fontWeight: 600,
                            }}>{selected.length}</span>
                          </div>
                          <div style={{ display: "flex", gap: 8, fontSize: 10, color: "#666" }}>
                            <span>{selected.filter(p => contactStore[p.id]?.status === "confirmed").length} confirmé{selected.filter(p => contactStore[p.id]?.status === "confirmed").length !== 1 ? "s" : ""}</span>
                            <span>·</span>
                            <span>{selected.filter(p => !contactStore[p.id]?.status || contactStore[p.id]?.status === "not_contacted").length} à contacter</span>
                          </div>
                        </button>
                        {contactSectionOpen.selected && (
                          selected.length > 0 ? renderTable(selected) : (
                            <div style={{ padding: "20px", textAlign: "center", color: "#555", fontSize: 12, background: "#111114", borderRadius: 12, border: "1px solid #1e1e22" }}>
                              {selEmptyMsg}
                            </div>
                          )
                        )}
                      </div>

                      {/* ---- Non sélectionnés ---- */}
                      <div style={{ marginBottom: 24 }}>
                        <button
                          onClick={() => setContactSectionOpen(prev => ({ ...prev, notSelected: !prev.notSelected }))}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            width: "100%", padding: "14px 20px", marginBottom: contactSectionOpen.notSelected ? 12 : 0,
                            background: "#111114", border: "1px solid #1e1e22", borderRadius: 12,
                            cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{
                              fontSize: 16, transition: "transform 0.2s",
                              transform: contactSectionOpen.notSelected ? "rotate(90deg)" : "rotate(0deg)",
                              display: "inline-block",
                            }}>▶</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: "#ef4444" }}>
                              {notSelLabel}
                            </span>
                            <span style={{
                              fontSize: 11, color: "#ef4444", background: "rgba(239,68,68,0.1)",
                              padding: "2px 10px", borderRadius: 10, fontWeight: 600,
                            }}>{notSelected.length}</span>
                          </div>
                          <div style={{ display: "flex", gap: 8, fontSize: 10, color: "#666" }}>
                            <span>{notSelected.filter(p => contactStore[p.id]?.status && contactStore[p.id]?.status !== "not_contacted").length} contacté{notSelected.filter(p => contactStore[p.id]?.status && contactStore[p.id]?.status !== "not_contacted").length !== 1 ? "s" : ""}</span>
                            <span>·</span>
                            <span>{notSelected.filter(p => !contactStore[p.id]?.status || contactStore[p.id]?.status === "not_contacted").length} à prévenir</span>
                          </div>
                        </button>
                        {contactSectionOpen.notSelected && (
                          notSelected.length > 0 ? renderTable(notSelected) : (
                            <div style={{ padding: "20px", textAlign: "center", color: "#555", fontSize: 12, background: "#111114", borderRadius: 12, border: "1px solid #1e1e22" }}>
                              {notSelEmptyMsg}
                            </div>
                          )
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>

            ) : activeTab === "planning" ? (
            /* ===== PLANNING VIEW ===== */
            <div>
              {(() => {
                const day = state.castingDays.find(d => d.id === activeCastingDay);

                if (!day) {
                  return (
                    <div style={{
                      display: "flex", flexDirection: "column", alignItems: "center",
                      justifyContent: "center", minHeight: 400, color: "#444",
                    }}>
                      <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>📋</div>
                      <div style={{ fontSize: 14, marginBottom: 8 }}>
                        {state.castingDays.length === 0 ? "Aucune journée de casting créée" : "Sélectionnez une journée à gauche"}
                      </div>
                      {state.castingDays.length === 0 && (
                        <button
                          onClick={() => setShowAddDay(true)}
                          style={{
                            padding: "10px 24px", background: "rgba(168,85,247,0.1)",
                            color: "#a855f7", border: "1px solid rgba(168,85,247,0.3)",
                            borderRadius: 10, cursor: "pointer", fontSize: 13,
                            fontWeight: 600, fontFamily: "inherit", marginTop: 8,
                          }}
                        >
                          + Créer une journée
                        </button>
                      )}
                    </div>
                  );
                }

                // Get all selected profiles (yes/maybe) for the add dropdown
                const availableProfiles = [];
                state.roles.forEach(role => {
                  (state.profiles[role] || []).forEach(p => {
                    const sel = getChoice(p.id);
                    if (sel === "yes" || sel === "maybe") {
                      const alreadyInDay = day.slots.some(s => s.profileId === p.id);
                      availableProfiles.push({ ...p, _role: role, _alreadyInDay: alreadyInDay });
                    }
                  });
                });

                return (
                  <>
                    {/* Day header */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
                      <div>
                        <h2 style={{
                          fontSize: 22, fontWeight: 700, color: "#f0f0f0", letterSpacing: "-0.01em",
                          fontFamily: "'Playfair Display', serif", marginBottom: 4,
                        }}>
                          {day.date ? new Date(day.date + "T00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : "Date à définir"}
                        </h2>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "#666" }}>
                          {day.location && <span>📍 {day.location}</span>}
                          <span>{day.slots.length} passage{day.slots.length !== 1 ? "s" : ""}</span>
                          {day.slots.length > 0 && (
                            <span>· {day.slots[0]?.time} → {(() => {
                              const last = day.slots[day.slots.length - 1];
                              if (!last?.time) return "";
                              const [h, m] = last.time.split(":").map(Number);
                              const end = h * 60 + m + (parseInt(last.duration) || 15);
                              return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
                            })()}</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          onClick={() => recalcTimes(day.id)}
                          title="Recalculer les horaires"
                          style={{
                            padding: "8px 14px", background: "rgba(168,85,247,0.08)",
                            border: "1px solid rgba(168,85,247,0.2)", borderRadius: 8,
                            color: "#a855f7", cursor: "pointer", fontSize: 11,
                            fontWeight: 600, fontFamily: "inherit",
                          }}
                        >
                          ⟳ Recalculer
                        </button>
                        <button
                          onClick={() => { if (window.confirm("Supprimer cette journée ?")) deleteCastingDay(day.id); }}
                          style={{
                            padding: "8px 14px", background: "rgba(239,68,68,0.08)",
                            border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8,
                            color: "#ef4444", cursor: "pointer", fontSize: 11,
                            fontWeight: 600, fontFamily: "inherit",
                          }}
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>

                    {/* Status summary bar */}
                    {day.slots.length > 0 && (() => {
                      const counts = { pending: 0, invited: 0, dispo: 0, not_dispo: 0 };
                      day.slots.forEach(s => { counts[s.availability || "pending"]++; });
                      const withEmail = day.slots.filter(s => { const p = findProfile(s.profileId); return p?.email || p?.agencyEmail; }).length;
                      const uninvited = day.slots.filter(s => s.availability === "pending" || !s.availability).length;
                      return (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
                          {Object.entries(SLOT_AVAILABILITY).map(([key, s]) => (
                            <div key={key} style={{
                              padding: "10px 14px", background: counts[key] > 0 ? `${s.color}0a` : "#0c0c0e",
                              borderRadius: 10, border: `1px solid ${counts[key] > 0 ? s.color + "33" : "#1a1a1e"}`,
                              display: "flex", alignItems: "center", gap: 10,
                            }}>
                              <span style={{ fontSize: 16 }}>{s.icon}</span>
                              <div>
                                <div style={{ fontSize: 18, fontWeight: 800, color: counts[key] > 0 ? s.color : "#333", lineHeight: 1 }}>{counts[key]}</div>
                                <div style={{ fontSize: 9, color: "#777", fontWeight: 500 }}>{s.label}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Day settings */}
                    <div style={{
                      display: "flex", gap: 12, marginBottom: 24,
                    }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: "block", fontSize: 10, color: "#666", marginBottom: 4, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>Date</label>
                        <input
                          type="date"
                          value={day.date}
                          onChange={e => updateCastingDay(day.id, { date: e.target.value })}
                          style={{
                            width: "100%", padding: "8px 12px", background: "#111114", border: "1px solid #2a2a2e",
                            borderRadius: 8, color: "#e0e0e0", fontSize: 13, fontFamily: "inherit", outline: "none",
                          }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: "block", fontSize: 10, color: "#666", marginBottom: 4, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>Lieu</label>
                        <input
                          value={day.location}
                          onChange={e => updateCastingDay(day.id, { location: e.target.value })}
                          placeholder="Adresse du casting"
                          style={{
                            width: "100%", padding: "8px 12px", background: "#111114", border: "1px solid #2a2a2e",
                            borderRadius: 8, color: "#e0e0e0", fontSize: 13, fontFamily: "inherit", outline: "none",
                          }}
                        />
                      </div>
                      <div style={{ flex: 2 }}>
                        <label style={{ display: "block", fontSize: 10, color: "#666", marginBottom: 4, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>Notes de la journée</label>
                        <input
                          value={day.notes}
                          onChange={e => updateCastingDay(day.id, { notes: e.target.value })}
                          placeholder="Infos générales, consignes..."
                          style={{
                            width: "100%", padding: "8px 12px", background: "#111114", border: "1px solid #2a2a2e",
                            borderRadius: 8, color: "#e0e0e0", fontSize: 13, fontFamily: "inherit", outline: "none",
                          }}
                        />
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                      {/* Send all invites */}
                      {day.slots.length > 0 && (() => {
                        const uninvited = day.slots.filter(s => (s.availability === "pending" || !s.availability));
                        const withEmail = uninvited.filter(s => { const p = findProfile(s.profileId); return p?.email || p?.agencyEmail; });
                        return withEmail.length > 0 ? (
                          <button
                            onClick={() => { if (window.confirm(`Envoyer ${withEmail.length} convocation${withEmail.length > 1 ? "s" : ""} par Gmail ?`)) sendAllDayInvites(day); }}
                            style={{
                              padding: "10px 18px", background: "linear-gradient(135deg, rgba(234,67,53,0.12), rgba(234,67,53,0.06))",
                              border: "1px solid rgba(234,67,53,0.25)", borderRadius: 10,
                              color: "#EA4335", cursor: "pointer", fontSize: 12,
                              fontWeight: 700, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8,
                            }}
                          >
                            📨 Convoquer tous ({withEmail.length})
                          </button>
                        ) : null;
                      })()}
                      <button
                        onClick={() => {
                          const rows = day.slots.map(s => {
                            const p = findProfile(s.profileId);
                            const av = SLOT_AVAILABILITY[s.availability || "pending"];
                            return [s.time, s.duration + "min", [p?.firstName, p?.name].filter(Boolean).join(" ") || "", p?.age || "", p?.height || "", p?.measurements || "", s.role || p?._role || "", av.label, p?.agency || "", p?.email || "", p?.phone || "", p?.agencyEmail || "", s.actingNotes, s.actingFileName || ""];
                          });
                          const headers = ["Heure","Durée","Nom","Âge","Taille","Mensurations","Rôle","Disponibilité","Agence","Email acteur","Téléphone","Email agence","Notes jeu","Fichier texte"];
                          const csvContent = [headers, ...rows].map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(",")).join("\n");
                          const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
                          const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
                          a.download = `planning-${day.date || "casting"}.csv`; a.click();
                        }}
                        style={{
                          padding: "8px 16px", background: "rgba(34,197,94,0.08)",
                          border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8,
                          color: "#22c55e", cursor: "pointer", fontSize: 11,
                          fontWeight: 600, fontFamily: "inherit",
                        }}
                      >
                        📊 Exporter Excel/CSV
                      </button>
                      <button
                        onClick={() => setPrintView(true)}
                        style={{
                          padding: "8px 16px", background: "rgba(239,68,68,0.08)",
                          border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8,
                          color: "#ef4444", cursor: "pointer", fontSize: 11,
                          fontWeight: 600, fontFamily: "inherit",
                        }}
                      >
                        🖨️ Imprimer / PDF
                      </button>
                    </div>

                    {/* ===== PLANNING TABLE ===== */}
                    <div style={{ background: "#111114", borderRadius: 14, border: "1px solid #1e1e22", overflow: "hidden", marginBottom: 20 }}>
                      {/* Column headers */}
                      <div style={{
                        display: "grid", gridTemplateColumns: "28px 62px 44px 50px 1fr 90px 90px 70px 32px",
                        padding: "10px 16px", borderBottom: "2px solid #1e1e22", alignItems: "center", gap: 8,
                      }}>
                        <span style={{ fontSize: 8, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}></span>
                        <span style={{ fontSize: 8, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Heure</span>
                        <span style={{ fontSize: 8, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>Min</span>
                        <span style={{ fontSize: 8, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Photo</span>
                        <span style={{ fontSize: 8, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Acteur / Rôle</span>
                        <span style={{ fontSize: 8, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>Statut</span>
                        <span style={{ fontSize: 8, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>Prévenir</span>
                        <span style={{ fontSize: 8, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>Notes</span>
                        <span></span>
                      </div>

                      {/* Slot rows */}
                      {day.slots.map((slot, i) => {
                        const profile = findProfile(slot.profileId);
                        const avail = SLOT_AVAILABILITY[slot.availability || "pending"];
                        const rc = getRoleColor(slot.role || profile?._role || "");
                        const fullName = [profile?.firstName, profile?.name].filter(Boolean).join(" ") || "—";
                        const hasEmail = profile?.email || profile?.agencyEmail;
                        return (
                          <div
                            key={slot.id}
                            draggable
                            onDragStart={() => setDragSlot(i)}
                            onDragOver={e => e.preventDefault()}
                            onDrop={() => { if (dragSlot !== null && dragSlot !== i) { moveSlot(day.id, dragSlot, i); setDragSlot(null); } }}
                            onDragEnd={() => setDragSlot(null)}
                            style={{
                              display: "grid", gridTemplateColumns: "28px 62px 44px 50px 1fr 90px 90px 70px 32px",
                              padding: "10px 16px", alignItems: "center", gap: 8,
                              borderBottom: i < day.slots.length - 1 ? "1px solid #1a1a1e" : "none",
                              borderLeft: `4px solid ${rc.border}`,
                              background: dragSlot === i ? "rgba(168,85,247,0.06)" : slot.availability === "not_dispo" ? "rgba(239,68,68,0.02)" : slot.availability === "dispo" ? "rgba(34,197,94,0.02)" : "transparent",
                              transition: "background 0.15s",
                            }}
                          >
                            {/* Drag handle */}
                            <div style={{ cursor: "grab", color: "#333", fontSize: 14, textAlign: "center", userSelect: "none" }}>⠿</div>

                            {/* Time */}
                            <input type="time" value={slot.time}
                              onChange={e => updateSlot(day.id, slot.id, { time: e.target.value })}
                              style={{ padding: "6px 4px", background: "#0c0c0e", border: "1px solid #2a2a2e", borderRadius: 6, color: "#f0f0f0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none", fontWeight: 700, width: "100%" }}
                            />

                            {/* Duration */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <input type="number" value={slot.duration}
                                onChange={e => updateSlot(day.id, slot.id, { duration: e.target.value })}
                                min="5" max="120" step="5"
                                style={{ width: "100%", padding: "6px 2px", background: "#0c0c0e", border: "1px solid #2a2a2e", borderRadius: 6, color: "#ccc", fontSize: 12, fontFamily: "inherit", outline: "none", textAlign: "center" }}
                              />
                            </div>

                            {/* Photo */}
                            <div style={{ width: 44, height: 54, borderRadius: 8, overflow: "hidden", background: "#0c0c0e", border: "1px solid #1e1e22" }}>
                              {profile?.photos?.[0] ? (
                                <img src={profile.photos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              ) : (
                                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: 16 }}>◎</div>
                              )}
                            </div>

                            {/* Name + role + info */}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f0f0", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fullName}</div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 10, color: rc.color, background: `${rc.color}14`, padding: "1px 8px", borderRadius: 4, fontWeight: 600 }}>
                                  {slot.role || profile?._role || "—"}
                                </span>
                                {profile?.age && <span style={{ fontSize: 9, color: "#666" }}>{profile.age} ans</span>}
                                {profile?.agency && <span style={{ fontSize: 9, color: "#666" }}>🏢 {profile.agency}</span>}
                              </div>
                            </div>

                            {/* Status */}
                            <select
                              value={slot.availability || "pending"}
                              onChange={e => updateSlot(day.id, slot.id, { availability: e.target.value })}
                              style={{
                                padding: "6px 4px", background: avail.bg, border: `1px solid ${avail.color}44`,
                                borderRadius: 8, color: avail.color, fontSize: 10, fontFamily: "inherit",
                                fontWeight: 700, outline: "none", cursor: "pointer", width: "100%",
                                textAlign: "center",
                              }}
                            >
                              {Object.entries(SLOT_AVAILABILITY).map(([k, v]) => (
                                <option key={k} value={k}>{v.icon} {v.label}</option>
                              ))}
                            </select>

                            {/* Invite / Prévenir */}
                            <div style={{ textAlign: "center" }}>
                              {hasEmail ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); openInviteModal(day, slot, profile); }}
                                  title={slot._invitedAt ? `Convoqué le ${new Date(slot._invitedAt).toLocaleDateString("fr-FR")}` : "Envoyer convocation"}
                                  style={{
                                    padding: "5px 10px",
                                    background: slot._invitedAt ? "rgba(34,197,94,0.08)" : "rgba(234,67,53,0.08)",
                                    border: `1px solid ${slot._invitedAt ? "rgba(34,197,94,0.25)" : "rgba(234,67,53,0.25)"}`,
                                    borderRadius: 8, color: slot._invitedAt ? "#22c55e" : "#EA4335",
                                    cursor: "pointer", fontSize: 10, fontWeight: 700, fontFamily: "inherit",
                                    width: "100%",
                                  }}
                                >
                                  {slot._invitedAt ? "✓ Envoyé" : "📨 Prévenir"}
                                </button>
                              ) : (
                                <span style={{ fontSize: 9, color: "#333" }}>Pas d'email</span>
                              )}
                            </div>

                            {/* Notes */}
                            <div style={{ textAlign: "center" }}>
                              <button
                                onClick={() => setActingNotesModal({ dayId: day.id, slotId: slot.id })}
                                style={{
                                  background: slot.actingNotes || slot.actingFileName ? "rgba(168,85,247,0.12)" : "rgba(255,255,255,0.03)",
                                  border: slot.actingNotes || slot.actingFileName ? "1px solid rgba(168,85,247,0.3)" : "1px solid #2a2a2e",
                                  borderRadius: 8, color: slot.actingNotes || slot.actingFileName ? "#a855f7" : "#444",
                                  cursor: "pointer", fontSize: 12, width: 32, height: 32,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                }}
                              >
                                📝
                              </button>
                            </div>

                            {/* Remove */}
                            <button onClick={() => removeSlot(day.id, slot.id)}
                              style={{ background: "none", border: "none", color: "#333", cursor: "pointer", fontSize: 16, fontFamily: "inherit", padding: 0, transition: "color 0.2s", textAlign: "center" }}
                              onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                              onMouseLeave={e => e.currentTarget.style.color = "#333"}
                            >×</button>
                          </div>
                        );
                      })}

                      {day.slots.length === 0 && (
                        <div style={{ padding: "40px", textAlign: "center", color: "#444", fontSize: 13 }}>
                          Ajoutez des profils ci-dessous pour construire la journée
                        </div>
                      )}
                    </div>

                    {/* Add profile to day */}
                    <div style={{
                      background: "#111114", borderRadius: 14, border: "1px solid #1e1e22",
                      padding: "16px 20px",
                    }}>
                      <label style={{ display: "block", fontSize: 10, color: "#888", marginBottom: 10, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                        Ajouter un passage
                      </label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {availableProfiles.map(p => {
                          const prc = getRoleColor(p._role);
                          return (
                          <button
                            key={p.id}
                            onClick={() => addSlot(day.id, p.id, p._role)}
                            style={{
                              display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                              background: p._alreadyInDay ? "rgba(168,85,247,0.06)" : prc.bg,
                              border: p._alreadyInDay ? "1px solid rgba(168,85,247,0.2)" : "1px solid #2a2a2e",
                              borderLeft: `3px solid ${prc.border}`,
                              borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                              transition: "all 0.2s",
                            }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = "#a855f7"}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = p._alreadyInDay ? "rgba(168,85,247,0.2)" : "#2a2a2e"; e.currentTarget.style.borderLeftColor = prc.border; }}
                          >
                            <div style={{ width: 28, height: 28, borderRadius: 6, overflow: "hidden", background: "#0c0c0e", flexShrink: 0 }}>
                              {p.photos?.[0] ? (
                                <img src={p.photos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              ) : (
                                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: 10 }}>◎</div>
                              )}
                            </div>
                            <div style={{ textAlign: "left" }}>
                              <div style={{ fontSize: 12, fontWeight: 500, color: p._alreadyInDay ? "#a855f7" : "#ccc" }}>
                                {[p.firstName, p.name].filter(Boolean).join(" ") || "Sans nom"} {p._alreadyInDay ? "✓" : ""}
                              </div>
                              <div style={{ fontSize: 9, color: prc.color, fontWeight: 500 }}>{p._role}</div>
                            </div>
                          </button>
                          );
                        })}
                        {availableProfiles.length === 0 && (
                          <div style={{ fontSize: 12, color: "#555", fontStyle: "italic" }}>
                            Aucun profil sélectionné. Évaluez des profils dans l'onglet Casting.
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            ) : activeTab === "casting" ? (
            /* ===== CASTING VIEW ===== */
            <div>
              {(() => {
                const allCasting = getCastingProfiles();
                const rolesWithCasting = [...new Set(allCasting.map(p => p._role))];
                const currentRole = castingActiveRole && rolesWithCasting.includes(castingActiveRole) ? castingActiveRole : rolesWithCasting[0] || null;
                if (currentRole && currentRole !== castingActiveRole) setTimeout(() => setCastingActiveRole(currentRole), 0);

                if (allCasting.length === 0) {
                  return (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, color: "#444" }}>
                      <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>🎬</div>
                      <div style={{ fontSize: 14 }}>Aucun profil sélectionné pour le casting</div>
                      <div style={{ fontSize: 12, color: "#555", marginTop: 6 }}>Faites d'abord des sélections dans l'onglet Casting</div>
                    </div>
                  );
                }

                const rc = currentRole ? getRoleColor(currentRole) : { color: "#fb923c", bg: "rgba(251,146,60,0.08)" };
                const isDirector = viewMode === "director";

                // Filter profiles by role
                let roleProfiles = allCasting.filter(p => p._role === currentRole);

                // Director: further filter by day
                let dayLabel = "";
                if (isDirector && castingDayFilter !== "all" && castingDayFilter !== "unplanned") {
                  const day = state.castingDays.find(d => d.id === castingDayFilter);
                  if (day) {
                    const dayProfileIds = day.slots.map(s => s.profileId);
                    roleProfiles = roleProfiles.filter(p => dayProfileIds.includes(p.id));
                    dayLabel = day.date ? new Date(day.date + "T00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : "Date TBD";
                    // Sort by slot time
                    roleProfiles.sort((a, b) => {
                      const slotA = day.slots.find(s => s.profileId === a.id);
                      const slotB = day.slots.find(s => s.profileId === b.id);
                      return (slotA?.time || "").localeCompare(slotB?.time || "");
                    });
                  }
                } else if (isDirector && castingDayFilter === "unplanned") {
                  const allPlannedIds = state.castingDays.flatMap(d => d.slots.map(s => s.profileId));
                  roleProfiles = roleProfiles.filter(p => !allPlannedIds.includes(p.id));
                  dayLabel = "Non planifiés";
                }

                // Get slot info for a profile
                const getSlotInfo = (profileId) => {
                  for (const day of state.castingDays) {
                    const slot = day.slots.find(s => s.profileId === profileId);
                    if (slot) return { day, slot };
                  }
                  return null;
                };

                // ====== RENDER PROFILE CARD (shared between director & réal) ======
                const renderProfileCard = (profile, i) => {
                  const session = state.castingSessions[profile.id] || { passStatus: "not_yet", liveNotes: "", castingVideos: [] };
                  const passInfo = CASTING_PASS_STATUS[session.passStatus || "not_yet"];
                  const finalSel = state.finalSelections[profile.id];
                  const slotInfo = getSlotInfo(profile.id);
                  const sel = { ...(state.selections[profile.id] || {}), choice: getChoice(profile.id) };
                  const reaSel = state.realisateurSelections?.[profile.id];
                  const fullName = [profile.firstName, profile.name].filter(Boolean).join(" ") || "Sans nom";

                  return (
                    <div key={profile.id} style={{
                      background: "#111114", borderRadius: 16, border: "1px solid #1e1e22",
                      borderLeft: `4px solid ${rc.color}`,
                      overflow: "hidden",
                      opacity: session.passStatus === "absent" ? 0.5 : 1,
                      transition: "all 0.2s",
                      animation: `fadeIn 0.3s ease ${i * 0.04}s both`,
                    }}>
                      {/* === CARD HEADER: Profile + slot time + status === */}
                      <div style={{ display: "flex", gap: 16, padding: "18px 20px", alignItems: "center", cursor: isDirector ? "pointer" : "default" }}
                        onClick={() => isDirector ? setCastingDetailProfile(profile) : null}
                      >
                        {/* Slot time */}
                        {slotInfo && (
                          <div style={{ textAlign: "center", flexShrink: 0, minWidth: 52 }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: "#f0f0f0", lineHeight: 1 }}>{slotInfo.slot.time}</div>
                            <div style={{ fontSize: 9, color: "#666", marginTop: 2 }}>{slotInfo.slot.duration} min</div>
                          </div>
                        )}

                        {/* Photo */}
                        <div style={{ width: 56, height: 70, borderRadius: 10, overflow: "hidden", background: "#0c0c0e", flexShrink: 0, border: "1px solid #1e1e22" }}>
                          {profile.photos?.[0] ? (
                            <img src={profile.photos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: 22 }}>◎</div>
                          )}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: "#f0f0f0", marginBottom: 4 }}>{fullName}</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 11, color: "#888" }}>
                            {profile.age && <span>{profile.age} ans</span>}
                            {profile.height && <span>📏 {profile.height}</span>}
                            {profile.agency && <span>🏢 {profile.agency}</span>}
                            {profile.email && <span style={{ color: "#666" }}>✉ {profile.email}</span>}
                          </div>
                        </div>

                        {/* Status + role badges */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                          <span style={{ fontSize: 10, color: rc.color, background: rc.bg, padding: "3px 10px", borderRadius: 6, fontWeight: 600, border: `1px solid ${rc.border}` }}>
                            {currentRole}
                          </span>
                          {isDirector && (
                            <select value={session.passStatus || "not_yet"}
                              onClick={e => e.stopPropagation()}
                              onChange={e => { e.stopPropagation(); updateCastingSession(profile.id, { passStatus: e.target.value }); }}
                              style={{ padding: "4px 8px", background: passInfo.bg, border: `1px solid ${passInfo.color}44`, borderRadius: 6, color: passInfo.color, fontSize: 10, fontFamily: "inherit", fontWeight: 600, outline: "none", cursor: "pointer" }}>
                              {Object.entries(CASTING_PASS_STATUS).map(([k, v]) => (
                                <option key={k} value={k}>{v.icon} {v.label}</option>
                              ))}
                            </select>
                          )}
                          {session.passStatus === "passed" && (
                            <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 600, background: "rgba(34,197,94,0.1)", padding: "3px 8px", borderRadius: 6 }}>✓ Passé</span>
                          )}
                          {finalSel?.selected === true && (
                            <span style={{ fontSize: 10, color: "#22c55e", background: "rgba(34,197,94,0.1)", padding: "3px 8px", borderRadius: 6, fontWeight: 600 }}>🏆 Retenu</span>
                          )}
                          {/* Guest vote indicator */}
                          {state._guestVotes?.[profile.id] && (
                            <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 6, fontWeight: 700,
                              background: state._guestVotes[profile.id].choice === "yes" ? "rgba(96,165,250,0.1)" : state._guestVotes[profile.id].choice === "no" ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)",
                              color: state._guestVotes[profile.id].choice === "yes" ? "#60a5fa" : state._guestVotes[profile.id].choice === "no" ? "#ef4444" : "#f59e0b",
                              border: `1px solid ${state._guestVotes[profile.id].choice === "yes" ? "rgba(96,165,250,0.2)" : state._guestVotes[profile.id].choice === "no" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)"}`,
                            }}>
                              👥 {state._guestVotes[profile.id].choice === "yes" ? "OUI" : state._guestVotes[profile.id].choice === "no" ? "NON" : "P-Ê"}
                            </span>
                          )}
                          {state._guestCastingVotes?.[profile.id] && (
                            <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 6, fontWeight: 700,
                              background: state._guestCastingVotes[profile.id].choice === "yes" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                              color: state._guestCastingVotes[profile.id].choice === "yes" ? "#22c55e" : "#ef4444",
                            }}>
                              🎬 {state._guestCastingVotes[profile.id].choice === "yes" ? "OUI" : "NON"}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* === DIRECTOR: Notes + Videos inline === */}
                      {isDirector && (
                        <div style={{ padding: "0 20px 16px", display: "flex", gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <textarea value={session.liveNotes || ""}
                              onChange={e => updateCastingSession(profile.id, { liveNotes: e.target.value })}
                              placeholder="Notes de casting..."
                              rows={2}
                              style={{ width: "100%", padding: "8px 12px", background: "#0c0c0e", border: "1px solid #2a2a2e", borderRadius: 8, color: "#e0e0e0", fontSize: 12, fontFamily: "'DM Sans',sans-serif", outline: "none", resize: "vertical", lineHeight: 1.5 }}
                            />
                          </div>
                          <div style={{ display: "flex", gap: 6, alignItems: "flex-start", flexShrink: 0 }}>
                            {(session.castingVideos || []).map((v, vi) => (
                              <div key={vi} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                                <button onClick={() => setCastingVideoModal(v.url)} style={{ width: 36, height: 36, background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.2)", borderRadius: 8, color: "#fb923c", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>▶</button>
                                <span style={{ fontSize: 8, color: "#555" }}>{v.name?.slice(0, 8)}</span>
                              </div>
                            ))}
                            <label style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.02)", border: "1px dashed #333", borderRadius: 8, cursor: "pointer", fontSize: 14, color: "#444" }}>
                              <input type="file" accept="video/*" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) addCastingVideo(profile.id, e.target.files[0]); }} />
                              +
                            </label>
                          </div>
                        </div>
                      )}

                      {/* === DIRECTOR: See réalisateur's final selection === */}
                      {isDirector && finalSel?.selected != null && (
                        <div style={{
                          padding: "10px 20px", borderTop: "1px solid #1e1e22",
                          background: finalSel.selected ? "rgba(34,197,94,0.03)" : "rgba(239,68,68,0.03)",
                          display: "flex", alignItems: "center", gap: 10,
                        }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: finalSel.selected ? "#22c55e" : "#ef4444" }}>
                            {finalSel.selected ? "🏆 Sélectionné" : "✕ Non retenu"}
                          </span>
                          {finalSel.comment && <span style={{ fontSize: 11, color: "#888" }}>— « {finalSel.comment} »</span>}
                        </div>
                      )}

                      {/* === Notes display + Selection buttons === */}
                      {(
                        <>
                          {session.liveNotes && (
                            <div style={{ padding: "0 20px 12px" }}>
                              <div style={{ fontSize: 12, color: "#bbb", lineHeight: 1.6, padding: "10px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid #1a1a1e" }}>
                                📝 {session.liveNotes}
                              </div>
                            </div>
                          )}

                          {/* Selftapes */}
                          {profile.selftapeLinks?.filter(l => l).length > 0 && (
                            <div style={{ padding: "0 20px 12px" }}>
                              <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                                {profile.selftapeLinks.filter(l => l).map((link, li) => (
                                  <a key={li} href={link} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#60a5fa", background: "rgba(59,130,246,0.08)", padding: "5px 12px", borderRadius: 6, textDecoration: "none" }}>▶ Tape {li + 1}</a>
                                ))}
                              </div>
                              {profile.selftapeLinks.filter(l => l && getEmbedUrl(l)).slice(0, 1).map((link, li) => (
                                <div key={li}><EmbedPlayer url={link} height={200} /></div>
                              ))}
                            </div>
                          )}

                          {/* Casting videos */}
                          {(session.castingVideos || []).length > 0 && (
                            <div style={{ padding: "0 20px 12px", display: "flex", gap: 8 }}>
                              {session.castingVideos.map((v, vi) => (
                                <button key={vi} onClick={() => setCastingVideoModal(v.url)} style={{ fontSize: 11, color: "#fb923c", background: "rgba(251,146,60,0.08)", padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(251,146,60,0.15)", cursor: "pointer", fontFamily: "inherit" }}>▶ {v.name || `Vidéo ${vi+1}`}</button>
                              ))}
                            </div>
                          )}

                          {/* === CHOICE BUTTONS (réalisateur/guest) === */}
                          <div style={{
                            padding: "14px 20px", borderTop: "1px solid #1e1e22",
                            background: finalSel?.selected === true ? "rgba(34,197,94,0.04)" : finalSel?.selected === false ? "rgba(239,68,68,0.04)" : "rgba(255,255,255,0.01)",
                          }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: finalSel?.selected != null ? 10 : 0 }}>
                              {[
                                { val: true, label: "✓ OUI", color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
                                { val: "maybe", label: "? PEUT-ÊTRE", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
                                { val: false, label: "✕ NON", color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
                              ].map(opt => {
                                const isSelected = opt.val === "maybe"
                                  ? finalSel?.selected === "maybe"
                                  : finalSel?.selected === opt.val;
                                return (
                                  <button key={String(opt.val)}
                                    onClick={() => updateFinalSelection(profile.id, { selected: isSelected ? null : opt.val })}
                                    style={{
                                      flex: 1, padding: "12px 0", borderRadius: 10, cursor: "pointer",
                                      fontFamily: "inherit", fontSize: 14, fontWeight: 800,
                                      background: isSelected ? opt.bg : "rgba(255,255,255,0.02)",
                                      border: isSelected ? `2px solid ${opt.color}` : "2px solid #222",
                                      color: isSelected ? opt.color : "#555",
                                      transition: "all 0.15s", letterSpacing: "0.02em",
                                    }}>
                                    {opt.label}
                                  </button>
                                );
                              })}
                            </div>
                            {finalSel?.selected != null && (
                              <input value={finalSel?.comment || ""}
                                onChange={e => updateFinalSelection(profile.id, { comment: e.target.value })}
                                placeholder="Commentaire sur votre choix..."
                                style={{ width: "100%", padding: "8px 12px", background: "#0c0c0e", border: "1px solid #2a2a2e", borderRadius: 8, color: "#ccc", fontSize: 12, fontFamily: "inherit", outline: "none" }}
                              />
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                };

                return (
                  <>
                    {/* Header */}
                    <div style={{ marginBottom: 24 }}>
                      <h2 style={{ fontSize: 22, fontWeight: 700, color: "#f0f0f0", fontFamily: "'Playfair Display', serif", marginBottom: 4 }}>
                        🎬 Casting — {currentRole}
                      </h2>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "#666" }}>
                        {dayLabel && <span style={{ color: "#fb923c", fontWeight: 600 }}>📅 {dayLabel}</span>}
                        <span>{roleProfiles.length} profil{roleProfiles.length > 1 ? "s" : ""}</span>
                        <span>·</span>
                        <span>{roleProfiles.filter(p => (state.castingSessions[p.id]?.passStatus || "not_yet") === "passed").length} passés</span>
                        
                      </div>
                    </div>

                    {/* Profile cards */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {roleProfiles.map((profile, i) => renderProfileCard(profile, i))}
                      {roleProfiles.length === 0 && (
                        <div style={{ textAlign: "center", padding: 40, color: "#444", fontSize: 13 }}>
                          {castingDayFilter === "unplanned" ? "Tous les profils de ce rôle sont planifiés ✓" : "Aucun profil pour ce filtre"}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>

            ) : activeTab === "final" ? (
            /* ===== CASTING DEFINITIF VIEW ===== */
            <div>
              {(() => {
                // Gather ALL profiles that have any final selection
                const allEvaluated = [];
                state.roles.forEach(role => {
                  (state.profiles[role] || []).forEach(p => {
                    const fs = state.finalSelections[p.id];
                    if (fs?.selected != null) {
                      allEvaluated.push({ ...p, _role: role, _finalSel: fs });
                    }
                  });
                });

                const rolesWithFinal = [...new Set(allEvaluated.map(p => p._role))];
                const currentRole = castingActiveRole && rolesWithFinal.includes(castingActiveRole) ? castingActiveRole : rolesWithFinal[0] || null;
                if (currentRole && currentRole !== castingActiveRole) setTimeout(() => setCastingActiveRole(currentRole), 0);

                if (allEvaluated.length === 0) {
                  return (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, color: "#444" }}>
                      <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>🏆</div>
                      <div style={{ fontSize: 14 }}>Aucune décision de casting</div>
                      <div style={{ fontSize: 12, color: "#555", marginTop: 6 }}>Faites votre sélection dans l'onglet Casting</div>
                    </div>
                  );
                }

                const roleEvaluated = allEvaluated.filter(p => p._role === currentRole);
                const selected = roleEvaluated.filter(p => p._finalSel?.selected === true);
                const maybe = roleEvaluated.filter(p => p._finalSel?.selected === "maybe");
                const rejected = roleEvaluated.filter(p => p._finalSel?.selected === false);
                const rc = currentRole ? getRoleColor(currentRole) : { color: "#22c55e", bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.4)" };

                // Quick email helper — opens compose modal
                const quickMail = (p, type) => {
                  const email = type === "agency" ? p.agencyEmail : p.email;
                  if (!email) return;
                  const fullName = [p.firstName, p.name].filter(Boolean).join(" ");
                  const isSel = p._finalSel?.selected === true;
                  const isMaybe = p._finalSel?.selected === "maybe";
                  const role = p._role || "";

                  let subject, body;
                  if (isSel) {
                    subject = type === "agency"
                      ? `Confirmation casting - ${state.projectName || "Projet"} - ${role} - ${fullName}`
                      : `Félicitations - Casting ${state.projectName || "Projet"} - ${role}`;
                    body = type === "agency"
                      ? `Bonjour,\n\nJe vous confirme que ${fullName} a été retenu(e) pour le rôle de ${role} dans le projet "${state.projectName || ""}".\n\nMerci de bien vouloir nous transmettre les disponibilités de votre artiste pour les prochaines étapes.\n\nCordialement,\n${authUser?.firstName || "La direction de casting"}`
                      : `Bonjour ${fullName},\n\nJ'ai le plaisir de vous annoncer que vous avez été retenu(e) pour le rôle de ${role} dans le projet "${state.projectName || ""}".\n\nNous reviendrons vers vous très prochainement avec les détails des prochaines étapes.\n\nFélicitations et à bientôt,\n${authUser?.firstName || "La direction de casting"}`;
                  } else if (isMaybe) {
                    subject = `Casting ${state.projectName || "Projet"} - ${role} - Suivi`;
                    body = `Bonjour ${type === "agency" ? "" : fullName},\n\nJe reviens vers vous concernant le casting pour le rôle de ${role} dans "${state.projectName || ""}".\n\nVotre candidature est toujours en cours d'évaluation. Nous ne manquerons pas de revenir vers vous dès qu'une décision sera prise.\n\nCordialement,\n${authUser?.firstName || "La direction de casting"}`;
                  } else {
                    subject = type === "agency"
                      ? `Casting ${state.projectName || "Projet"} - ${role} - ${fullName}`
                      : `Casting ${state.projectName || "Projet"} - ${role}`;
                    body = type === "agency"
                      ? `Bonjour,\n\nJe vous remercie pour la proposition de ${fullName} pour le rôle de ${role} dans "${state.projectName || ""}".\n\nAprès réflexion, nous n'avons malheureusement pas retenu sa candidature pour ce projet. Nous ne manquerons pas de penser à votre artiste pour de futures opportunités.\n\nCordialement,\n${authUser?.firstName || "La direction de casting"}`
                      : `Bonjour ${fullName},\n\nJe vous remercie pour votre passage au casting pour le rôle de ${role} dans "${state.projectName || ""}".\n\nAprès réflexion, nous avons fait le choix de nous orienter vers un autre profil. Votre talent a été apprécié et nous espérons avoir l'occasion de travailler ensemble sur un prochain projet.\n\nBien cordialement,\n${authUser?.firstName || "La direction de casting"}`;
                  }

                  setFinalMailModal({ profile: p, type, email, subject, body, fullName, isSel, isMaybe, role });
                  setFinalMailCopied(false);
                };

                // ====== CARD RENDERER ======
                const renderCard = (p, isGrid) => {
                  const session = state.castingSessions[p.id] || {};
                  const isSel = p._finalSel?.selected === true;
                  const isMaybe = p._finalSel?.selected === "maybe";
                  const fullName = [p.firstName, p.name].filter(Boolean).join(" ") || "Sans nom";
                  const accentColor = isSel ? "#22c55e" : isMaybe ? "#f59e0b" : "#ef4444";
                  const accentBg = isSel ? "rgba(34,197,94,0.06)" : isMaybe ? "rgba(245,158,11,0.06)" : "rgba(239,68,68,0.04)";

                  if (isGrid) {
                    return (
                      <div key={p.id} style={{
                        background: "#111114", borderRadius: 16, border: "1px solid #1e1e22",
                        borderTop: `4px solid ${accentColor}`, overflow: "hidden",
                        animation: "fadeIn 0.3s ease both",
                      }}>
                        {/* Photo */}
                        <div style={{ height: 200, overflow: "hidden", background: "#0c0c0e", position: "relative" }}>
                          {p.photos?.[0] ? (
                            <img src={p.photos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: 48 }}>◎</div>
                          )}
                          <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 4 }}>
                            <span style={{ fontSize: 10, color: "#fff", background: accentColor, padding: "3px 10px", borderRadius: 20, fontWeight: 700 }}>
                              {isSel ? "✓ RETENU" : isMaybe ? "? EN ATTENTE" : "✕ NON RETENU"}
                            </span>
                          </div>
                          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.85))", padding: "30px 16px 14px" }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{fullName}</div>
                            <span style={{ fontSize: 10, color: rc.color, fontWeight: 600 }}>{currentRole}</span>
                          </div>
                        </div>

                        {/* Info */}
                        <div style={{ padding: "14px 16px" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 11, color: "#999", marginBottom: 10 }}>
                            {p.age && <span>{p.age} ans</span>}
                            {p.height && <span>📏 {p.height}</span>}
                            {p.agency && <span>🏢 {p.agency}</span>}
                          </div>

                          {/* Casting video */}
                          {session.castingVideos?.length > 0 && (
                            <div style={{ marginBottom: 10 }}>
                              {session.castingVideos.map((v, vi) => (
                                <button key={vi} onClick={() => setCastingVideoModal(v.url)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.15)", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontSize: 10, color: "#fb923c", fontWeight: 500, marginBottom: 4, width: "100%" }}>
                                  🎬 {v.name} — ▶ Voir
                                </button>
                              ))}
                            </div>
                          )}

                          {session.liveNotes && (
                            <div style={{ fontSize: 10, color: "#999", lineHeight: 1.5, padding: "6px 8px", background: "rgba(255,255,255,0.02)", borderRadius: 6, marginBottom: 10 }}>
                              📝 {session.liveNotes.slice(0, 80)}{session.liveNotes.length > 80 ? "..." : ""}
                            </div>
                          )}

                          {p._finalSel?.comment && (
                            <div style={{ fontSize: 10, color: accentColor, fontStyle: "italic", marginBottom: 10 }}>
                              💬 « {p._finalSel.comment} »
                            </div>
                          )}

                          {/* Email buttons */}
                          <div style={{ display: "flex", gap: 6 }}>
                            {p.email && (
                              <button onClick={() => quickMail(p, "actor")} style={{ flex: 1, padding: "8px 0", background: "rgba(234,67,53,0.06)", border: "1px solid rgba(234,67,53,0.15)", borderRadius: 8, color: "#EA4335", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                                ✉ Acteur
                              </button>
                            )}
                            {p.agencyEmail && (
                              <button onClick={() => quickMail(p, "agency")} style={{ flex: 1, padding: "8px 0", background: "rgba(66,133,244,0.06)", border: "1px solid rgba(66,133,244,0.15)", borderRadius: 8, color: "#4285F4", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                                ✉ Agence
                              </button>
                            )}
                            {!p.email && !p.agencyEmail && (
                              <span style={{ fontSize: 9, color: "#444", fontStyle: "italic" }}>Aucun email</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // ====== LIST VIEW ======
                  return (
                    <div key={p.id} style={{
                      display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
                      background: "#111114", borderRadius: 12, border: "1px solid #1e1e22",
                      borderLeft: `4px solid ${accentColor}`,
                      animation: "fadeIn 0.3s ease both",
                    }}>
                      {/* Photo */}
                      <div style={{ width: 50, height: 62, borderRadius: 8, overflow: "hidden", background: "#0c0c0e", flexShrink: 0, border: "1px solid #1e1e22" }}>
                        {p.photos?.[0] ? <img src={p.photos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: 18 }}>◎</div>}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#f0f0f0", marginBottom: 3 }}>{fullName}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#888", flexWrap: "wrap" }}>
                          {p.age && <span>{p.age} ans</span>}
                          {p.height && <span>📏 {p.height}</span>}
                          {p.agency && <span>🏢 {p.agency}</span>}
                          {p.email && <span style={{ color: "#666" }}>✉ {p.email}</span>}
                        </div>
                        {p._finalSel?.comment && (
                          <div style={{ fontSize: 10, color: accentColor, fontStyle: "italic", marginTop: 4 }}>💬 « {p._finalSel.comment} »</div>
                        )}
                      </div>

                      {/* Videos */}
                      {session.castingVideos?.length > 0 && (
                        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                          {session.castingVideos.map((v, vi) => (
                            <button key={vi} onClick={() => setCastingVideoModal(v.url)} style={{ width: 32, height: 32, background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.2)", borderRadius: 8, color: "#fb923c", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>▶</button>
                          ))}
                        </div>
                      )}

                      {/* Status badge */}
                      <span style={{ fontSize: 10, color: "#fff", background: accentColor, padding: "4px 12px", borderRadius: 20, fontWeight: 700, flexShrink: 0 }}>
                        {isSel ? "✓ RETENU" : isMaybe ? "? ATTENTE" : "✕ NON"}
                      </span>

                      {/* Quick email */}
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        {p.email && (
                          <button onClick={() => quickMail(p, "actor")} title="Email acteur" style={{ width: 32, height: 32, background: "rgba(234,67,53,0.06)", border: "1px solid rgba(234,67,53,0.15)", borderRadius: 8, color: "#EA4335", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✉</button>
                        )}
                        {p.agencyEmail && (
                          <button onClick={() => quickMail(p, "agency")} title="Email agence" style={{ width: 32, height: 32, background: "rgba(66,133,244,0.06)", border: "1px solid rgba(66,133,244,0.15)", borderRadius: 8, color: "#4285F4", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>🏢</button>
                        )}
                      </div>
                    </div>
                  );
                };

                // ====== SECTION RENDERER ======
                const renderSection = (title, icon, color, profiles, sectionKey) => {
                  if (profiles.length === 0) return null;
                  const isOpen = finalSectionOpen?.[sectionKey] !== false;
                  return (
                    <div style={{ marginBottom: 24 }}>
                      <button onClick={() => setFinalSectionOpen(prev => ({ ...prev, [sectionKey]: !isOpen }))} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        width: "100%", padding: "14px 20px", marginBottom: isOpen ? 14 : 0,
                        background: `${color}08`, border: `1px solid ${color}22`, borderRadius: 14,
                        cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 16, transition: "transform 0.2s", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>▶</span>
                          <span style={{ fontSize: 15, fontWeight: 800, color }}>{icon} {title}</span>
                          <span style={{ fontSize: 12, color, background: `${color}15`, padding: "2px 12px", borderRadius: 10, fontWeight: 700 }}>{profiles.length}</span>
                        </div>
                      </button>
                      {isOpen && (
                        finalViewMode === "grid" ? (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
                            {profiles.map(p => renderCard(p, true))}
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {profiles.map(p => renderCard(p, false))}
                          </div>
                        )
                      )}
                    </div>
                  );
                };

                return (
                  <>
                    {/* Header + view toggle */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
                      <div>
                        <h2 style={{ fontSize: 24, fontWeight: 800, color: "#f0f0f0", fontFamily: "'Playfair Display', serif", marginBottom: 4 }}>
                          🏆 Casting Définitif — {currentRole}
                        </h2>
                        <div style={{ display: "flex", gap: 14, fontSize: 13, color: "#666" }}>
                          <span style={{ color: "#22c55e" }}>{selected.length} retenu{selected.length > 1 ? "s" : ""}</span>
                          {maybe.length > 0 && <span style={{ color: "#f59e0b" }}>{maybe.length} en attente</span>}
                          <span style={{ color: "#ef4444" }}>{rejected.length} non retenu{rejected.length > 1 ? "s" : ""}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 2, background: "#0c0c0e", borderRadius: 8, padding: 2, flexShrink: 0 }}>
                        <button onClick={() => setFinalViewMode("grid")} style={{ padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, background: finalViewMode === "grid" ? "rgba(34,197,94,0.12)" : "transparent", color: finalViewMode === "grid" ? "#22c55e" : "#555" }}>
                          ▦ Grille
                        </button>
                        <button onClick={() => setFinalViewMode("list")} style={{ padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, background: finalViewMode === "list" ? "rgba(34,197,94,0.12)" : "transparent", color: finalViewMode === "list" ? "#22c55e" : "#555" }}>
                          ☰ Liste
                        </button>
                      </div>
                    </div>

                    {/* Sections */}
                    {renderSection("Retenus", "✓", "#22c55e", selected, "selected")}
                    {renderSection("En attente de décision", "?", "#f59e0b", maybe, "maybe")}
                    {renderSection("Non retenus", "✕", "#ef4444", rejected, "rejected")}
                  </>
                );
              })()}
            </div>

            ) : activeTab === "mail" ? null : (
            /* ===== ROLES VIEW (existing) ===== */
            <div>
            {/* Toolbar */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 28, flexWrap: "wrap", gap: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <h2 style={{
                  fontSize: 22, fontWeight: 700, color: "#f0f0f0", letterSpacing: "-0.01em",
                  fontFamily: "'Playfair Display', serif",
                }}>
                  {activeRole}
                </h2>
                <span style={{ fontSize: 12, color: "#555", fontWeight: 500 }}>
                  {filteredProfiles.length} profil{filteredProfiles.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Search */}
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Rechercher..."
                  style={{
                    padding: "8px 14px", background: "#111114", border: "1px solid #222226",
                    borderRadius: 10, color: "#e0e0e0", fontSize: 13, fontFamily: "inherit",
                    outline: "none", width: 180, transition: "border-color 0.2s",
                  }}
                  onFocus={e => e.target.style.borderColor = "#c9a44a55"}
                  onBlur={e => e.target.style.borderColor = "#222226"}
                />

                {/* Status filter */}
                {viewMode !== "realisateur" && (
                  <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    style={{
                      padding: "8px 14px", background: "#111114", border: "1px solid #222226",
                      borderRadius: 10, color: "#e0e0e0", fontSize: 13, fontFamily: "inherit",
                      outline: "none", appearance: "none", cursor: "pointer",
                    }}
                  >
                    <option value="all">Tous</option>
                    {Object.entries(AVAILABILITY).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                )}

                {/* Selection filter (director & realisateur) */}
                {(viewMode === "director" || viewMode === "realisateur") && (
                  <select
                    value={filterSelection}
                    onChange={e => setFilterSelection(e.target.value)}
                    style={{
                      padding: "8px 14px", background: "#111114", border: "1px solid #222226",
                      borderRadius: 10, color: "#e0e0e0", fontSize: 13, fontFamily: "inherit",
                      outline: "none", appearance: "none", cursor: "pointer",
                    }}
                  >
                    <option value="all">Toutes sélections</option>
                    <option value="yes">✓ Oui</option>
                    <option value="maybe">? Peut-être</option>
                    <option value="no">✕ Non</option>
                    <option value="none">⊘ Non traité</option>
                  </select>
                )}

                {/* Contact status filter (director only) */}
                {viewMode === "director" && (
                  <select
                    value={filterContact}
                    onChange={e => setFilterContact(e.target.value)}
                    style={{
                      padding: "8px 14px", background: "#111114", border: "1px solid #222226",
                      borderRadius: 10, color: "#e0e0e0", fontSize: 13, fontFamily: "inherit",
                      outline: "none", appearance: "none", cursor: "pointer",
                    }}
                  >
                    <option value="all">Tous contacts</option>
                    {Object.entries(CONTACT_STATUS).map(([key, val]) => (
                      <option key={key} value={key}>{val.icon} {val.label}</option>
                    ))}
                  </select>
                )}

                {/* Add button (director only) */}
                {viewMode === "director" && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => { setEditingProfile(null); setModalOpen(true); }}
                      style={{
                        padding: "8px 20px", background: "linear-gradient(135deg, #c9a44a, #a67c2e)",
                        color: "#000", border: "none", borderRadius: 10, cursor: "pointer",
                        fontSize: 13, fontWeight: 700, fontFamily: "inherit", letterSpacing: "0.02em",
                        display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
                      }}
                    >
                      + Ajouter
                    </button>
                    {actorDatabase.length > 0 && (
                      <button
                        onClick={() => { setImportFileSearch(""); setImportFromFileModal(true); }}
                        style={{
                          padding: "8px 14px", background: "rgba(168,85,247,0.08)",
                          color: "#a855f7", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 10, cursor: "pointer",
                          fontSize: 11, fontWeight: 600, fontFamily: "inherit",
                          display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
                        }}
                      >
                        📁 Fichier casting
                      </button>
                    )}
                    {currentProfiles.length >= 2 && (
                      <button onClick={() => { setCompareMode(!compareMode); setCompareSelection([]); }}
                        style={{
                          padding: "8px 14px", background: compareMode ? "rgba(96,165,250,0.12)" : "rgba(255,255,255,0.03)",
                          color: compareMode ? "#60a5fa" : "#666", border: compareMode ? "1px solid rgba(96,165,250,0.3)" : "1px solid #2a2a2e",
                          borderRadius: 10, cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit", whiteSpace: "nowrap",
                        }}>
                        {compareMode ? "✕ Annuler" : "⚖ Comparer"}
                      </button>
                    )}
                    {currentProfiles.length > 0 && (
                      <button onClick={() => { setPresentationIndex(0); setPresentationMode("slideshow"); }}
                        style={{ padding: "8px 14px", background: "rgba(255,255,255,0.03)", color: "#666", border: "1px solid #2a2a2e", borderRadius: 10, cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit", whiteSpace: "nowrap" }}>
                        ▶ Présentation
                      </button>
                    )}
                    {currentProfiles.length > 0 && (
                      <button onClick={() => setPresentationMode("pdf")}
                        style={{ padding: "8px 14px", background: "rgba(255,255,255,0.03)", color: "#666", border: "1px solid #2a2a2e", borderRadius: 10, cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit", whiteSpace: "nowrap" }}>
                        🖨 PDF
                      </button>
                    )}
                    {archivedCount > 0 && (
                      <button onClick={() => setShowArchived(!showArchived)}
                        style={{
                          padding: "8px 14px", background: showArchived ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.03)",
                          color: showArchived ? "#ef4444" : "#666", border: `1px solid ${showArchived ? "rgba(239,68,68,0.2)" : "#2a2a2e"}`,
                          borderRadius: 10, cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit", whiteSpace: "nowrap",
                        }}>
                        {showArchived ? "✕ Masquer refusés" : `👁 Refusés (${archivedCount})`}
                      </button>
                    )}
                  </div>
                )}
                {/* Grid/List toggle */}
                <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                  <button onClick={() => setProfileGridMode("grid")} style={{ padding: "6px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: profileGridMode === "grid" ? "rgba(201,164,74,0.12)" : "transparent", color: profileGridMode === "grid" ? "#c9a44a" : "#555", fontSize: 14 }}>▦</button>
                  <button onClick={() => setProfileGridMode("list")} style={{ padding: "6px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: profileGridMode === "list" ? "rgba(201,164,74,0.12)" : "transparent", color: profileGridMode === "list" ? "#c9a44a" : "#555", fontSize: 14 }}>☰</button>
                </div>
              </div>
            </div>

            {/* Profile Grid / List */}
            {filteredProfiles.length === 0 ? (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", minHeight: 300, color: "#444",
              }}>
                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>◎</div>
                <div style={{ fontSize: 14, marginBottom: 8 }}>
                  {"Aucun profil pour ce rôle"}
                </div>
                {viewMode === "director" && (
                  <button
                    onClick={() => { setEditingProfile(null); setModalOpen(true); }}
                    style={{
                      padding: "10px 24px", background: "transparent", color: "#c9a44a",
                      border: "1px solid #c9a44a44", borderRadius: 10, cursor: "pointer",
                      fontSize: 13, fontWeight: 600, fontFamily: "inherit", marginTop: 8,
                    }}
                  >
                    + Ajouter le premier profil
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Selection summary bar (director & realisateur) */}
                {(viewMode === "director" || viewMode === "realisateur") && (() => {
                  const total = currentProfiles.length;
                  const yC = currentProfiles.filter(p => getChoice(p.id) === "yes").length;
                  const mC = currentProfiles.filter(p => getChoice(p.id) === "maybe").length;
                  const nC = currentProfiles.filter(p => getChoice(p.id) === "no").length;
                  const remaining = total - yC - mC - nC;
                  return (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 16, marginBottom: 20,
                      padding: "12px 18px", background: "#111114", borderRadius: 10,
                      border: "1px solid #1e1e22", fontSize: 12,
                    }}>
                      <span style={{ color: "#888", fontWeight: 500 }}>Sélection :</span>
                      <span style={{ color: "#22c55e", fontWeight: 600 }}>✓ {yC} oui</span>
                      <span style={{ color: "#f59e0b", fontWeight: 600 }}>? {mC} peut-être</span>
                      <span style={{ color: "#ef4444", fontWeight: 600 }}>✕ {nC} non</span>
                      {remaining > 0 && <span style={{ color: "#555" }}>⊘ {remaining} restant{remaining > 1 ? "s" : ""}</span>}
                      {remaining === 0 && <span style={{ color: "#c9a44a", fontWeight: 600, marginLeft: "auto" }}>✓ Tous évalués</span>}
                    </div>
                  );
                })()}

                <div style={{
                  display: profileGridMode === "list" ? "flex" : "grid",
                  flexDirection: profileGridMode === "list" ? "column" : undefined,
                  gridTemplateColumns: profileGridMode === "list" ? undefined : "1fr 1fr",
                  gap: 10,
                }}>
                  {filteredProfiles.map((profile, i) => (
                    <div key={profile.id} style={{ animation: `fadeIn 0.3s ease ${i * 0.05}s both`, position: "relative" }}>
                      {/* Compare mode overlay */}
                      {compareMode && viewMode === "director" && (
                        <div onClick={() => setCompareSelection(prev => prev.includes(profile.id) ? prev.filter(x => x !== profile.id) : prev.length < 3 ? [...prev, profile.id] : prev)}
                          style={{ position: "absolute", top: 8, left: 8, zIndex: 10, width: 24, height: 24, borderRadius: "50%", cursor: "pointer",
                            background: compareSelection.includes(profile.id) ? "#60a5fa" : "rgba(0,0,0,0.6)",
                            border: compareSelection.includes(profile.id) ? "2px solid #60a5fa" : "2px solid #555",
                            display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700,
                          }}>{compareSelection.includes(profile.id) ? compareSelection.indexOf(profile.id) + 1 : ""}</div>
                      )}
                      {/* Profile card with integrated selection */}
                        <div style={{ position: "relative" }}>
                          <ProfileCard
                            profile={profile}
                            onEdit={() => { setEditingProfile(profile); setModalOpen(true); }}
                            onStatusChange={(newStatus) => changeStatus(profile.id, newStatus)}
                            viewMode={viewMode}
                          />
                          {/* Selection bar — Cinéma style */}
                          <div style={{ marginTop: 4, display: "flex", borderRadius: 3, overflow: "hidden", border: "1px solid #1a1a1e" }}>
                            {[
                              { choice: "yes", label: "OUI", color: "#22c55e" },
                              { choice: "maybe", label: "PEUT-ÊTRE", color: "#f59e0b" },
                              { choice: "no", label: "NON", color: "#ef4444" },
                            ].map((opt, i) => {
                              const isActive = getChoice(profile.id) === opt.choice;
                              const isFromGuest = state._guestVotes?.[profile.id]?.choice === opt.choice;
                              return (
                                <button key={opt.choice}
                                  onClick={(e) => { e.stopPropagation(); setSelection(profile.id, isActive ? null : opt.choice); }}
                                  style={{
                                    flex: 1, padding: "7px 0", border: "none", cursor: "pointer",
                                    borderRight: i < 2 ? "1px solid #1a1a1e" : "none",
                                    fontFamily: "'Bebas Neue','DM Sans',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
                                    background: isActive ? `${opt.color}15` : "transparent",
                                    color: isActive ? opt.color : "#333",
                                    transition: "all 0.15s",
                                  }}>
                                  {isActive ? (opt.choice === "yes" ? "✓ " : opt.choice === "no" ? "✕ " : "~ ") : ""}{opt.label}
                                  {isFromGuest && isActive && <span style={{ fontSize: 8, marginLeft: 3, opacity: 0.7 }}>R/P</span>}
                                </button>
                              );
                            })}
                          </div>

                          {/* Status row — compact, only shows when relevant */}
                          {(getChoice(profile.id) || state._guestVotes?.[profile.id] || state._guestComments?.[profile.id]?.length > 0) && (
                            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              {getChoice(profile.id) && <ContactStatusBadge contact={state.contacts[profile.id]} />}
                              {getChoice(profile.id) && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setContactingProfile(profile); setContactModalOpen(true); }}
                                  style={{
                                    padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 9, fontWeight: 600, fontFamily: "inherit",
                                    border: state.contacts[profile.id]?.status && state.contacts[profile.id]?.status !== "not_contacted"
                                      ? `1px solid ${CONTACT_STATUS[state.contacts[profile.id].status].color}33`
                                      : "1px solid #c9a44a33",
                                    background: "transparent",
                                    color: state.contacts[profile.id]?.status && state.contacts[profile.id]?.status !== "not_contacted"
                                      ? CONTACT_STATUS[state.contacts[profile.id].status].color
                                      : "#c9a44a",
                                  }}>
                                  {state.contacts[profile.id]?.status && state.contacts[profile.id]?.status !== "not_contacted" ? "✏ Contact" : "✉ Contacter"}
                                </button>
                              )}
                              {/* RÉAL/PROD vote badge */}
                              {state._guestVotes?.[profile.id] && (
                                <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 4, fontWeight: 700,
                                  background: state._guestVotes[profile.id].choice === "yes" ? "rgba(34,197,94,0.08)" : state._guestVotes[profile.id].choice === "no" ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)",
                                  color: state._guestVotes[profile.id].choice === "yes" ? "#22c55e" : state._guestVotes[profile.id].choice === "no" ? "#ef4444" : "#f59e0b",
                                }}>
                                  R/P {state._guestVotes[profile.id].choice === "yes" ? "OUI" : state._guestVotes[profile.id].choice === "no" ? "NON" : "P-Ê"}
                                </span>
                              )}
                              {state._guestComments?.[profile.id]?.slice(-1).map((c, ci) => (
                                <span key={ci} style={{ fontSize: 9, color: "#666", fontStyle: "italic", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>💬 {c.text}</span>
                              ))}
                            </div>
                          )}

                          {/* Tools row — compact, single line */}
                          <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 2 }}>
                            {/* Stars */}
                            {[1,2,3,4,5].map(n => (
                              <button key={n} onClick={() => quickRateProfile(profile.id, n)}
                                style={{ width: 18, height: 18, borderRadius: 3, border: "none", cursor: "pointer", fontSize: 10, padding: 0,
                                  background: n <= (profile._quickRating || 0) ? "rgba(201,164,74,0.15)" : "transparent",
                                  color: n <= (profile._quickRating || 0) ? "#c9a44a" : "#222", transition: "all 0.15s",
                                }}>★</button>
                            ))}
                            <div style={{ flex: 1 }} />
                            {state.roles.length > 1 && (
                              <button onClick={() => setMoveProfileModal({ profile, fromRole: activeRole })}
                                style={{ padding: "2px 6px", background: "none", border: "none", borderRadius: 4, color: "#333", fontSize: 9, cursor: "pointer", fontFamily: "inherit" }}
                                onMouseEnter={e => e.currentTarget.style.color = "#c9a44a"}
                                onMouseLeave={e => e.currentTarget.style.color = "#333"}>↗</button>
                            )}
                            {state.roles.length > 1 && (
                              <button onClick={() => setCopyProfileModal({ profile })}
                                style={{ padding: "2px 6px", background: "none", border: "none", borderRadius: 4, color: "#333", fontSize: 9, cursor: "pointer", fontFamily: "inherit" }}
                                onMouseEnter={e => e.currentTarget.style.color = "#22c55e"}
                                onMouseLeave={e => e.currentTarget.style.color = "#333"}>⊕</button>
                            )}
                            <button onClick={() => setEmailTemplateModal({ profile })}
                              style={{ padding: "2px 6px", background: "none", border: "none", borderRadius: 4, color: "#333", fontSize: 9, cursor: "pointer", fontFamily: "inherit" }}
                              onMouseEnter={e => e.currentTarget.style.color = "#60a5fa"}
                              onMouseLeave={e => e.currentTarget.style.color = "#333"}>✉</button>
                          </div>
                        </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            </div>
            )}

            {/* ===== MAIL TAB ===== */}
            {activeTab === "mail" && (
              <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 60px)" }}>
                {/* Gmail toolbar */}
                <div style={{ padding: "14px 16px", borderBottom: "1px solid #1e1e22", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap" }}>
                  <svg width="22" height="22" viewBox="0 0 48 48" style={{ flexShrink: 0 }}><path fill="#EA4335" d="M5.5 7.5h37v33h-37z"/><path fill="#FBBC05" d="M5.5 7.5L24 24l19.5-16.5" opacity=".3"/><path fill="#34A853" d="M5.5 40.5L24 24"/><path fill="#4285F4" d="M42.5 40.5L24 24"/><path fill="#C5221F" d="M5.5 7.5L24 24l19.5-16.5v33h-37z" opacity=".1"/><rect x="2" y="10" width="44" height="28" rx="3" fill="none" stroke="#EA4335" strokeWidth="2"/></svg>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#f0f0f0" }}>Gmail</span>
                  <div style={{ width: 1, height: 20, background: "#2a2a2e" }} />

                  {/* Gmail label input */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 200 }}>
                    <span style={{ fontSize: 10, color: "#888", fontWeight: 600, whiteSpace: "nowrap" }}>Libellé :</span>
                    <input value={state.gmailLabel || ""} onChange={e => setState(p => ({ ...p, gmailLabel: e.target.value }))}
                      placeholder={`Ex: Casting/${state.projectName || "Projet"}`}
                      style={{ flex: 1, padding: "6px 10px", background: "#0c0c0e", border: "1px solid #2a2a2e", borderRadius: 6, color: "#e0e0e0", fontSize: 11, fontFamily: "'DM Sans',sans-serif", outline: "none", maxWidth: 250 }}
                      onFocus={e => e.target.style.borderColor = "#EA4335"} onBlur={e => e.target.style.borderColor = "#2a2a2e"} />
                  </div>

                  {/* Quick Gmail links */}
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => window.open("https://mail.google.com/mail/#inbox", "_blank")}
                      style={{ padding: "6px 12px", background: "rgba(234,67,53,0.08)", border: "1px solid rgba(234,67,53,0.15)", borderRadius: 8, color: "#EA4335", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      📬 Boîte de réception
                    </button>
                    {state.gmailLabel && (
                      <button onClick={() => window.open(`https://mail.google.com/mail/#label/${encodeURIComponent(state.gmailLabel)}`, "_blank")}
                        style={{ padding: "6px 12px", background: "rgba(66,133,244,0.08)", border: "1px solid rgba(66,133,244,0.15)", borderRadius: 8, color: "#4285F4", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        📁 {state.gmailLabel}
                      </button>
                    )}
                    <button onClick={() => {
                      const subject = `Casting ${state.projectName || ""} - ${activeRole || ""}`;
                      window.open(`https://mail.google.com/mail/?view=cm&su=${encodeURIComponent(subject)}`, "_blank");
                    }}
                      style={{ padding: "6px 12px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 8, color: "#22c55e", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      ✏ Nouveau mail
                    </button>
                  </div>
                </div>

                {/* Gmail iframe viewer */}
                <div style={{ flex: 1, position: "relative", background: "#0c0c0e" }}>
                  <iframe
                    src={state.gmailLabel
                      ? `https://mail.google.com/mail/u/0/#label/${encodeURIComponent(state.gmailLabel)}`
                      : "https://mail.google.com/mail/u/0/#inbox"
                    }
                    style={{ width: "100%", height: "100%", border: "none", borderRadius: 0 }}
                    title="Gmail"
                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation"
                    allow="clipboard-read; clipboard-write"
                  />
                  {/* Fallback overlay — shown if iframe blocked */}
                  <div id="gmail-fallback" style={{
                    position: "absolute", inset: 0, background: "#0c0c0e",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    gap: 16, padding: 40, pointerEvents: "none",
                  }}>
                    <div style={{ fontSize: 56, opacity: 0.3 }}>✉</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#888", textAlign: "center" }}>
                      Gmail s'ouvre dans un nouvel onglet
                    </div>
                    <div style={{ fontSize: 12, color: "#555", textAlign: "center", maxWidth: 400, lineHeight: 1.6 }}>
                      Pour des raisons de sécurité Google, Gmail ne peut pas s'afficher directement ici. Utilisez les boutons ci-dessus pour accéder rapidement à vos emails.
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 8, pointerEvents: "auto" }}>
                      <button onClick={() => window.open("https://mail.google.com/mail/#inbox", "_blank")}
                        style={{
                          padding: "14px 28px", background: "linear-gradient(135deg, #EA4335, #c5221f)",
                          border: "none", borderRadius: 12, cursor: "pointer", fontSize: 14,
                          fontWeight: 700, fontFamily: "inherit", color: "#fff",
                          boxShadow: "0 4px 20px rgba(234,67,53,0.3)",
                        }}>
                        Ouvrir Gmail →
                      </button>
                      {state.gmailLabel && (
                        <button onClick={() => window.open(`https://mail.google.com/mail/#label/${encodeURIComponent(state.gmailLabel)}`, "_blank")}
                          style={{
                            padding: "14px 28px", background: "rgba(66,133,244,0.1)",
                            border: "1px solid rgba(66,133,244,0.3)", borderRadius: 12, cursor: "pointer",
                            fontSize: 14, fontWeight: 700, fontFamily: "inherit", color: "#4285F4",
                          }}>
                          📁 Ouvrir "{state.gmailLabel}"
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom quick actions */}
                <div style={{ padding: "10px 16px", borderTop: "1px solid #1e1e22", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, overflowX: "auto" }}>
                  <span style={{ fontSize: 10, color: "#555", fontWeight: 600, whiteSpace: "nowrap" }}>Envoi rapide :</span>
                  {state.roles.map(role => {
                    const profiles = state.profiles[role] || [];
                    const selected = profiles.filter(p => (getChoice(p.id) === "yes" || getChoice(p.id) === "maybe") && (p.email || p.agencyEmail));
                    if (selected.length === 0) return null;
                    const allEmails = selected.map(p => p.email || p.agencyEmail).filter(Boolean);
                    return (
                      <button key={role} onClick={() => {
                        const subject = `Casting ${state.projectName || ""} - Rôle ${role}`;
                        window.open(`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(allEmails.join(","))}&su=${encodeURIComponent(subject)}`, "_blank");
                        setState(p => ({ ...p, emailLog: [...(p.emailLog || []), ...selected.map(s => ({
                          id: Date.now().toString(36) + Math.random().toString(36).slice(2,5),
                          to: s.email || s.agencyEmail, toName: [s.firstName, s.name].filter(Boolean).join(" "),
                          subject, sentAt: new Date().toISOString(), role, type: "groupé"
                        }))] }));
                      }}
                        style={{ padding: "5px 10px", background: "rgba(234,67,53,0.06)", border: "1px solid rgba(234,67,53,0.12)", borderRadius: 6, color: "#EA4335", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                        🎭 {role} ({allEmails.length})
                      </button>
                    );
                  })}
                  {(state.emailLog || []).length > 0 && (
                    <span style={{ marginLeft: "auto", fontSize: 9, color: "#555" }}>{state.emailLog.length} envoyé{state.emailLog.length > 1 ? "s" : ""}</span>
                  )}
                </div>
              </div>
            )}

          </main>
        </div>
      </div>

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingProfile(null); }}
        title={editingProfile ? "Modifier le profil" : "Nouveau profil"}
      >
        <ProfileForm
          profile={editingProfile || { availability: "pending", photos: [], selftapeVideos: [], selftapeLinks: [], source: "", email: "", phone: "", agencyEmail: "", shareContacts: false }}
          onSave={editingProfile ? updateProfile : addProfile}
          onDelete={editingProfile ? () => deleteProfile(editingProfile.id) : null}
          onClose={() => { setModalOpen(false); setEditingProfile(null); }}
        />
      </Modal>

      {/* Contact Modal */}
      <Modal
        open={contactModalOpen}
        onClose={() => { setContactModalOpen(false); setContactingProfile(null); }}
        title={`${contactingProfile?._contactMode === "final" ? "🏆 Contact final" : "Contacter"} — ${contactingProfile?.name || ""}`}
        width={650}
      >
        {contactingProfile && (() => {
          const isFinalMode = contactingProfile._contactMode === "final";
          const contactData = isFinalMode ? state.finalContacts[contactingProfile.id] : state.contacts[contactingProfile.id];
          const onUpdateFn = isFinalMode ? (data) => updateFinalContact(contactingProfile.id, data) : (data) => updateContact(contactingProfile.id, data);
          return (
            <ContactModal
              profile={contactingProfile}
              contact={contactData}
              projectName={state.projectName}
              onUpdate={onUpdateFn}
              onClose={() => { setContactModalOpen(false); setContactingProfile(null); }}
            />
          );
        })()}
      </Modal>

      {/* ===== FINAL MAIL COMPOSE MODAL ===== */}
      {finalMailModal && (() => {
        const { profile, type, email, fullName, isSel, isMaybe, role } = finalMailModal;
        const statusColor = isSel ? "#22c55e" : isMaybe ? "#f59e0b" : "#ef4444";
        const statusLabel = isSel ? "✓ Retenu" : isMaybe ? "? En attente" : "✕ Non retenu";

        const handleAiCorrect = async () => {
          setFinalMailAiLoading(true);
          try {
            const response = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "claude-sonnet-4-20250514",
                max_tokens: 1000,
                messages: [{
                  role: "user",
                  content: `Tu es un assistant de rédaction professionnel français spécialisé dans le milieu du cinéma et du casting. Corrige les fautes d'orthographe et de grammaire, améliore le style et la fluidité du texte suivant tout en gardant le ton et l'intention de l'auteur. Renvoie UNIQUEMENT le texte corrigé, sans explication ni commentaire :\n\n${finalMailModal.body}`
                }]
              })
            });
            const data = await response.json();
            const corrected = data.content?.find(c => c.type === "text")?.text || finalMailModal.body;
            setFinalMailModal(prev => ({ ...prev, body: corrected }));
          } catch (err) {
            console.error("AI correction error:", err);
          }
          setFinalMailAiLoading(false);
        };

        return (
          <div onClick={() => setFinalMailModal(null)} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 660, maxHeight: "92vh", background: "#141416", borderRadius: 20, border: "1px solid #2a2a2e", overflow: "auto", display: "flex", flexDirection: "column" }}>

              {/* Header */}
              <div style={{ padding: "22px 28px 16px", borderBottom: "1px solid #1e1e22", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: "#f0f0f0", fontFamily: "'Playfair Display',serif", margin: 0 }}>✉ Rédiger un email</h3>
                  <button onClick={() => setFinalMailModal(null)} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 20 }}>×</button>
                </div>

                {/* Recipient info */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 42, height: 52, borderRadius: 8, overflow: "hidden", background: "#0c0c0e", flexShrink: 0 }}>
                    {profile?.photos?.[0] ? <img src={profile.photos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#333" }}>◎</div>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#f0f0f0" }}>{fullName}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#888", marginTop: 2 }}>
                      <span style={{ color: statusColor, fontWeight: 700, background: `${statusColor}15`, padding: "1px 8px", borderRadius: 4 }}>{statusLabel}</span>
                      <span>{role}</span>
                      <span style={{ color: "#555" }}>·</span>
                      <span style={{ color: type === "agency" ? "#4285F4" : "#EA4335" }}>{type === "agency" ? "🏢 Agence" : "✉ Acteur"}</span>
                    </div>
                  </div>
                </div>

                {/* To / Subject */}
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 10, color: "#666", fontWeight: 600, width: 40 }}>À :</span>
                    <div style={{ flex: 1, padding: "7px 12px", background: "#0c0c0e", border: "1px solid #2a2a2e", borderRadius: 8, fontSize: 12, color: "#ccc" }}>{email}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 10, color: "#666", fontWeight: 600, width: 40 }}>Objet :</span>
                    <input value={finalMailModal.subject} onChange={e => setFinalMailModal(prev => ({ ...prev, subject: e.target.value }))}
                      style={{ flex: 1, padding: "7px 12px", background: "#0c0c0e", border: "1px solid #2a2a2e", borderRadius: 8, fontSize: 12, color: "#e0e0e0", fontFamily: "'DM Sans',sans-serif", outline: "none" }}
                      onFocus={e => e.target.style.borderColor = "#c9a44a"} onBlur={e => e.target.style.borderColor = "#2a2a2e"} />
                  </div>
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: "18px 28px", flex: 1 }}>
                <textarea value={finalMailModal.body} onChange={e => setFinalMailModal(prev => ({ ...prev, body: e.target.value }))}
                  rows={12}
                  style={{
                    width: "100%", padding: "16px 18px", background: "#0c0c0e", border: "1px solid #2a2a2e",
                    borderRadius: 14, color: "#e0e0e0", fontSize: 13, fontFamily: "'DM Sans',sans-serif",
                    outline: "none", resize: "vertical", lineHeight: 1.7,
                  }}
                  onFocus={e => e.target.style.borderColor = "#c9a44a"} onBlur={e => e.target.style.borderColor = "#2a2a2e"}
                />

                {/* AI + Copy buttons */}
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <button onClick={handleAiCorrect} disabled={finalMailAiLoading}
                    style={{
                      padding: "8px 16px", background: "linear-gradient(135deg, rgba(168,85,247,0.12), rgba(168,85,247,0.06))",
                      border: "1px solid rgba(168,85,247,0.25)", borderRadius: 10,
                      color: "#a855f7", fontSize: 11, fontWeight: 700, cursor: finalMailAiLoading ? "wait" : "pointer",
                      fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
                      opacity: finalMailAiLoading ? 0.6 : 1,
                    }}>
                    {finalMailAiLoading ? (
                      <><span style={{ animation: "pulse 1s infinite" }}>⏳</span> Correction en cours...</>
                    ) : (
                      <>✨ Corriger &amp; améliorer (IA)</>
                    )}
                  </button>

                  <button onClick={() => {
                    navigator.clipboard.writeText(`Objet: ${finalMailModal.subject}\n\n${finalMailModal.body}`);
                    setFinalMailCopied(true);
                    setTimeout(() => setFinalMailCopied(false), 2000);
                  }}
                    style={{ padding: "8px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid #2a2a2e", borderRadius: 10, color: finalMailCopied ? "#22c55e" : "#888", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    {finalMailCopied ? "✓ Copié !" : "📋 Copier le mail"}
                  </button>

                  {/* Quick template switcher */}
                  {isSel && (
                    <button onClick={() => {
                      const tpl = type === "agency"
                        ? `Bonjour,\n\nJe vous confirme que ${fullName} a été retenu(e) pour le rôle de ${role} dans le projet "${state.projectName || ""}".\n\nMerci de bien vouloir nous transmettre les disponibilités de votre artiste pour les prochaines étapes.\n\nCordialement,\n${authUser?.firstName || "La direction de casting"}`
                        : `Bonjour ${fullName},\n\nJ'ai le plaisir de vous annoncer que vous avez été retenu(e) pour le rôle de ${role} dans le projet "${state.projectName || ""}".\n\nNous reviendrons vers vous très prochainement avec les détails.\n\nFélicitations,\n${authUser?.firstName || "La direction de casting"}`;
                      setFinalMailModal(prev => ({ ...prev, body: tpl }));
                    }}
                      style={{ padding: "8px 16px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 10, color: "#22c55e", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      ↻ Template "Retenu"
                    </button>
                  )}
                  {!isSel && !isMaybe && (
                    <button onClick={() => {
                      const tpl = type === "agency"
                        ? `Bonjour,\n\nJe vous remercie pour la proposition de ${fullName} pour le rôle de ${role} dans "${state.projectName || ""}".\n\nNous n'avons malheureusement pas retenu sa candidature pour ce projet. Nous pensons à votre artiste pour de futures opportunités.\n\nCordialement,\n${authUser?.firstName || "La direction de casting"}`
                        : `Bonjour ${fullName},\n\nMerci pour votre passage au casting pour "${state.projectName || ""}".\n\nNous avons fait le choix de nous orienter vers un autre profil. Votre talent a été apprécié et nous espérons travailler ensemble prochainement.\n\nCordialement,\n${authUser?.firstName || "La direction de casting"}`;
                      setFinalMailModal(prev => ({ ...prev, body: tpl }));
                    }}
                      style={{ padding: "8px 16px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 10, color: "#ef4444", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      ↻ Template "Non retenu"
                    </button>
                  )}
                </div>
              </div>

              {/* Footer actions */}
              <div style={{ padding: "16px 28px 22px", borderTop: "1px solid #1e1e22", display: "flex", gap: 10, justifyContent: "flex-end", flexShrink: 0 }}>
                <button onClick={() => setFinalMailModal(null)}
                  style={{ padding: "12px 24px", background: "rgba(255,255,255,0.03)", border: "1px solid #2a2a2e", borderRadius: 12, color: "#888", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  Annuler
                </button>
                <button onClick={() => {
                  window.open(`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(email)}&su=${encodeURIComponent(finalMailModal.subject)}&body=${encodeURIComponent(finalMailModal.body)}`, "_blank");
                  setState(p => ({ ...p, emailLog: [...(p.emailLog || []), {
                    id: Date.now().toString(36), to: email, toName: fullName,
                    subject: finalMailModal.subject, sentAt: new Date().toISOString(), role, type: isSel ? "Retenu" : isMaybe ? "Suivi" : "Non retenu"
                  }] }));
                  setFinalMailModal(null);
                }}
                  style={{
                    padding: "12px 28px", background: "linear-gradient(135deg, #EA4335, #c5221f)",
                    border: "none", borderRadius: 12, color: "#fff", fontSize: 13,
                    fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                    boxShadow: "0 4px 16px rgba(234,67,53,0.3)",
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round"/><path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Envoyer via Gmail
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===== CASTING DETAIL MODAL ===== */}
      {castingDetailProfile && (() => {
        const p = castingDetailProfile;
        const fullName = [p.firstName, p.name].filter(Boolean).join(" ") || "Sans nom";
        const session = state.castingSessions[p.id] || { passStatus: "not_yet", liveNotes: "", castingVideos: [] };
        const rc = getRoleColor(p._role || "");
        return (
          <div onClick={() => setCastingDetailProfile(null)} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 700, maxHeight: "90vh", background: "#141416", borderRadius: 20, border: "1px solid #2a2a2e", overflow: "auto" }}>
              {/* Top: Photo + Main info */}
              <div style={{ display: "flex", gap: 20, padding: "24px 28px", borderBottom: "1px solid #1e1e22" }}>
                <div style={{ width: 100, height: 130, borderRadius: 12, overflow: "hidden", background: "#0c0c0e", flexShrink: 0 }}>
                  {p.photos?.[0] ? <img src={p.photos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: 32 }}>◎</div>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <h3 style={{ fontSize: 20, fontWeight: 800, color: "#f0f0f0", fontFamily: "'Playfair Display',serif" }}>{fullName}</h3>
                    <button onClick={() => setCastingDetailProfile(null)} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 20 }}>×</button>
                  </div>
                  <span style={{ fontSize: 11, color: rc.color, background: rc.bg, padding: "3px 10px", borderRadius: 6, fontWeight: 600, border: `1px solid ${rc.border}` }}>{p._role}</span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 20px", marginTop: 14, fontSize: 12, color: "#bbb" }}>
                    {p.age && <div><span style={{ color: "#666" }}>Âge :</span> {p.age} ans</div>}
                    {p.height && <div><span style={{ color: "#666" }}>Taille :</span> {p.height}</div>}
                    {p.measurements && <div><span style={{ color: "#666" }}>Mensurations :</span> {p.measurements}</div>}
                    {p.hairColor && <div><span style={{ color: "#666" }}>Cheveux :</span> {p.hairColor}</div>}
                    {p.agency && <div><span style={{ color: "#666" }}>Agence :</span> {p.agency}</div>}
                    {p.email && <div><span style={{ color: "#666" }}>Email :</span> {p.email}</div>}
                    {p.phone && <div><span style={{ color: "#666" }}>Tél :</span> {p.phone}</div>}
                    {p.agencyEmail && <div><span style={{ color: "#666" }}>Email agence :</span> {p.agencyEmail}</div>}
                  </div>
                </div>
              </div>

              {/* Editable notes */}
              <div style={{ padding: "20px 28px" }}>
                <label style={{ fontSize: 10, color: "#888", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>📝 Notes de casting</label>
                <textarea value={session.liveNotes || ""} onChange={e => updateCastingSession(p.id, { liveNotes: e.target.value })} rows={4} placeholder="Impressions, jeu, énergie..."
                  style={{ width: "100%", padding: "12px 14px", background: "#0c0c0e", border: "1px solid #2a2a2e", borderRadius: 10, color: "#e0e0e0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none", resize: "vertical", lineHeight: 1.6 }} />
              </div>

              {/* Videos */}
              <div style={{ padding: "0 28px 20px" }}>
                <label style={{ fontSize: 10, color: "#888", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>🎥 Vidéos & Selftapes</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {(session.castingVideos || []).map((v, vi) => (
                    <div key={vi} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#0c0c0e", borderRadius: 8, border: "1px solid #2a2a2e" }}>
                      <button onClick={() => setCastingVideoModal(v.url)} style={{ fontSize: 10, color: "#fb923c", background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.2)", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}>▶ {v.name || `Vidéo ${vi+1}`}</button>
                      <button onClick={() => removeCastingVideo(p.id, vi)} style={{ fontSize: 12, color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}>✕</button>
                    </div>
                  ))}
                  {(p.selftapeLinks || []).map((link, li) => (
                    <a key={`st${li}`} href={link} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "#60a5fa", background: "rgba(59,130,246,0.08)", padding: "8px 12px", borderRadius: 8, textDecoration: "none", border: "1px solid rgba(59,130,246,0.15)" }}>▶ Selftape {li + 1}</a>
                  ))}
                  <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "rgba(255,255,255,0.02)", border: "1px dashed #333", borderRadius: 8, cursor: "pointer", fontSize: 11, color: "#555" }}>
                    <input type="file" accept="video/*" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) addCastingVideo(p.id, e.target.files[0]); }} />
                    + Ajouter vidéo
                  </label>
                </div>
              </div>

              {/* Edit profile button */}
              <div style={{ padding: "16px 28px 24px", borderTop: "1px solid #1e1e22", display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => { setCastingDetailProfile(null); setActiveRole(p._role); setEditingProfile(p); setModalOpen(true); }}
                  style={{ padding: "10px 20px", background: "rgba(201,164,74,0.08)", border: "1px solid rgba(201,164,74,0.2)", borderRadius: 10, color: "#c9a44a", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  ✏ Modifier la fiche
                </button>
                <button onClick={() => setCastingDetailProfile(null)}
                  style={{ padding: "10px 20px", background: "rgba(255,255,255,0.03)", border: "1px solid #2a2a2e", borderRadius: 10, color: "#888", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  Fermer
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===== INVITE MODAL ===== */}
      {inviteModal && (() => {
        const { day, slot, profile } = inviteModal;
        const fullName = [profile?.firstName, profile?.name].filter(Boolean).join(" ") || "Acteur";
        const email = profile?.email || profile?.agencyEmail || "";
        return (
          <div onClick={() => setInviteModal(null)} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 640, maxHeight: "90vh", background: "#141416", borderRadius: 20, border: "1px solid #2a2a2e", overflow: "auto" }}>
              {/* Header */}
              <div style={{ padding: "24px 28px 16px", borderBottom: "1px solid #1e1e22" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: "#f0f0f0", fontFamily: "'Playfair Display', serif" }}>
                    📨 Convocation casting
                  </h3>
                  <button onClick={() => setInviteModal(null)} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 20 }}>×</button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
                  <div style={{ width: 40, height: 48, borderRadius: 8, overflow: "hidden", background: "#0c0c0e" }}>
                    {profile?.photos?.[0] ? <img src={profile.photos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#333" }}>◎</div>}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#f0f0f0" }}>{fullName}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>
                      {email} · {slot.role || ""} · {slot.time} ({slot.duration} min)
                    </div>
                  </div>
                </div>
              </div>

              {/* Mail body */}
              <div style={{ padding: "20px 28px" }}>
                <label style={{ display: "block", fontSize: 10, color: "#c9a44a", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                  ✉ Corps du mail (modifiable)
                </label>
                <textarea value={inviteMailBody} onChange={e => setInviteMailBody(e.target.value)}
                  rows={8}
                  style={{
                    width: "100%", padding: "14px 16px", background: "#0c0c0e", border: "1px solid #2a2a2e",
                    borderRadius: 12, color: "#e0e0e0", fontSize: 13, fontFamily: "'DM Sans',sans-serif",
                    outline: "none", resize: "vertical", lineHeight: 1.6,
                  }}
                  onFocus={e => e.target.style.borderColor = "#c9a44a"} onBlur={e => e.target.style.borderColor = "#2a2a2e"}
                />
              </div>

              {/* Info block */}
              <div style={{ padding: "0 28px 20px" }}>
                <label style={{ display: "block", fontSize: 10, color: "#a855f7", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                  📋 Informations pratiques (copier-coller)
                </label>
                <textarea value={inviteInfoBlock} onChange={e => setInviteInfoBlock(e.target.value)}
                  rows={10}
                  style={{
                    width: "100%", padding: "14px 16px", background: "#0c0c0e", border: "1px dashed #2a2a2e",
                    borderRadius: 12, color: "#ccc", fontSize: 12, fontFamily: "'DM Sans',sans-serif",
                    outline: "none", resize: "vertical", lineHeight: 1.6,
                  }}
                  onFocus={e => e.target.style.borderColor = "#a855f7"} onBlur={e => e.target.style.borderColor = "#2a2a2e"}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button onClick={() => { navigator.clipboard.writeText(inviteInfoBlock); }}
                    style={{ padding: "6px 14px", background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 8, color: "#a855f7", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    📋 Copier les infos
                  </button>
                  <button onClick={() => { navigator.clipboard.writeText(inviteMailBody + "\n\n" + inviteInfoBlock); }}
                    style={{ padding: "6px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid #2a2a2e", borderRadius: 8, color: "#888", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    📋 Copier tout (mail + infos)
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div style={{ padding: "16px 28px 24px", borderTop: "1px solid #1e1e22", display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setInviteModal(null)}
                  style={{ padding: "12px 24px", background: "rgba(255,255,255,0.03)", border: "1px solid #2a2a2e", borderRadius: 12, color: "#888", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  Annuler
                </button>
                <button onClick={() => {
                  const calUrl = makeCalendarUrl(day, slot, profile);
                  window.open(calUrl, "_blank");
                }}
                  style={{ padding: "12px 20px", background: "rgba(66,133,244,0.08)", border: "1px solid rgba(66,133,244,0.2)", borderRadius: 12, color: "#4285F4", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  📅 Google Agenda
                </button>
                <button onClick={sendInviteFromModal}
                  style={{
                    padding: "12px 28px", background: "linear-gradient(135deg, #EA4335, #c5221f)",
                    border: "none", borderRadius: 12, color: "#fff", fontSize: 13,
                    fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                    boxShadow: "0 4px 16px rgba(234,67,53,0.3)",
                  }}>
                  ✉ Ouvrir dans Gmail
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Acting Notes Modal */}
      <Modal
        open={!!actingNotesModal}
        onClose={() => setActingNotesModal(null)}
        title="📝 Notes jeu d'acteur"
        width={600}
      >
        {actingNotesModal && (() => {
          const day = state.castingDays.find(d => d.id === actingNotesModal.dayId);
          const slot = day?.slots.find(s => s.id === actingNotesModal.slotId);
          const profile = slot ? findProfile(slot.profileId) : null;
          if (!slot) return null;
          return (
            <div>
              {/* Profile summary */}
              <div style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                background: "rgba(255,255,255,0.02)", borderRadius: 10, marginBottom: 20,
                border: "1px solid #1e1e22",
              }}>
                <div style={{ width: 40, height: 50, borderRadius: 6, overflow: "hidden", background: "#0c0c0e", flexShrink: 0 }}>
                  {profile?.photos?.[0] ? (
                    <img src={profile.photos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#333" }}>◎</div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0" }}>{profile?.name || "—"}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>
                    {slot.role || profile?._role} · Passage à {slot.time}
                  </div>
                </div>
              </div>

              {/* Notes text */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11, color: "#888", marginBottom: 6, fontWeight: 600 }}>
                  Consignes / Scène à jouer
                </label>
                <textarea
                  value={slot.actingNotes}
                  onChange={e => updateSlot(actingNotesModal.dayId, actingNotesModal.slotId, { actingNotes: e.target.value })}
                  placeholder="Décrivez la scène, les émotions, les indications de jeu, le texte à préparer..."
                  rows={8}
                  style={{
                    width: "100%", padding: "12px 14px", background: "#0c0c0e", border: "1px solid #2a2a2e",
                    borderRadius: 10, color: "#e0e0e0", fontSize: 13, fontFamily: "'DM Sans', sans-serif",
                    outline: "none", resize: "vertical", lineHeight: 1.6,
                  }}
                  onFocus={e => e.target.style.borderColor = "#a855f755"}
                  onBlur={e => e.target.style.borderColor = "#2a2a2e"}
                />
              </div>

              {/* File upload */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11, color: "#888", marginBottom: 6, fontWeight: 600 }}>
                  📎 Fichier texte à apprendre (PDF, Word, texte...)
                </label>
                {slot.actingFileName ? (
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px", background: "rgba(168,85,247,0.06)",
                    border: "1px solid rgba(168,85,247,0.2)", borderRadius: 10,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 18 }}>📄</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#a855f7" }}>{slot.actingFileName}</div>
                        <div style={{ fontSize: 10, color: "#666" }}>Fichier attaché</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {slot.actingFile && (
                        <button
                          onClick={() => {
                            const a = document.createElement("a");
                            a.href = slot.actingFile; a.download = slot.actingFileName; a.click();
                          }}
                          style={{
                            padding: "4px 10px", background: "rgba(168,85,247,0.1)",
                            border: "1px solid rgba(168,85,247,0.3)", borderRadius: 6,
                            color: "#a855f7", cursor: "pointer", fontSize: 10, fontFamily: "inherit", fontWeight: 600,
                          }}
                        >
                          Télécharger
                        </button>
                      )}
                      <button
                        onClick={() => updateSlot(actingNotesModal.dayId, actingNotesModal.slotId, { actingFile: null, actingFileName: "" })}
                        style={{
                          padding: "4px 10px", background: "rgba(239,68,68,0.08)",
                          border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6,
                          color: "#ef4444", cursor: "pointer", fontSize: 10, fontFamily: "inherit", fontWeight: 600,
                        }}
                      >
                        Retirer
                      </button>
                    </div>
                  </div>
                ) : (
                  <label style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    padding: "16px", background: "rgba(255,255,255,0.02)",
                    border: "1px dashed #333", borderRadius: 10, cursor: "pointer",
                    transition: "all 0.2s", color: "#666", fontSize: 12,
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "#a855f7"; e.currentTarget.style.color = "#a855f7"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "#333"; e.currentTarget.style.color = "#666"; }}
                  >
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,.rtf"
                      style={{ display: "none" }}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const url = URL.createObjectURL(file);
                          updateSlot(actingNotesModal.dayId, actingNotesModal.slotId, { actingFile: url, actingFileName: file.name });
                        }
                      }}
                    />
                    📎 Cliquez pour joindre un fichier (PDF, Word, texte)
                  </label>
                )}
              </div>

              {/* Close */}
              <button
                onClick={() => setActingNotesModal(null)}
                style={{
                  width: "100%", padding: "12px", background: "rgba(168,85,247,0.1)",
                  border: "1px solid rgba(168,85,247,0.3)", borderRadius: 10,
                  color: "#a855f7", cursor: "pointer", fontSize: 13, fontWeight: 600,
                  fontFamily: "inherit",
                }}
              >
                ✓ Fermer
              </button>
            </div>
          );
        })()}
      </Modal>

      {/* ===== VIDEO PLAYER MODAL ===== */}
      {castingVideoModal && (
        <div
          onClick={() => setCastingVideoModal(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.85)", display: "flex",
            alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{
            width: "80%", maxWidth: 900, background: "#111114",
            borderRadius: 16, overflow: "hidden", border: "1px solid #2a2a2e",
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 20px", borderBottom: "1px solid #1e1e22",
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#fb923c" }}>🎬 Vidéo de casting</span>
              <button onClick={() => setCastingVideoModal(null)} style={{
                background: "none", border: "none", color: "#666", fontSize: 20,
                cursor: "pointer", fontFamily: "inherit",
              }}>×</button>
            </div>
            <video
              src={castingVideoModal}
              controls
              autoPlay
              style={{ width: "100%", maxHeight: "70vh", background: "#000" }}
            />
            <div style={{ padding: "10px 20px", display: "flex", gap: 8 }}>
              <a
                href={castingVideoModal}
                download
                style={{
                  padding: "8px 16px", background: "rgba(251,146,60,0.08)",
                  border: "1px solid rgba(251,146,60,0.2)", borderRadius: 8,
                  color: "#fb923c", fontSize: 12, fontWeight: 600,
                  textDecoration: "none", fontFamily: "inherit",
                }}
              >
                ⬇ Télécharger
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ===== PRINT VIEW OVERLAY ===== */}
      {printView && (() => {
        const day = state.castingDays.find(d => d.id === activeCastingDay);
        if (!day) return null;
        const dayDate = day.date ? new Date(day.date + "T00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Date à définir";
        const usedRoles = [...new Set(day.slots.map(s => s.role || findProfile(s.profileId)?._role).filter(Boolean))];

        return (
          <div id="print-overlay" style={{
            position: "fixed", inset: 0, zIndex: 10000, background: "#fff",
            overflow: "auto", color: "#222", fontFamily: "'Helvetica Neue', Arial, sans-serif",
          }}>
            <style>{`
              @media print {
                #print-no-print { display: none !important; }
                #print-overlay { position: static !important; }
                * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                @page { size: A4 landscape; margin: 10mm; }
              }
            `}</style>

            {/* Top bar - hidden when printing */}
            <div id="print-no-print" style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 24px", background: "#f3f4f6", borderBottom: "1px solid #ddd",
              position: "sticky", top: 0, zIndex: 1,
            }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#333" }}>Aperçu impression — {dayDate}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => window.print()}
                  style={{
                    padding: "8px 20px", background: "#7c3aed", color: "#fff",
                    border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  🖨️ Imprimer / Enregistrer PDF
                </button>
                <button
                  onClick={() => setPrintView(false)}
                  style={{
                    padding: "8px 20px", background: "#fff", color: "#666",
                    border: "1px solid #ddd", borderRadius: 8, fontSize: 13,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  ← Retour
                </button>
              </div>
            </div>

            {/* Print content */}
            <div style={{ padding: "28px 36px", maxWidth: 1200, margin: "0 auto" }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4, color: "#111" }}>
                📋 {state.projectName || "Casting"} — Planning
              </h1>
              <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>
                {dayDate}{day.location ? ` · 📍 ${day.location}` : ""}{day.notes ? ` · ${day.notes}` : ""}
              </div>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 16 }}>
                {day.slots.length} passage{day.slots.length !== 1 ? "s" : ""}
                {day.slots.length > 0 && ` · ${day.slots[0]?.time} → ${(() => {
                  const last = day.slots[day.slots.length - 1];
                  if (!last?.time) return "";
                  const [h, m] = last.time.split(":").map(Number);
                  const end = h * 60 + m + (parseInt(last.duration) || 15);
                  return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
                })()}`}
              </div>

              {/* Legend */}
              {usedRoles.length > 1 && (
                <div style={{ display: "flex", gap: 18, marginBottom: 18, flexWrap: "wrap" }}>
                  {usedRoles.map(r => {
                    const rc = getRoleColor(r);
                    return (
                      <div key={r} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 14, height: 14, borderRadius: 3, background: rc.color }} />
                        <span style={{ fontSize: 12, color: "#444", fontWeight: 600 }}>{r}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Table */}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ background: "#f3f4f6" }}>
                    {["Heure", "Durée", "Nom", "Mensurations", "Rôle", "Dispo", "Contact", "Notes jeu d'acteur"].map(h => (
                      <th key={h} style={{
                        fontWeight: 700, textTransform: "uppercase", fontSize: 9, letterSpacing: "0.8px",
                        textAlign: "left", padding: "10px 10px", borderBottom: "2px solid #ccc",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {day.slots.map((s, i) => {
                    const p = findProfile(s.profileId);
                    const av = SLOT_AVAILABILITY[s.availability || "pending"];
                    const avKey = s.availability || "pending";
                    const roleName = s.role || p?._role || "";
                    const rc = getRoleColor(roleName);
                    const mens = [p?.age ? p.age + " ans" : null, p?.height, p?.measurements].filter(Boolean).join(" · ");
                    const badgeStyles = {
                      dispo: { background: "#dcfce7", color: "#166534" },
                      not_dispo: { background: "#fee2e2", color: "#991b1b" },
                      pending: { background: "#fef3c7", color: "#92400e" },
                    };
                    const bs = badgeStyles[avKey] || badgeStyles.pending;

                    return (
                      <tr key={s.id} style={{ borderLeft: `4px solid ${rc.color}`, borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "10px", fontWeight: 700, fontSize: 13 }}>{s.time}</td>
                        <td style={{ padding: "10px", color: "#666" }}>{s.duration}min</td>
                        <td style={{ padding: "10px" }}>
                          <div style={{ fontWeight: 700 }}>{[p?.firstName, p?.name].filter(Boolean).join(" ") || "—"}</div>
                          {p?.agency && <div style={{ fontSize: 9, color: "#888" }}>{p.agency}</div>}
                        </td>
                        <td style={{ padding: "10px", fontSize: 10, color: "#666" }}>{mens || "—"}</td>
                        <td style={{ padding: "10px", fontWeight: 700, color: rc.color }}>{roleName || "—"}</td>
                        <td style={{ padding: "10px" }}>
                          <span style={{
                            display: "inline-block", padding: "3px 8px", borderRadius: 4,
                            fontWeight: 600, fontSize: 10, ...bs,
                          }}>{av.label}</span>
                        </td>
                        <td style={{ padding: "10px", fontSize: 10, color: "#555", lineHeight: 1.6 }}>
                          {p?.email && <div>✉ {p.email}</div>}
                          {p?.phone && <div>☎ {p.phone}</div>}
                          {p?.agencyEmail && <div>✉ Agence: {p.agencyEmail}</div>}
                          {!p?.email && !p?.phone && !p?.agencyEmail && "—"}
                        </td>
                        <td style={{ padding: "10px", fontSize: 10, color: "#444", maxWidth: 200 }}>
                          {s.actingNotes || "—"}
                          {s.actingFileName && <div style={{ marginTop: 2, color: "#7c3aed" }}>📎 {s.actingFileName}</div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* IMPORT FROM FICHIER CASTING MODAL */}
      {importFromFileModal && (
        <div onClick={() => setImportFromFileModal(false)} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "90%", maxWidth: 700, maxHeight: "80vh", overflow: "auto", background: "#141416", borderRadius: 16, border: "1px solid #2a2a2e", padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#f0f0f0", fontFamily: "'Playfair Display', serif" }}>
                  📁 Importer du fichier casting
                </h3>
                <div style={{ fontSize: 11, color: "#888" }}>
                  Rôle : <span style={{ color: "#c9a44a", fontWeight: 600 }}>{activeRole}</span> — {actorDatabase.length} acteur{actorDatabase.length !== 1 ? "s" : ""} disponible{actorDatabase.length !== 1 ? "s" : ""}
                </div>
              </div>
              <button onClick={() => setImportFromFileModal(false)}
                style={{ background: "none", border: "none", color: "#555", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            <input value={importFileSearch} onChange={e => setImportFileSearch(e.target.value)} placeholder="🔍 Rechercher..."
              style={{ width: "100%", padding: "10px 14px", background: "#0c0c0e", border: "1px solid #2a2a2e", borderRadius: 10, color: "#e0e0e0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none", marginBottom: 14 }}
              onFocus={e => e.target.style.borderColor="#a855f7"} onBlur={e => e.target.style.borderColor="#2a2a2e"} />

            {(() => {
              const existingIds = new Set((state.profiles[activeRole] || []).flatMap(p => [p.id, p._sourceActorId].filter(Boolean)));
              const filtered = actorDatabase.filter(a => {
                const fullName = [a.firstName, a.name].filter(Boolean).join(" ").toLowerCase();
                return !importFileSearch || fullName.includes(importFileSearch.toLowerCase()) || (a.agency || "").toLowerCase().includes(importFileSearch.toLowerCase());
              });
              return filtered.length === 0 ? (
                <div style={{ padding: "30px", textAlign: "center", color: "#555", fontSize: 12 }}>Aucun résultat</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {filtered.map(actor => {
                    const alreadyIn = existingIds.has(actor.id);
                    return (
                      <div key={actor.id} style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                        background: "#111114", borderRadius: 12, border: "1px solid #1e1e22",
                        opacity: alreadyIn ? 0.4 : 1,
                      }}>
                        <div style={{ width: 40, height: 50, borderRadius: 6, overflow: "hidden", background: "#0c0c0e", flexShrink: 0 }}>
                          {actor.photos?.[0] ? <img src={actor.photos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: 14 }}>◎</div>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#f0f0f0" }}>
                            {actor._favorite && <span style={{ color: "#f59e0b", marginRight: 4 }}>★</span>}
                            {[actor.firstName, actor.name].filter(Boolean).join(" ") || "Sans nom"}
                          </div>
                          <div style={{ fontSize: 10, color: "#888" }}>
                            {[actor.profileType, actor.age ? actor.age + " ans" : null, actor.height, actor.agency].filter(Boolean).join(" · ")}
                          </div>
                          {actor.actingLevel > 0 && <div style={{ fontSize: 10, marginTop: 2 }}>{[1,2,3,4,5].map(n => <span key={n} style={{ color: n <= actor.actingLevel ? "#c9a44a" : "#2a2a2e" }}>★</span>)}</div>}
                        </div>
                        {alreadyIn ? (
                          <span style={{ fontSize: 10, color: "#555", fontWeight: 600 }}>Déjà ajouté</span>
                        ) : (
                          <button onClick={() => { importActorToCurrentRole(actor); }}
                            style={{
                              padding: "6px 14px", background: "rgba(34,197,94,0.08)",
                              border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8,
                              color: "#22c55e", fontSize: 11, fontWeight: 600, cursor: "pointer",
                              fontFamily: "inherit", whiteSpace: "nowrap",
                            }}>
                            + Ajouter
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* COMPARE PANEL */}
      {compareMode && compareSelection.length >= 2 && (() => {
        const profiles = compareSelection.map(id => (state.profiles[activeRole] || []).find(p => p.id === id)).filter(Boolean);
        if (profiles.length < 2) return null;
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: "95%", maxWidth: 900, maxHeight: "90vh", overflow: "auto", background: "#141416", borderRadius: 20, border: "1px solid #2a2a2e", padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#f0f0f0", fontFamily: "'Playfair Display', serif" }}>⚖ Comparaison — {activeRole}</h3>
                <button onClick={() => { setCompareMode(false); setCompareSelection([]); }}
                  style={{ background: "none", border: "none", color: "#555", fontSize: 20, cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${profiles.length}, 1fr)`, gap: 16 }}>
                {profiles.map(p => (
                  <div key={p.id} style={{ background: "#111114", borderRadius: 14, border: "1px solid #1e1e22", overflow: "hidden" }}>
                    <div style={{ height: 200, background: "#0c0c0e" }}>
                      {p.photos?.[0] ? <img src={p.photos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: 40 }}>◎</div>}
                    </div>
                    <div style={{ padding: "14px" }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#f0f0f0", marginBottom: 8 }}>{[p.firstName, p.name].filter(Boolean).join(" ") || "Sans nom"}</div>
                      {[
                        { label: "Type", value: p.profileType },
                        { label: "Âge", value: p.age ? p.age + " ans" : null },
                        { label: "Taille", value: p.height },
                        { label: "Mensurations", value: p.measurements },
                        { label: "Cheveux", value: p.hairColor },
                        { label: "Agence", value: p.agency },
                        { label: "Source", value: p.source },
                      ].filter(f => f.value).map(f => (
                        <div key={f.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #1a1a1e", fontSize: 11 }}>
                          <span style={{ color: "#666", fontWeight: 600 }}>{f.label}</span>
                          <span style={{ color: "#ddd" }}>{f.value}</span>
                        </div>
                      ))}
                      {p.actingLevel > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #1a1a1e", fontSize: 11 }}>
                          <span style={{ color: "#666", fontWeight: 600 }}>Niveau</span>
                          <span>{[1,2,3,4,5].map(n => <span key={n} style={{ color: n <= p.actingLevel ? "#c9a44a" : "#2a2a2e" }}>★</span>)}</span>
                        </div>
                      )}
                      {getChoice(p.id) && (
                        <div style={{ marginTop: 8 }}><SelectionBadge selection={{ ...(state.selections[p.id] || {}), choice: getChoice(p.id) }} /></div>
                      )}
                      {state.selections[p.id]?.comment && (
                        <div style={{ marginTop: 6, fontSize: 10, color: "#999", fontStyle: "italic", padding: "4px 8px", background: "#0c0c0e", borderRadius: 4 }}>💬 {state.selections[p.id].comment}</div>
                      )}
                      {p.notes && <div style={{ marginTop: 6, fontSize: 10, color: "#888", lineHeight: 1.4 }}>📝 {p.notes}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* MOVE PROFILE MODAL */}
      {moveProfileModal && (
        <div onClick={() => setMoveProfileModal(null)} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "90%", maxWidth: 380, background: "#141416", borderRadius: 16, border: "1px solid #2a2a2e", padding: "24px" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#f0f0f0", marginBottom: 4, fontFamily: "'Playfair Display', serif" }}>↗ Déplacer vers un rôle</h3>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 16 }}>{[moveProfileModal.profile?.firstName, moveProfileModal.profile?.name].filter(Boolean).join(" ")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {state.roles.filter(r => r !== moveProfileModal.fromRole).map(role => (
                <button key={role} onClick={() => moveProfileToRole(moveProfileModal.profile, moveProfileModal.fromRole, role)}
                  style={{
                    padding: "12px 16px", background: "#111114", border: "1px solid #1e1e22",
                    borderRadius: 10, cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                    transition: "border-color 0.2s", color: "#f0f0f0", fontSize: 13, fontWeight: 600,
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "#c9a44a44"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "#1e1e22"}>
                  🎭 {role}
                </button>
              ))}
            </div>
            <button onClick={() => setMoveProfileModal(null)}
              style={{ marginTop: 12, padding: "8px 16px", background: "transparent", border: "1px solid #333", borderRadius: 8, color: "#888", fontSize: 12, cursor: "pointer", fontFamily: "inherit", width: "100%" }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* SHARE PROJECT MODAL */}
      {shareModalOpen && state._shareCode && (
        <div onClick={() => { setShareModalOpen(false); setShareCopied(false); setShareLinkCopied(false); }} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "90%", maxWidth: 480, background: "#141416", borderRadius: 20, border: "1px solid #2a2a2e", padding: "32px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔗</div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: "#f0f0f0", fontFamily: "'Playfair Display', serif", marginBottom: 6 }}>
              Partager ce projet
            </h3>
            <p style={{ fontSize: 13, color: "#888", marginBottom: 24, lineHeight: 1.5 }}>
              Envoyez ce lien + mot de passe au réalisateur, à la production ou à l'agence.<br/>Ils pourront consulter les profils, voter et commenter.
            </p>
            
            {/* Link */}
            <div style={{ marginBottom: 16, textAlign: "left" }}>
              <div style={{ fontSize: 10, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>🌐 Lien de partage</div>
              <div style={{ padding: "12px 16px", background: "#0c0c0e", borderRadius: 10, border: "1px solid #2a2a2e", fontSize: 12, color: "#60a5fa", wordBreak: "break-all", fontFamily: "monospace" }}>
                {window.location.origin}?share={state._shareCode}
              </div>
            </div>
            
            {/* Password */}
            <div style={{ marginBottom: 20, textAlign: "left" }}>
              <div style={{ fontSize: 10, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>🔑 Mot de passe</div>
              <div style={{ padding: "14px 18px", background: "#0c0c0e", borderRadius: 10, border: "2px dashed #c9a44a44", fontSize: 28, fontWeight: 800, letterSpacing: "0.25em", color: "#c9a44a", fontFamily: "'DM Sans', sans-serif", textAlign: "center", userSelect: "all" }}>
                {state._sharePassword || "N/A"}
              </div>
            </div>
            
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={() => {
                const text = `📽️ Casting — ${state.projectName}\n\n🌐 Lien : ${window.location.origin}?share=${state._shareCode}\n🔑 Mot de passe : ${state._sharePassword}\n\nOuvrez le lien et entrez le mot de passe pour consulter les profils et voter.`;
                navigator.clipboard.writeText(text);
                setShareCopied(true); setTimeout(() => setShareCopied(false), 3000);
              }}
                style={{
                  padding: "12px 24px", background: shareCopied ? "rgba(34,197,94,0.1)" : "rgba(201,164,74,0.08)",
                  border: `1px solid ${shareCopied ? "rgba(34,197,94,0.3)" : "rgba(201,164,74,0.2)"}`, borderRadius: 10,
                  color: shareCopied ? "#22c55e" : "#c9a44a", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                }}>
                {shareCopied ? "✓ Tout copié !" : "📋 Copier lien + mot de passe"}
              </button>
            </div>
            
            {state._guestVotes && Object.keys(state._guestVotes).length > 0 && (
              <div style={{ marginTop: 16, padding: "10px 14px", background: "rgba(96,165,250,0.06)", borderRadius: 8, border: "1px solid rgba(96,165,250,0.15)" }}>
                <span style={{ fontSize: 11, color: "#60a5fa", fontWeight: 600 }}>
                  📊 {Object.keys(state._guestVotes).length} vote{Object.keys(state._guestVotes).length !== 1 ? "s" : ""} reçu{Object.keys(state._guestVotes).length !== 1 ? "s" : ""} · Synchronisation en temps réel
                </span>
              </div>
            )}
            
            <div style={{ marginTop: 20, fontSize: 11, color: "#555", lineHeight: 1.6 }}>
              <strong style={{ color: "#999" }}>Comment ça marche :</strong><br />
              1. Envoyez le lien + mot de passe à vos collaborateurs<br />
              2. Ils ouvrent le lien et entrent le mot de passe<br />
              3. Ils consultent les profils, votent et commentent<br />
              4. Vous voyez leurs votes en temps réel ici 🔄
            </div>
          </div>
        </div>
      )}

      {/* COPY PROFILE MODAL */}
      {copyProfileModal && (
        <div onClick={() => setCopyProfileModal(null)} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "90%", maxWidth: 380, background: "#141416", borderRadius: 16, border: "1px solid #2a2a2e", padding: "24px" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#f0f0f0", marginBottom: 4, fontFamily: "'Playfair Display', serif" }}>⊕ Copier vers un rôle</h3>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{[copyProfileModal.profile?.firstName, copyProfileModal.profile?.name].filter(Boolean).join(" ")}</div>
            <div style={{ fontSize: 10, color: "#555", marginBottom: 16 }}>Le profil restera aussi dans le rôle actuel</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {state.roles.filter(r => r !== activeRole).map(role => (
                <button key={role} onClick={() => copyProfileToRole(copyProfileModal.profile, role)}
                  style={{
                    padding: "12px 16px", background: "#111114", border: "1px solid #1e1e22",
                    borderRadius: 10, cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                    transition: "border-color 0.2s", color: "#f0f0f0", fontSize: 13, fontWeight: 600,
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "#22c55e44"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "#1e1e22"}>
                  🎭 {role}
                </button>
              ))}
            </div>
            <button onClick={() => setCopyProfileModal(null)}
              style={{ marginTop: 12, padding: "8px 16px", background: "transparent", border: "1px solid #333", borderRadius: 8, color: "#888", fontSize: 12, cursor: "pointer", fontFamily: "inherit", width: "100%" }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* PRESENTATION MODE */}
      {presentationMode && (() => {
        const profiles = state.profiles[activeRole] || [];
        if (profiles.length === 0) { setPresentationMode(false); return null; }

        if (presentationMode === "pdf") {
          return (
            <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "#fff", overflow: "auto" }}>
              <div style={{ padding: "24px 32px", maxWidth: 1000, margin: "0 auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, borderBottom: "2px solid #222", paddingBottom: 12 }}>
                  <div>
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111", fontFamily: "'Playfair Display', serif" }}>{state.projectName || "Casting"}</h1>
                    <div style={{ fontSize: 13, color: "#666" }}>Rôle : {activeRole} — {profiles.length} profil{profiles.length > 1 ? "s" : ""}</div>
                  </div>
                  <button onClick={() => setPresentationMode(false)}
                    style={{ padding: "8px 16px", background: "#111", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>✕ Fermer</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                  {profiles.map(p => (
                    <div key={p.id} style={{ border: "1px solid #ddd", borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ height: 180, background: "#f0f0f0", overflow: "hidden" }}>
                        {p.photos?.[0] ? <img src={p.photos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#bbb", fontSize: 32 }}>◎</div>}
                      </div>
                      <div style={{ padding: 12 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 3 }}>{[p.firstName, p.name].filter(Boolean).join(" ") || "Sans nom"}</div>
                        <div style={{ fontSize: 11, color: "#666", lineHeight: 1.5 }}>{[p.profileType, p.age ? p.age + " ans" : "", p.height, p.hairColor, p.agency].filter(Boolean).join(" · ")}</div>
                        {p.actingLevel > 0 && <div style={{ color: "#c9a44a", fontSize: 13, marginTop: 2 }}>{"★".repeat(p.actingLevel)}{"☆".repeat(5 - p.actingLevel)}</div>}
                        {p.notes && <div style={{ fontSize: 10, color: "#888", marginTop: 4, fontStyle: "italic" }}>{p.notes}</div>}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 20, textAlign: "center", fontSize: 11, color: "#bbb" }}>Faites une capture d'écran ou Cmd/Ctrl+P pour imprimer en PDF</div>
              </div>
            </div>
          );
        }

        // SLIDESHOW MODE
        const p = profiles[presentationIndex] || profiles[0];
        const sel = { ...(state.selections[p.id] || {}), choice: getChoice(p.id) };
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "#0a0a0c", display: "flex", flexDirection: "column" }}
            onKeyDown={e => { if (e.key === "ArrowRight" || e.key === " ") setPresentationIndex(i => Math.min(i + 1, profiles.length - 1)); if (e.key === "ArrowLeft") setPresentationIndex(i => Math.max(i - 1, 0)); if (e.key === "Escape") setPresentationMode(false); }} tabIndex={0} ref={el => el?.focus()}>
            {/* Header */}
            <div style={{ padding: "16px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1a1a1e", flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 10, color: "#c9a44a", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.15em" }}>{state.projectName} — {activeRole}</div>
                <div style={{ fontSize: 12, color: "#666" }}>{presentationIndex + 1} / {profiles.length}</div>
              </div>
              <button onClick={() => setPresentationMode(false)} style={{ background: "none", border: "1px solid #2a2a2e", borderRadius: 8, color: "#888", fontSize: 12, cursor: "pointer", padding: "8px 16px", fontFamily: "inherit" }}>✕ Fermer</button>
            </div>
            {/* Content */}
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px", gap: 40, overflow: "hidden" }}>
              <div style={{ width: "40%", maxWidth: 500, aspectRatio: "3/4", borderRadius: 16, overflow: "hidden", background: "#111114", flexShrink: 0 }}>
                {p.photos?.[0] ? <img src={p.photos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: 80 }}>◎</div>}
              </div>
              <div style={{ flex: 1, maxWidth: 450 }}>
                <h1 style={{ fontSize: 42, fontWeight: 800, color: "#f0f0f0", fontFamily: "'Playfair Display', serif", marginBottom: 12, lineHeight: 1.1 }}>
                  {[p.firstName, p.name].filter(Boolean).join(" ") || "Sans nom"}
                </h1>
                {p.profileType && <span style={{ fontSize: 13, padding: "4px 12px", background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 8, color: "#a855f7", fontWeight: 600 }}>{p.profileType}</span>}
                {p.actingLevel > 0 && <div style={{ fontSize: 28, marginTop: 12 }}>{[1,2,3,4,5].map(n => <span key={n} style={{ color: n <= p.actingLevel ? "#c9a44a" : "#2a2a2e" }}>★</span>)}</div>}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 32px", marginTop: 24 }}>
                  {[
                    { label: "Âge", value: p.age ? p.age + " ans" : null },
                    { label: "Taille", value: p.height },
                    { label: "Mensurations", value: p.measurements },
                    { label: "Cheveux", value: p.hairColor },
                    { label: "Agence", value: p.agency },
                    { label: "Source", value: p.source },
                  ].filter(f => f.value).map(f => (
                    <div key={f.label}>
                      <div style={{ fontSize: 10, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{f.label}</div>
                      <div style={{ fontSize: 18, color: "#ddd", fontWeight: 600 }}>{f.value}</div>
                    </div>
                  ))}
                </div>
                {sel?.choice && <div style={{ marginTop: 16 }}><SelectionBadge selection={sel} /></div>}
                {sel?.comment && <div style={{ marginTop: 8, fontSize: 14, color: "#999", fontStyle: "italic" }}>💬 {sel.comment}</div>}
                {p.notes && <div style={{ marginTop: 12, fontSize: 13, color: "#888", lineHeight: 1.5 }}>📝 {p.notes}</div>}
              </div>
            </div>
            {/* Navigation */}
            <div style={{ padding: "16px 32px", display: "flex", justifyContent: "center", gap: 12, borderTop: "1px solid #1a1a1e", flexShrink: 0 }}>
              <button onClick={() => setPresentationIndex(i => Math.max(i - 1, 0))} disabled={presentationIndex === 0}
                style={{ padding: "10px 24px", background: presentationIndex === 0 ? "transparent" : "rgba(255,255,255,0.03)", border: "1px solid #2a2a2e", borderRadius: 10, color: presentationIndex === 0 ? "#333" : "#ccc", fontSize: 13, fontWeight: 600, cursor: presentationIndex === 0 ? "default" : "pointer", fontFamily: "inherit" }}>← Précédent</button>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {profiles.map((_, idx) => (
                  <div key={idx} onClick={() => setPresentationIndex(idx)}
                    style={{ width: idx === presentationIndex ? 24 : 8, height: 8, borderRadius: 4, cursor: "pointer", transition: "all 0.3s", background: idx === presentationIndex ? "#c9a44a" : "#333" }} />
                ))}
              </div>
              <button onClick={() => setPresentationIndex(i => Math.min(i + 1, profiles.length - 1))} disabled={presentationIndex === profiles.length - 1}
                style={{ padding: "10px 24px", background: presentationIndex === profiles.length - 1 ? "transparent" : "rgba(255,255,255,0.03)", border: "1px solid #2a2a2e", borderRadius: 10, color: presentationIndex === profiles.length - 1 ? "#333" : "#ccc", fontSize: 13, fontWeight: 600, cursor: presentationIndex === profiles.length - 1 ? "default" : "pointer", fontFamily: "inherit" }}>Suivant →</button>
            </div>
          </div>
        );
      })()}

      {/* EMAIL TEMPLATE MODAL */}
      {emailTemplateModal && (() => {
        const p = emailTemplateModal.profile;
        const fullName = [p?.firstName, p?.name].filter(Boolean).join(" ");
        const templates = [
          { key: "convocation", label: "📩 Convocation casting", subject: `Convocation casting - ${state.projectName || "Projet"} - Rôle ${activeRole}`,
            body: `Bonjour ${fullName},\n\nNous avons le plaisir de vous convoquer pour un casting dans le cadre du projet "${state.projectName || ""}".\n\nRôle : ${activeRole}\nDate : [À COMPLÉTER]\nLieu : [À COMPLÉTER]\nHeure : [À COMPLÉTER]\n\nMerci de confirmer votre disponibilité.\n\nCordialement,\n[Votre nom]` },
          { key: "confirmation", label: "✅ Confirmation sélection", subject: `Confirmation - ${state.projectName || "Projet"} - Rôle ${activeRole}`,
            body: `Bonjour ${fullName},\n\nNous avons le plaisir de vous informer que vous avez été retenu(e) pour le rôle de ${activeRole} dans le projet "${state.projectName || ""}".\n\nLes prochaines étapes vous seront communiquées très prochainement.\n\nFélicitations !\n\nCordialement,\n[Votre nom]` },
          { key: "refus", label: "❌ Refus poli", subject: `Suite à votre casting - ${state.projectName || "Projet"}`,
            body: `Bonjour ${fullName},\n\nNous vous remercions pour votre participation au casting pour le projet "${state.projectName || ""}".\n\nAprès réflexion, nous avons fait le choix de nous orienter vers un autre profil pour le rôle de ${activeRole}. Ce n'est en aucun cas un jugement sur votre talent.\n\nNous espérons avoir l'occasion de collaborer à l'avenir.\n\nBien cordialement,\n[Votre nom]` },
          { key: "relance", label: "🔔 Relance", subject: `Relance - Casting ${state.projectName || "Projet"}`,
            body: `Bonjour ${fullName},\n\nJe me permets de revenir vers vous concernant le casting pour le projet "${state.projectName || ""}" (rôle : ${activeRole}).\n\nAvez-vous eu l'occasion de prendre connaissance de notre précédent message ?\n\nMerci de nous faire un retour dès que possible.\n\nCordialement,\n[Votre nom]` },
        ];
        return (
          <div onClick={() => { setEmailTemplateModal(null); setEmailActiveTemplate(null); setEmailCopied(false); }} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div onClick={e => e.stopPropagation()} style={{ width: "90%", maxWidth: 650, maxHeight: "85vh", overflow: "auto", background: "#141416", borderRadius: 16, border: "1px solid #2a2a2e", padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#f0f0f0", fontFamily: "'Playfair Display', serif" }}>✉ Emails — {fullName}</h3>
                  <div style={{ fontSize: 11, color: "#888" }}>
                    {p?.email && <span>✉ {p.email}</span>}
                    {p?.agencyEmail && <span style={{ marginLeft: 10 }}>🏢 {p.agencyEmail}</span>}
                  </div>
                </div>
                <button onClick={() => { setEmailTemplateModal(null); setEmailActiveTemplate(null); }}
                  style={{ background: "none", border: "none", color: "#555", fontSize: 18, cursor: "pointer" }}>✕</button>
              </div>

              {/* Template selector */}
              <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
                {templates.map(t => (
                  <button key={t.key} onClick={() => { setEmailActiveTemplate(t.key); setEmailDraft({ subject: t.subject, body: t.body }); setEmailCopied(false); }}
                    style={{
                      padding: "8px 14px", borderRadius: 8, fontSize: 11, fontWeight: 600, fontFamily: "inherit",
                      cursor: "pointer", border: "none", transition: "all 0.2s",
                      background: emailActiveTemplate === t.key ? "rgba(201,164,74,0.12)" : "rgba(255,255,255,0.03)",
                      color: emailActiveTemplate === t.key ? "#c9a44a" : "#888",
                    }}>{t.label}</button>
                ))}
              </div>

              {emailActiveTemplate ? (
                <>
                  {/* Subject */}
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Objet</label>
                    <input value={emailDraft.subject} onChange={e => setEmailDraft(d => ({ ...d, subject: e.target.value }))}
                      style={{ width: "100%", padding: "10px 14px", background: "#0c0c0e", border: "1px solid #2a2a2e", borderRadius: 8, color: "#e0e0e0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none" }}
                      onFocus={e => e.target.style.borderColor = "#c9a44a"} onBlur={e => e.target.style.borderColor = "#2a2a2e"} />
                  </div>

                  {/* Body */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Corps du message</label>
                    <textarea value={emailDraft.body} onChange={e => setEmailDraft(d => ({ ...d, body: e.target.value }))} rows={12}
                      style={{ width: "100%", padding: "12px 14px", background: "#0c0c0e", border: "1px solid #2a2a2e", borderRadius: 8, color: "#e0e0e0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none", resize: "vertical", lineHeight: 1.6 }}
                      onFocus={e => e.target.style.borderColor = "#c9a44a"} onBlur={e => e.target.style.borderColor = "#2a2a2e"} />
                  </div>

                  {/* Prompt generator */}
                  <div style={{ padding: "12px 14px", background: "#111114", borderRadius: 10, border: "1px solid #1e1e22", marginBottom: 14 }}>
                    <label style={{ fontSize: 9, color: "#a855f7", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>✨ Personnaliser</label>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                      {[
                        { label: "Ton formel", action: () => setEmailDraft(d => ({ ...d, body: d.body.replace(/Bonjour/g, "Cher(e)").replace(/Cordialement/g, "Veuillez agréer l'expression de mes salutations distinguées") })) },
                        { label: "Ton chaleureux", action: () => setEmailDraft(d => ({ ...d, body: d.body.replace(/Bonjour/g, "Cher(e)").replace(/Cordialement/g, "Au plaisir,\nBien chaleureusement") })) },
                        { label: "+ Urgence", action: () => setEmailDraft(d => ({ ...d, body: d.body + "\n\n⚠ Merci de nous répondre dans les 48h afin de confirmer votre participation." })) },
                        { label: "+ Pièces jointes", action: () => setEmailDraft(d => ({ ...d, body: d.body + "\n\nVous trouverez ci-joint le texte/scénario à préparer pour le casting." })) },
                        { label: "+ Lieu & accès", action: () => setEmailDraft(d => ({ ...d, body: d.body + "\n\nAdresse : [ADRESSE]\nCode d'accès : [CODE]\nEtage/Salle : [DÉTAILS]" })) },
                      ].map(btn => (
                        <button key={btn.label} onClick={btn.action}
                          style={{ padding: "5px 10px", background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: 6, color: "#a855f7", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{btn.label}</button>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => {
                      navigator.clipboard.writeText(`Objet : ${emailDraft.subject}\n\n${emailDraft.body}`);
                      setEmailCopied(true); setTimeout(() => setEmailCopied(false), 2000);
                    }}
                      style={{ flex: 1, padding: "12px", background: emailCopied ? "rgba(34,197,94,0.1)" : "rgba(201,164,74,0.08)", border: `1px solid ${emailCopied ? "rgba(34,197,94,0.3)" : "rgba(201,164,74,0.2)"}`, borderRadius: 10, color: emailCopied ? "#22c55e" : "#c9a44a", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" }}>
                      {emailCopied ? "✓ Copié !" : "📋 Copier tout"}
                    </button>
                    <button onClick={() => {
                      const email = p?.email || p?.agencyEmail || "";
                      window.open(`mailto:${email}?subject=${encodeURIComponent(emailDraft.subject)}&body=${encodeURIComponent(emailDraft.body)}`, "_blank");
                    }}
                      style={{ padding: "12px 20px", background: "linear-gradient(135deg, #c9a44a, #a67c2e)", border: "none", borderRadius: 10, color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      ✉ Ouvrir dans Mail
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "30px", color: "#555", fontSize: 13 }}>
                  ← Choisissez un template ci-dessus pour commencer
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </>
  );
}

// ===============================================================
// GUEST VIEW — Read-only project view for réalisateur/production/agence
// ===============================================================
function GuestView({ shareCode, project, password }) {
  const [activeTab, setActiveTab] = useState("roles");
  const [activeRole, setActiveRole] = useState(project.roles?.[0] || null);
  const [votes, setVotes] = useState(project._guestVotes || {});
  const [castingVotes, setCastingVotes] = useState(project._guestCastingVotes || {});
  const [comments, setComments] = useState(project._guestComments || {});
  const [commentInput, setCommentInput] = useState({});
  const [savingState, setSavingState] = useState(null);
  const [expandedProfile, setExpandedProfile] = useState(null);
  const [playingVideo, setPlayingVideo] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState(0);

  // Auto-save votes to shared storage
  const saveToShared = useCallback(async (newVotes, newCastingVotes, newComments) => {
    setSavingState("saving");
    try {
      const data = await window.storage.get(`shared:${shareCode}`, true);
      if (!data?.value) return;
      const proj = JSON.parse(data.value);
      proj._guestVotes = newVotes;
      proj._guestCastingVotes = newCastingVotes;
      proj._guestComments = newComments;
      proj._guestUpdatedAt = new Date().toISOString();
      await window.storage.set(`shared:${shareCode}`, JSON.stringify(proj), true);
      setSavingState("saved");
      setTimeout(() => setSavingState(null), 2000);
    } catch (e) { setSavingState("error"); }
  }, [shareCode]);

  const vote = (profileId, choice) => {
    const newVotes = { ...votes, [profileId]: { choice, votedAt: new Date().toISOString() } };
    setVotes(newVotes);
    saveToShared(newVotes, castingVotes, comments);
  };

  const castingVote = (profileId, choice) => {
    const newVotes = { ...castingVotes, [profileId]: { choice, votedAt: new Date().toISOString() } };
    setCastingVotes(newVotes);
    saveToShared(votes, newVotes, comments);
  };

  const addComment = (profileId) => {
    const text = (commentInput[profileId] || "").trim();
    if (!text) return;
    const existing = comments[profileId] || [];
    const newComments = { ...comments, [profileId]: [...existing, { text, at: new Date().toISOString() }] };
    setComments(newComments);
    setCommentInput(prev => ({ ...prev, [profileId]: "" }));
    saveToShared(votes, castingVotes, newComments);
  };

  const profiles = project.profiles || {};
  const roleProfiles = profiles[activeRole] || [];
  const selections = project.selections || {};
  const castingSessions = project.castingSessions || {};

  // For casting tab — get profiles that have casting sessions
  const castingProfiles = [];
  Object.entries(profiles).forEach(([role, profs]) => {
    profs.forEach(p => {
      if (castingSessions[p.id] || selections[p.id]?.choice === "yes" || selections[p.id]?.choice === "maybe") {
        castingProfiles.push({ ...p, _role: role });
      }
    });
  });

  // For final tab — get profiles voted OUI by guest in casting
  const finalProfiles = castingProfiles.filter(p => castingVotes[p.id]?.choice === "yes");

  const tabs = [
    { key: "roles", icon: "🎭", label: "Rôles", count: project.roles?.length || 0 },
    { key: "casting", icon: "🎬", label: "Casting", count: castingProfiles.length },
    { key: "final", icon: "🏆", label: "Sélection finale", count: finalProfiles.length },
  ];

  const [guestViewMode, setGuestViewMode] = useState("grid"); // "grid" | "list"

  const voteButton = (profileId, choice, label, color, isActive, onClick) => (
    <button onClick={(e) => { e.stopPropagation(); onClick(profileId, choice); }} style={{
      flex: 1, padding: "10px 0", borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 700,
      fontFamily: "inherit", border: "none", letterSpacing: "0.02em",
      background: isActive ? `${color}18` : "transparent",
      color: isActive ? color : "#444",
      transition: "all 0.2s", position: "relative",
    }}>
      {isActive && <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 20, height: 2, background: color, borderRadius: 2 }} />}
      {label}
    </button>
  );

  const renderProfileCard = (profile, showCastingVotes = false) => {
    const v = showCastingVotes ? castingVotes[profile.id] : votes[profile.id];
    const profileComments = comments[profile.id] || [];
    const session = castingSessions[profile.id] || {};
    const isExpanded = expandedProfile === profile.id;
    const fullName = [profile.firstName, profile.name].filter(Boolean).join(" ") || "Sans nom";
    const isGrid = guestViewMode === "grid" && !showCastingVotes;

    // GRID CARD
    if (isGrid) {
      return (
        <div key={profile.id} style={{
          background: "#111114", borderRadius: 16, overflow: "hidden",
          border: v?.choice === "yes" ? "1px solid rgba(34,197,94,0.25)" : v?.choice === "no" ? "1px solid rgba(239,68,68,0.25)" : v?.choice === "maybe" ? "1px solid rgba(245,158,11,0.25)" : "1px solid #1e1e22",
          transition: "all 0.3s", position: "relative", cursor: "pointer",
        }}>
          {/* Photo */}
          <div onClick={() => { setSelectedProfile(profile); setSelectedPhotoIdx(0); }} style={{ width: "100%", aspectRatio: "3/4", background: "#0c0c0e", position: "relative", overflow: "hidden" }}>
            {profile.photos?.[0] ? (
              <img src={profile.photos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: 48, fontFamily: "'Playfair Display', serif" }}>
                {(profile.firstName || "?")[0]}
              </div>
            )}
            {/* Vote badge overlay */}
            {v && (
              <div style={{
                position: "absolute", top: 10, right: 10, padding: "4px 10px", borderRadius: 6,
                fontSize: 10, fontWeight: 800, letterSpacing: "0.05em",
                background: v.choice === "yes" ? "rgba(34,197,94,0.9)" : v.choice === "no" ? "rgba(239,68,68,0.9)" : "rgba(245,158,11,0.9)",
                color: "#fff", backdropFilter: "blur(8px)",
              }}>
                {v.choice === "yes" ? "OUI" : v.choice === "no" ? "NON" : "PEUT-ÊTRE"}
              </div>
            )}
            {/* Gradient overlay */}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, background: "linear-gradient(transparent, rgba(0,0,0,0.8))" }} />
            <div style={{ position: "absolute", bottom: 10, left: 14, right: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>{fullName}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>
                {[profile.age && `${profile.age} ans`, profile.agency].filter(Boolean).join(" · ")}
              </div>
            </div>
          </div>

          {/* Info row */}
          <div style={{ padding: "10px 14px", display: "flex", gap: 6, flexWrap: "wrap", fontSize: 10, color: "#666" }}>
            {profile.height && <span>{profile.height}</span>}
            {profile.eyeColor && <span>· {profile.eyeColor}</span>}
            {profile.hairColor && <span>· {profile.hairColor}</span>}
          </div>

          {/* Selftapes */}
          {(profile.selftapeLinks?.filter(l => l).length > 0 || profile.selftapeVideos?.length > 0) && (
            <div style={{ padding: "0 14px 8px" }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                {profile.selftapeLinks?.filter(l => l).map((link, i) => (
                  <a key={i} href={link} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "#60a5fa", textDecoration: "none", padding: "3px 8px", background: "rgba(96,165,250,0.06)", borderRadius: 4 }}>▶ Tape {i + 1}</a>
                ))}
                {profile.selftapeVideos?.map((video, i) => (
                  <button key={i} onClick={() => setPlayingVideo(video)} style={{ fontSize: 10, color: "#60a5fa", background: "rgba(96,165,250,0.06)", padding: "3px 8px", borderRadius: 4, border: "none", cursor: "pointer", fontFamily: "inherit" }}>▶ Video {i + 1}</button>
                ))}
              </div>
              {profile.selftapeLinks?.filter(l => l && getEmbedUrl(l)).slice(0, 1).map((link, i) => (
                <div key={i}><EmbedPlayer url={link} height={160} /></div>
              ))}
            </div>
          )}

          {/* Notes */}
          {profile.notes && (
            <div style={{ padding: "0 14px 8px", fontSize: 11, color: "#888", lineHeight: 1.4, fontStyle: "italic" }}>
              {profile.notes.length > 80 ? profile.notes.slice(0, 80) + "..." : profile.notes}
            </div>
          )}

          {/* Comments */}
          {profileComments.length > 0 && (
            <div style={{ padding: "0 14px 8px" }}>
              {profileComments.slice(-1).map((c, ci) => (
                <div key={ci} style={{ fontSize: 10, color: "#888", fontStyle: "italic", padding: "4px 8px", background: "#0c0c0e", borderRadius: 6 }}>💬 {c.text}</div>
              ))}
            </div>
          )}

          {/* Comment input (collapsed) */}
          <div style={{ padding: "0 14px 10px" }}>
            <div style={{ display: "flex", gap: 4 }}>
              <input
                value={commentInput[profile.id] || ""}
                onChange={e => setCommentInput(prev => ({ ...prev, [profile.id]: e.target.value }))}
                onKeyDown={e => { if (e.key === "Enter") addComment(profile.id); }}
                placeholder="Commenter..."
                style={{ flex: 1, padding: "6px 10px", background: "#0c0c0e", border: "1px solid #1a1a1e", borderRadius: 6, color: "#ccc", fontSize: 10, fontFamily: "'DM Sans',sans-serif", outline: "none" }}
                onFocus={e => e.target.style.borderColor = "#c9a44a55"}
                onBlur={e => e.target.style.borderColor = "#1a1a1e"}
              />
              {(commentInput[profile.id] || "").trim() && (
                <button onClick={() => addComment(profile.id)} style={{ padding: "6px 8px", background: "rgba(201,164,74,0.1)", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 10, color: "#c9a44a", fontWeight: 700, fontFamily: "inherit" }}>↑</button>
              )}
            </div>
          </div>

          {/* Vote buttons — minimal bar at bottom */}
          <div style={{ display: "flex", borderTop: "1px solid #1a1a1e" }}>
            {[
              { choice: "yes", label: "OUI", color: "#22c55e" },
              { choice: "maybe", label: "PEUT-ÊTRE", color: "#f59e0b" },
              { choice: "no", label: "NON", color: "#ef4444" },
            ].map((opt, i) => {
              const isActive = votes[profile.id]?.choice === opt.choice;
              return (
                <button key={opt.choice} onClick={() => vote(profile.id, opt.choice)} style={{
                  flex: 1, padding: "10px 0", border: "none", cursor: "pointer", fontSize: 10, fontWeight: 700,
                  fontFamily: "inherit", letterSpacing: "0.05em",
                  borderRight: i < 2 ? "1px solid #1a1a1e" : "none",
                  background: isActive ? `${opt.color}15` : "transparent",
                  color: isActive ? opt.color : "#444", transition: "all 0.2s",
                }}>
                  {isActive ? (opt.choice === "yes" ? "✓ " : opt.choice === "no" ? "✕ " : "~ ") : ""}{opt.label}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    // LIST CARD (casting tab or list mode)
    return (
      <div key={profile.id} style={{
        background: "#111114", border: "1px solid #1e1e22", borderRadius: 14,
        marginBottom: 10, overflow: "hidden", transition: "border-color 0.2s",
        borderColor: v?.choice === "yes" ? "rgba(34,197,94,0.25)" : v?.choice === "no" ? "rgba(239,68,68,0.25)" : v?.choice === "maybe" ? "rgba(245,158,11,0.25)" : "#1e1e22",
      }}>
        <div style={{ display: "flex", alignItems: "stretch" }}>
          {/* Photo */}
          <div onClick={() => { setSelectedProfile(profile); setSelectedPhotoIdx(0); }} style={{ width: 80, minHeight: 90, background: "#0c0c0e", flexShrink: 0, position: "relative", overflow: "hidden", cursor: "pointer" }}>
            {profile.photos?.[0] ? (
              <img src={profile.photos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: 28, fontFamily: "'Playfair Display', serif" }}>
                {(profile.firstName || "?")[0]}
              </div>
            )}
          </div>

          {/* Info */}
          <div style={{ flex: 1, padding: "12px 16px", display: "flex", flexDirection: "column", justifyContent: "center", cursor: "pointer" }}
            onClick={() => setExpandedProfile(isExpanded ? null : profile.id)}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#f0f0f0" }}>{fullName}</div>
              {v && (
                <span style={{
                  fontSize: 9, padding: "2px 8px", borderRadius: 4, fontWeight: 800, letterSpacing: "0.05em",
                  background: v.choice === "yes" ? "rgba(34,197,94,0.12)" : v.choice === "no" ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)",
                  color: v.choice === "yes" ? "#22c55e" : v.choice === "no" ? "#ef4444" : "#f59e0b",
                }}>
                  {v.choice === "yes" ? "OUI" : v.choice === "no" ? "NON" : "P-Ê"}
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: "#888", marginTop: 3 }}>
              {[profile.age && `${profile.age} ans`, profile.height, profile.agency].filter(Boolean).join(" · ")}
            </div>
            {profile._role && showCastingVotes && (
              <div style={{ fontSize: 10, color: "#c9a44a", marginTop: 2 }}>🎭 {profile._role}</div>
            )}
          </div>

          {/* Quick vote buttons (right side) */}
          <div style={{ display: "flex", flexDirection: "column", borderLeft: "1px solid #1a1a1e" }}>
            {(showCastingVotes ? [
              { choice: "yes", label: "✓", color: "#22c55e" },
              { choice: "no", label: "✕", color: "#ef4444" },
            ] : [
              { choice: "yes", label: "✓", color: "#22c55e" },
              { choice: "maybe", label: "~", color: "#f59e0b" },
              { choice: "no", label: "✕", color: "#ef4444" },
            ]).map(opt => {
              const currentVotes = showCastingVotes ? castingVotes : votes;
              const voteFunc = showCastingVotes ? castingVote : vote;
              const isActive = currentVotes[profile.id]?.choice === opt.choice;
              return (
                <button key={opt.choice} onClick={() => voteFunc(profile.id, opt.choice)} style={{
                  flex: 1, width: 44, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 800,
                  background: isActive ? `${opt.color}18` : "transparent",
                  color: isActive ? opt.color : "#333", transition: "all 0.15s",
                  borderBottom: "1px solid #1a1a1e",
                }}>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Expanded */}
        {isExpanded && (
          <div style={{ padding: "14px 16px", borderTop: "1px solid #1a1a1e" }}>
            {/* Details */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11, color: "#888", marginBottom: 10 }}>
              {profile.eyeColor && <span>👁 {profile.eyeColor}</span>}
              {profile.hairColor && <span>💇 {profile.hairColor}</span>}
              {profile.city && <span>📍 {profile.city}</span>}
            </div>

            {/* Selftapes */}
            {(profile.selftapeLinks?.filter(l => l).length > 0 || profile.selftapeVideos?.length > 0) && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                  {profile.selftapeLinks?.filter(l => l).map((link, i) => (
                    <a key={i} href={link} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "#60a5fa", textDecoration: "none", padding: "4px 10px", background: "rgba(96,165,250,0.06)", borderRadius: 6 }}>▶ Tape {i + 1}</a>
                  ))}
                  {profile.selftapeVideos?.map((video, i) => (
                    <button key={i} onClick={() => setPlayingVideo(video)} style={{ fontSize: 10, color: "#60a5fa", background: "rgba(96,165,250,0.06)", padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit" }}>▶ Video {i + 1}</button>
                  ))}
                </div>
                {profile.selftapeLinks?.filter(l => l && getEmbedUrl(l)).slice(0, 1).map((link, i) => (
                  <div key={i}><EmbedPlayer url={link} height={180} /></div>
                ))}
              </div>
            )}

            {/* Director notes / casting comment */}
            {showCastingVotes && session.comment && (
              <div style={{ padding: "8px 12px", background: "rgba(201,164,74,0.04)", border: "1px solid rgba(201,164,74,0.12)", borderRadius: 8, marginBottom: 10, fontSize: 11, color: "#ccc" }}>
                <span style={{ fontSize: 9, color: "#c9a44a", fontWeight: 600 }}>CASTING DIRECTOR — </span>{session.comment}
              </div>
            )}
            {profile.notes && (
              <div style={{ fontSize: 11, color: "#999", lineHeight: 1.5, marginBottom: 10, fontStyle: "italic" }}>📝 {profile.notes}</div>
            )}

            {/* Comments */}
            {profileComments.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                {profileComments.map((c, i) => (
                  <div key={i} style={{ padding: "6px 10px", background: "#0c0c0e", borderRadius: 6, marginBottom: 3, fontSize: 11, color: "#ccc", display: "flex", justifyContent: "space-between" }}>
                    <span>{c.text}</span>
                    <span style={{ fontSize: 9, color: "#444" }}>{new Date(c.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Comment input */}
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={commentInput[profile.id] || ""}
                onChange={e => setCommentInput(prev => ({ ...prev, [profile.id]: e.target.value }))}
                onKeyDown={e => { if (e.key === "Enter") addComment(profile.id); }}
                placeholder="Ajouter un commentaire..."
                style={{ flex: 1, padding: "8px 12px", background: "#0c0c0e", border: "1px solid #1a1a1e", borderRadius: 8, color: "#e0e0e0", fontSize: 11, fontFamily: "'DM Sans',sans-serif", outline: "none" }}
                onFocus={e => e.target.style.borderColor = "#c9a44a55"}
                onBlur={e => e.target.style.borderColor = "#1a1a1e"}
              />
              <button onClick={() => addComment(profile.id)} style={{ padding: "8px 12px", background: "rgba(201,164,74,0.08)", border: "1px solid rgba(201,164,74,0.15)", borderRadius: 8, cursor: "pointer", fontSize: 11, color: "#c9a44a", fontWeight: 600, fontFamily: "inherit" }}>
                Envoyer
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Bebas+Neue&family=Playfair+Display:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #0a0a0c; color: #e0e0e0; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        ::selection { background: #c9a44a44; color: #fff; }
      `}</style>
      <div style={{ minHeight: "100vh", background: "#0a0a0c" }}>
        {/* Header */}
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 24px", height: 56, borderBottom: "1px solid #1a1a1e",
          background: "#0a0a0c", position: "sticky", top: 0, zIndex: 100,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 20 }}>🎬</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#f0f0f0", fontFamily: "'Playfair Display', serif" }}>
                {project.projectName}
              </div>
              <div style={{ fontSize: 10, color: "#c9a44a", fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase" }}>
                Consultation · Joana Fontaine Casting
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {savingState === "saved" && <span style={{ fontSize: 10, color: "#22c55e" }}>✓ Synchronisé</span>}
            {savingState === "saving" && <span style={{ fontSize: 10, color: "#f59e0b" }}>⏳ Sauvegarde...</span>}
            <span style={{ fontSize: 9, padding: "4px 10px", background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 6, color: "#a855f7", fontWeight: 700 }}>
              RÉAL/PROD
            </span>
          </div>
        </header>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #1a1a1e", padding: "0 24px" }}>
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "14px 20px", background: "none", border: "none", borderBottom: activeTab === tab.key ? "2px solid #c9a44a" : "2px solid transparent",
                cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600,
                color: activeTab === tab.key ? "#f0f0f0" : "#555", transition: "all 0.2s",
              }}>
              {tab.icon} {tab.label}
              {tab.count > 0 && <span style={{ marginLeft: 6, fontSize: 10, color: "#c9a44a" }}>({tab.count})</span>}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px" }}>
          {/* ROLES TAB */}
          {activeTab === "roles" && (
            <div>
              {/* Role selector */}
              <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                {(project.roles || []).map(role => {
                  const count = (profiles[role] || []).length;
                  const voted = (profiles[role] || []).filter(p => votes[p.id]).length;
                  return (
                    <button key={role} onClick={() => setActiveRole(role)}
                      style={{
                        padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600,
                        fontFamily: "inherit", border: activeRole === role ? "1px solid #c9a44a" : "1px solid #2a2a2e",
                        background: activeRole === role ? "rgba(201,164,74,0.08)" : "#111114",
                        color: activeRole === role ? "#c9a44a" : "#888",
                      }}>
                      🎭 {role} <span style={{ opacity: 0.5 }}>({voted}/{count})</span>
                    </button>
                  );
                })}
              </div>

              {/* Profiles */}
              {roleProfiles.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#555" }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>🎭</div>
                  <div style={{ fontSize: 14 }}>Aucun profil pour ce rôle</div>
                </div>
              ) : (
                <div style={{ animation: "fadeIn 0.3s" }}>
                  {/* Stats + View toggle */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{ display: "flex", gap: 10 }}>
                      {[
                        { label: "Total", count: roleProfiles.length, color: "#888" },
                        { label: "OUI", count: roleProfiles.filter(p => votes[p.id]?.choice === "yes").length, color: "#22c55e" },
                        { label: "P-Ê", count: roleProfiles.filter(p => votes[p.id]?.choice === "maybe").length, color: "#f59e0b" },
                        { label: "NON", count: roleProfiles.filter(p => votes[p.id]?.choice === "no").length, color: "#ef4444" },
                      ].map(s => (
                        <div key={s.label} style={{ textAlign: "center" }}>
                          <span style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.count}</span>
                          <div style={{ fontSize: 9, color: "#555", marginTop: 1 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 2, background: "#0c0c0e", borderRadius: 6, padding: 2 }}>
                      <button onClick={() => setGuestViewMode("grid")} style={{ padding: "5px 10px", borderRadius: 4, border: "none", cursor: "pointer", fontSize: 12, background: guestViewMode === "grid" ? "rgba(201,164,74,0.12)" : "transparent", color: guestViewMode === "grid" ? "#c9a44a" : "#555" }}>▦</button>
                      <button onClick={() => setGuestViewMode("list")} style={{ padding: "5px 10px", borderRadius: 4, border: "none", cursor: "pointer", fontSize: 12, background: guestViewMode === "list" ? "rgba(201,164,74,0.12)" : "transparent", color: guestViewMode === "list" ? "#c9a44a" : "#555" }}>☰</button>
                    </div>
                  </div>
                  {guestViewMode === "grid" ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
                      {roleProfiles.map(p => renderProfileCard(p, false))}
                    </div>
                  ) : (
                    roleProfiles.map(p => renderProfileCard(p, false))
                  )}
                </div>
              )}
            </div>
          )}

          {/* CASTING TAB */}
          {activeTab === "casting" && (
            <div>
              {castingProfiles.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#555" }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>🎬</div>
                  <div style={{ fontSize: 14 }}>Aucun profil en casting pour le moment</div>
                </div>
              ) : (
                <div style={{ animation: "fadeIn 0.3s" }}>
                  <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                    {[
                      { label: "En casting", count: castingProfiles.length, color: "#888" },
                      { label: "OUI", count: castingProfiles.filter(p => castingVotes[p.id]?.choice === "yes").length, color: "#22c55e" },
                      { label: "NON", count: castingProfiles.filter(p => castingVotes[p.id]?.choice === "no").length, color: "#ef4444" },
                    ].map(s => (
                      <div key={s.label} style={{ padding: "8px 14px", background: "#111114", borderRadius: 8, border: "1px solid #1e1e22" }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.count}</span>
                        <span style={{ fontSize: 10, color: "#555", marginLeft: 6 }}>{s.label}</span>
                      </div>
                    ))}
                  </div>
                  {castingProfiles.map(p => renderProfileCard(p, true))}
                </div>
              )}
            </div>
          )}

          {/* FINAL TAB */}
          {activeTab === "final" && (
            <div>
              {finalProfiles.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#555" }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>🏆</div>
                  <div style={{ fontSize: 14 }}>Aucune sélection finale</div>
                  <div style={{ fontSize: 12, color: "#444", marginTop: 8 }}>Votez OUI dans l'onglet Casting pour voir les profils ici</div>
                </div>
              ) : (
                <div style={{ animation: "fadeIn 0.3s" }}>
                  <div style={{ fontSize: 12, color: "#888", marginBottom: 16 }}>
                    {finalProfiles.length} profil{finalProfiles.length !== 1 ? "s" : ""} sélectionné{finalProfiles.length !== 1 ? "s" : ""}
                  </div>
                  {finalProfiles.map(p => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", background: "#111114", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 14, marginBottom: 10 }}>
                      {p.photos?.[0] ? (
                        <img src={p.photos[0]} style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: 48, height: 48, borderRadius: 10, background: "#1e1e22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#555" }}>
                          {(p.firstName || "?")[0]}
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#f0f0f0" }}>
                          {[p.firstName, p.name].filter(Boolean).join(" ")}
                        </div>
                        <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                          🎭 {p._role} {p.agency && `· ${p.agency}`}
                        </div>
                      </div>
                      <span style={{ padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>
                        🏆 Sélectionné
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Video player overlay */}
        {/* Profile Detail Modal */}
        {selectedProfile && (() => {
          const sp = selectedProfile;
          const photos = sp.photos || [];
          const fullName = [sp.firstName, (sp.name || "").toUpperCase()].filter(Boolean).join(" ");
          const spVote = votes[sp.id];
          const voteProfile = (choice) => {
            const nv = { ...votes, [sp.id]: { ...(votes[sp.id] || {}), choice, at: new Date().toISOString() } };
            setVotes(nv);
            saveToShared(nv, castingVotes, comments);
          };
          return (
            <div onClick={() => setSelectedProfile(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 20 }}>
              <div onClick={e => e.stopPropagation()} style={{ background: "#111114", borderRadius: 20, maxWidth: 500, width: "100%", maxHeight: "90vh", overflow: "auto", border: "1px solid #2a2a2e", cursor: "default" }}>
                {/* Photo gallery */}
                <div style={{ position: "relative", width: "100%", aspectRatio: "3/4", background: "#0c0c0e", overflow: "hidden", borderRadius: "20px 20px 0 0" }}>
                  {photos.length > 0 ? (
                    <img src={photos[selectedPhotoIdx] || photos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: 80, fontFamily: "'Playfair Display', serif" }}>{(sp.firstName || "?")[0]}</div>
                  )}
                  {/* Close button */}
                  <button onClick={() => setSelectedProfile(null)} style={{ position: "absolute", top: 12, right: 12, width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                  {/* Photo navigation */}
                  {photos.length > 1 && (
                    <>
                      <button onClick={() => setSelectedPhotoIdx(i => (i - 1 + photos.length) % photos.length)} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", fontSize: 18, cursor: "pointer" }}>‹</button>
                      <button onClick={() => setSelectedPhotoIdx(i => (i + 1) % photos.length)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", fontSize: 18, cursor: "pointer" }}>›</button>
                      <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6 }}>
                        {photos.map((_, pi) => (
                          <div key={pi} onClick={() => setSelectedPhotoIdx(pi)} style={{ width: 8, height: 8, borderRadius: "50%", background: pi === selectedPhotoIdx ? "#fff" : "rgba(255,255,255,0.35)", cursor: "pointer", transition: "background 0.2s" }} />
                        ))}
                      </div>
                    </>
                  )}
                </div>
                {/* Profile info */}
                <div style={{ padding: "20px 24px" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#f0f0f0", fontFamily: "'Playfair Display', serif", marginBottom: 4 }}>{fullName}</div>
                  <div style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>
                    {[sp.age ? sp.age + " ans" : null, sp.height, sp.hairColor].filter(Boolean).join(" · ")}
                  </div>
                  {sp.agency && <div style={{ fontSize: 12, color: "#c9a44a", fontWeight: 700, marginBottom: 10 }}>— {sp.agency}</div>}
                  {/* Details grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", marginBottom: 16 }}>
                    {sp.measurements && <div><span style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase" }}>Mensurations</span><div style={{ fontSize: 13, color: "#ccc" }}>{sp.measurements}</div></div>}
                    {sp.profileType && <div><span style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase" }}>Type</span><div style={{ fontSize: 13, color: "#ccc" }}>{sp.profileType}</div></div>}
                    {sp.eyeColor && <div><span style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase" }}>Yeux</span><div style={{ fontSize: 13, color: "#ccc" }}>{sp.eyeColor}</div></div>}
                    {sp.city && <div><span style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase" }}>Ville</span><div style={{ fontSize: 13, color: "#ccc" }}>{sp.city}</div></div>}
                    {sp.email && <div><span style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase" }}>Email</span><div style={{ fontSize: 13, color: "#60a5fa" }}>{sp.email}</div></div>}
                    {sp.phone && <div><span style={{ fontSize: 9, color: "#555", fontWeight: 600, textTransform: "uppercase" }}>Tel</span><div style={{ fontSize: 13, color: "#ccc" }}>{sp.phone}</div></div>}
                  </div>
                  {sp.notes && <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 8, borderLeft: "3px solid #c9a44a44", fontSize: 13, color: "#aaa", marginBottom: 12, lineHeight: 1.5 }}>{sp.notes}</div>}
                  {sp.specificities && <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 8, borderLeft: "3px solid #f59e0b44", fontSize: 13, color: "#aaa", marginBottom: 12, lineHeight: 1.5 }}>{sp.specificities}</div>}
                  {/* Selftapes */}
                  {(sp.selftapeLinks?.filter(l => l).length > 0) && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10, color: "#555", fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>Selftapes</div>
                      {sp.selftapeLinks.filter(l => l).map((link, li) => (
                        <div key={li} style={{ marginBottom: 8 }}><EmbedPlayer url={link} height={200} /></div>
                      ))}
                    </div>
                  )}
                  {/* Vote buttons */}
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    {[{ k: "yes", l: "OUI", c: "#22c55e" }, { k: "maybe", l: "PEUT-ETRE", c: "#f59e0b" }, { k: "no", l: "NON", c: "#ef4444" }].map(opt => (
                      <button key={opt.k} onClick={() => voteProfile(opt.k)} style={{
                        flex: 1, padding: "12px 0", borderRadius: 10, fontSize: 12, fontWeight: 700,
                        fontFamily: "inherit", border: "none", cursor: "pointer",
                        background: spVote?.choice === opt.k ? opt.c + "20" : "rgba(255,255,255,0.03)",
                        color: spVote?.choice === opt.k ? opt.c : "#555",
                        transition: "all 0.2s",
                      }}>{spVote?.choice === opt.k ? "✓ " : ""}{opt.l}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {playingVideo && (
          <div onClick={() => setPlayingVideo(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <div onClick={e => e.stopPropagation()} style={{ maxWidth: "90%", maxHeight: "85vh" }}>
              <video src={playingVideo.url || playingVideo.data} controls autoPlay
                style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: 12 }} />
              <div style={{ textAlign: "center", marginTop: 10, fontSize: 12, color: "#888" }}>{playingVideo.name}</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default function CastingApp() {
  // ===== ALL HOOKS MUST BE DECLARED FIRST =====
  
  // Detect ?share=CODE immediately (not in useEffect)
  const shareCodeFromUrl = (() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("share");
      return code ? code.toUpperCase() : null;
    } catch (e) { return null; }
  })();

  // Guest share mode
  const [guestProject, setGuestProject] = useState(null);
  const [guestPasswordInput, setGuestPasswordInput] = useState("");
  const [guestPasswordError, setGuestPasswordError] = useState("");
  const [guestAuthenticated, setGuestAuthenticated] = useState(false);
  const [guestLoading, setGuestLoading] = useState(!!shareCodeFromUrl);
  const [guestError, setGuestError] = useState(null);

  // Normal auth mode
  const [authState, setAuthState] = useState("loading");
  const [authUser, setAuthUser] = useState(null);
  const [authForm, setAuthForm] = useState({ email: "", password: "", firstName: "", lastName: "" });
  const [authError, setAuthError] = useState("");
  const [authRemember, setAuthRemember] = useState(true);
  const [siteUnlocked, setSiteUnlocked] = useState(false);
  const [siteCode, setSiteCode] = useState("");
  const [siteCodeError, setSiteCodeError] = useState("");
  const [showSiteCode, setShowSiteCode] = useState(false);
  const [showGuestPwd, setShowGuestPwd] = useState(false);

  const SITE_ACCESS_CODE = "JOJO2025";

  // Load shared project data
  useEffect(() => {
    if (!shareCodeFromUrl) return;
    let cancelled = false;
    const loadProject = async () => {
      // Try with timeout — if Supabase hangs, fall back quickly
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 30000));
      
      try {
        console.log("[Guest] Loading shared project:", shareCodeFromUrl);
        const data = await Promise.race([
          window.storage.get(`shared:${shareCodeFromUrl}`, true),
          timeoutPromise,
        ]);
        if (cancelled) return;
        console.log("[Guest] Data received:", !!data?.value);
        if (data?.value) {
          setGuestProject(JSON.parse(data.value));
        } else {
          setGuestError("Projet introuvable");
        }
      } catch (e) {
        if (cancelled) return;
        console.error("[Guest] Error loading project:", e?.message || e);
        // Try localStorage directly as last resort
        try {
          const localVal = localStorage.getItem(`shared:shared:${shareCodeFromUrl}`) || localStorage.getItem(`shared:${shareCodeFromUrl}`);
          if (localVal) {
            console.log("[Guest] Found in localStorage fallback");
            setGuestProject(JSON.parse(localVal));
          } else {
            setGuestError("Projet introuvable ou lien expiré");
          }
        } catch (e2) {
          setGuestError("Erreur de chargement");
        }
      }
      if (!cancelled) setGuestLoading(false);
    };
    loadProject();
    return () => { cancelled = true; };
  }, [shareCodeFromUrl]);

  // Sync userId for Supabase storage
  useEffect(() => {
    if (authUser?.id) setCurrentUserId(authUser.id);
  }, [authUser]);

  // Check if already logged in
  useEffect(() => {
    if (shareCodeFromUrl) return; // skip for guest mode
    if (siteUnlocked) {
      const user = {
        id: "joana_casting_director",
        email: "joana@casting.com",
        firstName: "Joana",
        lastName: "Fontaine",
        provider: "site_code",
        loggedAt: new Date().toISOString(),
      };
      setAuthUser(user);
      setAuthState("authenticated");
    } else {
      setAuthState("login");
    }
  }, [siteUnlocked, shareCodeFromUrl]);

  // Timeout on loading — fallback
  useEffect(() => {
    if (shareCodeFromUrl) return;
    if (authState === "loading") {
      const t = setTimeout(() => setAuthState("login"), 2000);
      return () => clearTimeout(t);
    }
  }, [authState, shareCodeFromUrl]);

  // ===== HANDLERS =====

  const handleGuestPassword = () => {
    if (!guestProject) return;
    if (guestPasswordInput.toUpperCase().trim() === (guestProject._sharePassword || "").toUpperCase()) {
      setGuestAuthenticated(true);
      setGuestPasswordError("");
    } else {
      setGuestPasswordError("Mot de passe incorrect");
    }
  };

  const handleSiteUnlock = () => {
    if (siteCode.toUpperCase().trim() === SITE_ACCESS_CODE) {
      setSiteUnlocked(true);
      setSiteCodeError("");
      const user = {
        id: "joana_casting_director",
        email: "joana@casting.com",
        firstName: "Joana",
        lastName: "Fontaine",
        provider: "site_code",
        loggedAt: new Date().toISOString(),
      };
      try { window.storage.set("auth:session", JSON.stringify(user)); } catch (e) {}
      setAuthUser(user);
      setAuthState("authenticated");
    } else {
      setSiteCodeError("Code incorrect");
    }
  };

  const handleLogin = async (provider) => {
    setAuthError("");
    if (provider === "quick") {
      const user = {
        id: Date.now().toString(36),
        email: authForm.email || "directeur@casting.com",
        firstName: authForm.firstName || "Directeur",
        lastName: authForm.lastName || "Casting",
        provider: "quick",
        loggedAt: new Date().toISOString(),
      };
      try { await window.storage.set("auth:session", JSON.stringify(user)); } catch (e) {}
      setAuthUser(user);
      setAuthState("authenticated");
    }
  };

  const handleSignup = async () => {};

  // ===== STYLES =====
  const loginStyles = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Bebas+Neue&family=Playfair+Display:wght@700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'DM Sans', sans-serif; background: #0a0a0c; color: #e0e0e0; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
    @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
    ::selection { background: #c9a44a44; color: #fff; }
  `;

  // ===== CONDITIONAL RENDERS (all hooks are above) =====

  // GUEST SHARE MODE
  if (shareCodeFromUrl) {
    if (guestLoading) {
      return (
        <>
          <style>{loginStyles}</style>
          <div style={{ minHeight: "100vh", background: "#0a0a0c", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center", animation: "pulse 1.5s infinite" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎬</div>
              <div style={{ fontSize: 13, color: "#666" }}>Chargement du projet...</div>
              <div style={{ fontSize: 10, color: "#333", marginTop: 8 }}>Code: {shareCodeFromUrl}</div>
            </div>
          </div>
        </>
      );
    }

    if (!guestProject) {
      return (
        <>
          <style>{loginStyles}</style>
          <div style={{ minHeight: "100vh", background: "#0a0a0c", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ textAlign: "center", animation: "fadeIn 0.5s", maxWidth: 400 }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
              <h1 style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Playfair Display', serif", color: "#f0f0f0", marginBottom: 8 }}>Projet introuvable</h1>
              <p style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>{guestError || "Ce lien de partage n'est plus valide ou le projet a été supprimé."}</p>
              <p style={{ fontSize: 10, color: "#444", marginBottom: 20 }}>Code: {shareCodeFromUrl}</p>
              <button onClick={() => window.location.reload()} style={{
                padding: "10px 20px", background: "rgba(201,164,74,0.1)", border: "1px solid rgba(201,164,74,0.2)",
                borderRadius: 8, color: "#c9a44a", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}>🔄 Réessayer</button>
            </div>
          </div>
        </>
      );
    }

    if (!guestAuthenticated) {
      return (
        <>
          <style>{loginStyles}</style>
          <div style={{ minHeight: "100vh", background: "#0a0a0c", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ width: "100%", maxWidth: 380, textAlign: "center", animation: "fadeIn 0.5s ease" }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🎬</div>
              <h1 style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Playfair Display', serif", color: "#f0f0f0", marginBottom: 4 }}>
                {guestProject.projectName}
              </h1>
              <p style={{ fontSize: 12, color: "#c9a44a", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 24 }}>
                Joana Fontaine · Casting Director
              </p>
              <p style={{ fontSize: 13, color: "#666", marginBottom: 24 }}>
                Entrez le mot de passe pour accéder au projet.
              </p>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1, position: "relative" }}>
                  <input
                    value={guestPasswordInput}
                    onChange={e => { setGuestPasswordInput(e.target.value); setGuestPasswordError(""); }}
                    onKeyDown={e => { if (e.key === "Enter") handleGuestPassword(); }}
                    placeholder="Mot de passe"
                    type={showGuestPwd ? "text" : "password"}
                    autoFocus
                    style={{
                      width: "100%", padding: "14px 48px 14px 18px", background: "#111114",
                      border: guestPasswordError ? "1px solid rgba(239,68,68,0.4)" : "1px solid #2a2a2e",
                      borderRadius: 12, color: "#e0e0e0", fontSize: 16, fontFamily: "'DM Sans',sans-serif",
                      outline: "none", textAlign: "center", letterSpacing: "0.15em", fontWeight: 700, boxSizing: "border-box",
                    }}
                    onFocus={e => e.target.style.borderColor = "#a855f7"}
                    onBlur={e => e.target.style.borderColor = guestPasswordError ? "rgba(239,68,68,0.4)" : "#2a2a2e"}
                  />
                  <button onClick={() => setShowGuestPwd(p => !p)} type="button" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#555", padding: 4 }} title={showGuestPwd ? "Masquer" : "Afficher"}>
                    {showGuestPwd ? "🙈" : "👁"}
                  </button>
                </div>
                <button onClick={handleGuestPassword}
                  style={{
                    padding: "14px 24px", background: "linear-gradient(135deg, #a855f7, #7c3aed)",
                    border: "none", borderRadius: 12, cursor: "pointer", fontSize: 15, fontWeight: 700,
                    fontFamily: "inherit", color: "#fff", transition: "all 0.2s",
                  }}>
                  →
                </button>
              </div>
              {guestPasswordError && (
                <div style={{ fontSize: 12, color: "#ef4444", animation: "fadeIn 0.3s ease" }}>{guestPasswordError}</div>
              )}
              <div style={{ marginTop: 40, fontSize: 10, color: "#333" }}>
                Casting Director · Joana Fontaine
              </div>
            </div>
          </div>
        </>
      );
    }

    return <ErrorBoundary><GuestView shareCode={shareCodeFromUrl} project={guestProject} password={guestPasswordInput} /></ErrorBoundary>;
  }

  // DIRECTOR MODE — Lock screen
  if (!siteUnlocked) {
    return (
      <>
        <style>{loginStyles}</style>
        <div style={{ minHeight: "100vh", background: "#0a0a0c", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 380, textAlign: "center", animation: "fadeIn 0.5s ease" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🔒</div>
            <h1 style={{ fontSize: 26, fontWeight: 800, fontFamily: "'Playfair Display', serif", color: "#f0f0f0", marginBottom: 8 }}>
              Casting Director
            </h1>
            <p style={{ fontSize: 13, color: "#666", marginBottom: 32, lineHeight: 1.5 }}>
              Joana Fontaine<br/>Entrez le code d'accès pour continuer.
            </p>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <input
                  value={siteCode}
                  onChange={e => { setSiteCode(e.target.value); setSiteCodeError(""); }}
                  onKeyDown={e => { if (e.key === "Enter") handleSiteUnlock(); }}
                  placeholder="Code d'accès"
                  type={showSiteCode ? "text" : "password"}
                  autoFocus
                  style={{
                    width: "100%", padding: "14px 48px 14px 18px", background: "#111114", border: siteCodeError ? "1px solid rgba(239,68,68,0.4)" : "1px solid #2a2a2e",
                    borderRadius: 12, color: "#e0e0e0", fontSize: 16, fontFamily: "'DM Sans',sans-serif",
                    outline: "none", textAlign: "center", letterSpacing: "0.15em", fontWeight: 700, boxSizing: "border-box",
                  }}
                  onFocus={e => e.target.style.borderColor = "#c9a44a"}
                  onBlur={e => e.target.style.borderColor = siteCodeError ? "rgba(239,68,68,0.4)" : "#2a2a2e"}
                />
                <button onClick={() => setShowSiteCode(p => !p)} type="button" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#555", padding: 4 }} title={showSiteCode ? "Masquer" : "Afficher"}>
                  {showSiteCode ? "🙈" : "👁"}
                </button>
              </div>
              <button onClick={handleSiteUnlock}
                style={{
                  padding: "14px 24px", background: "linear-gradient(135deg, #c9a44a, #b8963a)",
                  border: "none", borderRadius: 12, cursor: "pointer", fontSize: 15, fontWeight: 700,
                  fontFamily: "inherit", color: "#000", transition: "all 0.2s",
                }}>
                →
              </button>
            </div>
            {siteCodeError && (
              <div style={{ fontSize: 12, color: "#ef4444", animation: "fadeIn 0.3s ease" }}>{siteCodeError}</div>
            )}
            <div style={{ marginTop: 40, fontSize: 10, color: "#333" }}>
              Joana Fontaine · Casting Director
            </div>
          </div>
        </div>
      </>
    );
  }

  if (authState === "loading") {
    return (
      <>
        <style>{loginStyles}</style>
        <div style={{ minHeight: "100vh", background: "#0a0a0c", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", animation: "pulse 1.5s infinite" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎬</div>
            <div style={{ fontSize: 13, color: "#666" }}>Chargement...</div>
          </div>
        </div>
      </>
    );
  }

  // If not authenticated yet, show lock screen
  if (authState !== "authenticated") {
    return null; // Will show lock screen via !siteUnlocked check above
  }


  return <ErrorBoundary><CastingAppInner authUser={authUser} /></ErrorBoundary>;
}
