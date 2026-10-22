import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { AnimatePresence, animate, motion } from "framer-motion";
import {
  Plus, Banknote, ArrowDownCircle, ArrowUpCircle, ArrowUpRight, ArrowDownLeft, ArrowRight, Pencil, Trash2, FileDown, 
  HandCoins, PiggyBank, CalendarDays, Tag, UserRound, PenLine, TriangleAlert, Check, LoaderCircle, Coins, Sparkles,
  Paperclip, Eye, FileText, Upload, X,
} from "lucide-react";
import TopBar from "../components/layout/TopBar";
import GlassCard from "../components/ui/GlassCard";
import StatTile from "../components/ui/StatTile";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import Icone3D from "../components/ui/Icone3D";
import ConfirmSuppressionModal from "../components/ui/ConfirmSuppressionModal";
import { useDataStore } from "../store/dataStore";
import { useAuthStore } from "../store/authStore";
import { useUIStore } from "../store/uiStore";
import { fmtFCFA, matchPeriode } from "../lib/logic";
import { peutModifier as peutModifierRole, peutSupprimer as peutSupprimerRole } from "../lib/modules";
import { enregistrerMotifSuppression } from "../lib/motifSuppression";
import { lireFichier, formatTaille, ouvrirPiece } from "../lib/fichiers";

const ACCENT = "#FF9F0A";
const aujourdhui = () => new Date().toISOString().slice(0, 10);
const VIDE = () => ({ date: aujourdhui(), type: "sortie", libelle: "", montant: "", categorie: "", beneficiaire: "", piece: null });

// Propositions de catégories pour les dépenses de la caisse (la saisie reste libre).
const CATEGORIES_CAISSE = [
  "Carburant", "Transport", "Restauration", "Fournitures de bureau", "Communication", "Eau et électricité",
  "Entretien et réparation", "Salaires et main d'oeuvre", "Frais de mission", "Santé", "Impôts et taxes", "Imprévus", "Divers",
];
const PALETTE_CATEGORIES = ["#FF9F0A", "#0A84FF", "#30D158", "#BF5AF2", "#FF453A", "#64D2FF", "#FFD60A", "#5E5CE6"];
const couleurCategorie = (nom) => PALETTE_CATEGORIES[[...nom].reduce((t, c) => t + c.charCodeAt(0), 0) % PALETTE_CATEGORIES.length];

const TYPES = {
  sortie: { couleur: "#FF453A", foncee: "#d9362c", icone: HandCoins, titre: "Dépense", sous: "L'argent sort de la caisse", bouton: "Enregistrer la dépense" },
  entree: { couleur: "#30D158", foncee: "#1f9e43", icone: PiggyBank, titre: "Dotation", sous: "L'argent entre dans la caisse", bouton: "Enregistrer la dotation" },
};

const SANS_CATEGORIE = "__aucune__";
const SANS_FLECHES = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
const CLASSE_CHAMP = "glass w-full rounded-2xl pl-11 pr-3.5 py-3 text-[16px] text-ink outline-none sm:py-2.5 sm:text-[14px] placeholder:text-ink-soft/60 transition-[outline-color] focus:outline-2 focus:outline-offset-2 focus:outline-(--c)";

// Champ de formulaire avec icône à gauche : l'icône et le contour prennent la
// couleur du type de mouvement quand le champ a le focus.
function Champ({ label, icone: Icone, hint, couleur, children }) {
  return (
    <div className="mb-3.5" style={{ "--c": couleur }}>
      <span className="text-[12.5px] font-semibold text-ink-soft ml-1">{label}</span>
      <div className="group relative mt-1.5">
        {Icone && <Icone size={17} strokeWidth={2.2} className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-ink-soft/70 transition-colors duration-200 group-focus-within:text-(--c)" />}
        {children}
      </div>
      {hint && <span className="block text-[11px] text-ink-soft/80 mt-1 ml-1">{hint}</span>}
    </div>
  );
}

// Nombre qui défile jusqu'à sa nouvelle valeur au lieu de sauter.
function NombreAnime({ valeur }) {
  const [affiche, setAffiche] = useState(valeur);
  const courant = useRef(valeur);
  useEffect(() => {
    const anim = animate(courant.current, valeur, {
      duration: 0.55, ease: "easeOut",
      onUpdate: (v) => { courant.current = v; setAffiche(v); },
    });
    return () => anim.stop();
  }, [valeur]);
  return fmtFCFA(affiche);
}

function BoutonEnregistrer({ couleur, foncee, saving, onClick, children }) {
  return (
    <motion.button
      type="button" onClick={onClick} disabled={saving}
      whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold tracking-tight text-white disabled:opacity-60 sm:flex-none sm:py-2.5"
      style={{ background: `linear-gradient(135deg, ${couleur}, ${foncee})`, boxShadow: `0 10px 24px -6px ${couleur}aa, inset 0 1px 0 rgba(255,255,255,0.35)` }}
    >
      {saving
        ? <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }} className="flex"><LoaderCircle size={16} strokeWidth={2.6} /></motion.span>
        : <Check size={16} strokeWidth={2.8} />}
      {saving ? "Enregistrement…" : children}
    </motion.button>
  );
}

function MessageErreur({ message }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.p
          key={message}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0, x: [0, -7, 7, -5, 5, 0] }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.45 }}
          className="flex items-start gap-2 text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3"
        >
          <TriangleAlert size={15} strokeWidth={2.4} className="mt-px shrink-0" />
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

// Caisse courante : suivi des dotations en espèces et des dépenses payées
// par la caisse. Le solde courant est calculé sur TOUT l'historique, même
// quand la liste est filtrée par période ou par recherche, pour qu'il reste
// toujours exact.
export default function Caisse() {
  const { caisse, addMouvementCaisse, modifierMouvementCaisse, supprimerMouvementCaisse } = useDataStore();
  const { user } = useAuthStore();
  const { periode, recherche } = useUIStore();
  const peutModifier = peutModifierRole(user?.role);
  const peutSupprimer = peutSupprimerRole(user?.role);

  const [modal, setModal] = useState(null); // { data, id }
  const [toDelete, setToDelete] = useState(null);
  const [respecterPeriode, setRespecterPeriode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lecturePiece, setLecturePiece] = useState(false);
  const [filtreCategorie, setFiltreCategorie] = useState(""); // "" = toutes, SANS_CATEGORIE = sans catégorie

  // Historique complet avec reste en caisse après chaque mouvement, du plus ancien au plus récent.
  // Une éventuelle ancienne ligne « solde d'ouverture » est traitée comme une dotation ordinaire.
  const avecSolde = useMemo(() => {
    const rows = [...caisse]
      .map((m) => (m.ouverture ? { ...m, libelle: "Dotation initiale" } : m))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return rows.reduce((acc, m) => {
      const precedent = acc.length ? acc[acc.length - 1].solde : 0;
      return [...acc, { ...m, solde: precedent + (m.type === "entree" ? 1 : -1) * m.montant }];
    }, []);
  }, [caisse]);

  const soldeActuel = avecSolde.length ? avecSolde[avecSolde.length - 1].solde : 0;

  // Lignes de la période / recherche, avant le filtre par catégorie (sert au graphique par catégorie).
  const horsFiltreCategorie = useMemo(() => {
    let rows = avecSolde;
    if (respecterPeriode) rows = rows.filter((m) => matchPeriode(m.date, periode));
    if (recherche.trim()) {
      const q = recherche.toLowerCase();
      rows = rows.filter((m) =>
        `${m.libelle} ${m.categorie} ${m.beneficiaire}`.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [avecSolde, respecterPeriode, periode, recherche]);

  const affiches = useMemo(() => {
    if (!filtreCategorie) return horsFiltreCategorie;
    return horsFiltreCategorie.filter((m) => (filtreCategorie === SANS_CATEGORIE ? m.type === "sortie" && !m.categorie : m.categorie === filtreCategorie));
  }, [horsFiltreCategorie, filtreCategorie]);

  // Catégories réellement utilisées par les dépenses de la caisse (pour le filtre).
  const categoriesUtilisees = useMemo(
    () => [...new Set(caisse.filter((m) => m.type === "sortie" && m.categorie).map((m) => m.categorie))].sort((a, b) => a.localeCompare(b, "fr")),
    [caisse]
  );
  const existeSansCategorie = caisse.some((m) => m.type === "sortie" && !m.categorie);

  const totalEntrees = affiches.filter((m) => m.type === "entree").reduce((s, m) => s + m.montant, 0);
  const totalSorties = affiches.filter((m) => m.type === "sortie").reduce((s, m) => s + m.montant, 0);

  const parCategorie = useMemo(() => {
    const map = new Map();
    for (const m of horsFiltreCategorie) {
      if (m.type !== "sortie") continue;
      const cle = m.categorie || SANS_CATEGORIE;
      map.set(cle, (map.get(cle) || 0) + m.montant);
    }
    return [...map.entries()].map(([id, total]) => ({ id, total })).sort((a, b) => b.total - a.total);
  }, [horsFiltreCategorie]);
  const maxCategorie = Math.max(1, ...parCategorie.map((c) => c.total));

  // Propositions de catégorie dans le formulaire : liste de base + catégories déjà utilisées,
  // réduites à ce que l'utilisateur tape (sauf si le texte est déjà une proposition exacte).
  const categorieSaisie = (modal?.data.categorie || "").trim().toLowerCase();
  const propositionsCategorie = useMemo(() => {
    const toutes = [...new Set([...CATEGORIES_CAISSE, ...categoriesUtilisees])];
    if (!categorieSaisie || toutes.some((c) => c.toLowerCase() === categorieSaisie)) return toutes;
    return toutes.filter((c) => c.toLowerCase().includes(categorieSaisie));
  }, [categoriesUtilisees, categorieSaisie]);

  function ouvrirCreation(type = "sortie") { setError(""); setModal({ data: { ...VIDE(), type }, id: null }); }
  function ouvrirEdition(m) {
    setError("");
    setModal({ data: { date: m.date, type: m.type, libelle: m.libelle, montant: m.montant, categorie: m.categorie, beneficiaire: m.beneficiaire, piece: m.piece || null }, id: m.id });
  }
  const majChamp = (champ, valeur) => setModal((m) => ({ ...m, data: { ...m.data, [champ]: valeur } }));

  // Reste de la caisse une fois ce mouvement appliqué (en retirant l'effet de
  // l'ancienne version quand on modifie un mouvement existant).
  const effet = (type, montant) => (type === "entree" ? 1 : -1) * (Number(montant) || 0);
  const ancien = modal?.id ? caisse.find((m) => m.id === modal.id) : null;
  const soldeApres = modal
    ? soldeActuel - (ancien ? effet(ancien.type, ancien.montant) : 0) + effet(modal.data.type, modal.data.montant)
    : soldeActuel;
  const montantSaisi = modal ? Number(modal.data.montant) || 0 : 0;
  const decouvert = soldeApres < 0;
  const cfg = TYPES[modal?.data.type || "sortie"];

  async function soumettre(e) {
    e.preventDefault();
    const d = modal.data;
    if (!d.date) return setError("La date est obligatoire.");
    if (!(Number(d.montant) > 0)) return setError("Saisissez un montant supérieur à zéro.");
    if (d.type === "sortie" && !d.libelle.trim()) return setError("Indiquez l'objet de la dépense.");
    setSaving(true);
    setError("");
    const payload = {
      ...d, montant: Number(d.montant), libelle: d.libelle.trim(),
      secteurId: "", categorie: d.type === "sortie" ? d.categorie.trim() : "",
      piece: d.type === "sortie" ? d.piece : null,
    };
    const res = modal.id ? await modifierMouvementCaisse(modal.id, payload) : await addMouvementCaisse(payload);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setModal(null);
  }

  async function choisirPiece(e) {
    const fichier = e.target.files?.[0];
    e.target.value = "";
    if (!fichier) return;
    setLecturePiece(true);
    setError("");
    try {
      majChamp("piece", await lireFichier(fichier));
    } catch (err) {
      setError(err.message);
    }
    setLecturePiece(false);
  }

  async function confirmerSuppression(motif) {
    await enregistrerMotifSuppression({
      user, table: "caisse_mouvements", secteurId: toDelete.secteurId,
      label: `${toDelete.libelle || "Mouvement"} : ${fmtFCFA(toDelete.montant)} du ${new Date(toDelete.date).toLocaleDateString("fr-FR")}`, motif,
    });
    return supprimerMouvementCaisse(toDelete.id);
  }

  function exporterExcel() {
    const dateFr = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "");
    const lignes = [
      ...affiches.map((m) => ({
        Date: dateFr(m.date), Libellé: m.libelle, Catégorie: m.categorie || "",
        Bénéficiaire: m.beneficiaire || "", Justificatif: m.piece ? "Oui" : "", Entrée: m.type === "entree" ? m.montant : "", Sortie: m.type === "sortie" ? m.montant : "", "Reste en caisse": m.solde,
      })),
    ];
    const ws = XLSX.utils.json_to_sheet(lignes);
    ws["!cols"] = [{ wch: 12 }, { wch: 30 }, { wch: 22 }, { wch: 20 }, { wch: 13 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Caisse courante");
    XLSX.writeFile(wb, "caisse-courante.xlsx");
  }

  const affichageInverse = [...affiches].reverse();
  const etatVide = (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <Icone3D icon={Banknote} color={ACCENT} size={64} flotte />
      <p className="text-[13px] font-medium text-ink-soft">Aucun mouvement de caisse pour cet affichage.</p>
      {peutModifier && <Button icon={Plus} onClick={() => ouvrirCreation("sortie")}>Ajouter une dépense</Button>}
    </div>
  );

  return (
    <div>
      <TopBar title="Caisse" subtitle="Caisse courante : dotations en espèces et dépenses payées par la caisse" icon={Banknote} accent={ACCENT} />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mb-5">
        <StatTile compact icone3d icon={ArrowDownCircle} label="Dotations (affichées)" value={(totalEntrees > 0 ? "+" : "") + fmtFCFA(totalEntrees)} tone="#30D158" />
        <StatTile compact icone3d icon={ArrowUpCircle} label="Dépenses (affichées)" value={(totalSorties > 0 ? "-" : "") + fmtFCFA(totalSorties)} tone="#FF453A" />
        <div className="col-span-2 lg:col-span-1">
          <StatTile compact icone3d icon={Banknote} label="Reste en caisse" value={fmtFCFA(soldeActuel)} tone={soldeActuel < 0 ? "#FF453A" : ACCENT} />
        </div>
      </div>

      {parCategorie.length > 0 && (
        <GlassCard className="p-5 mb-5" hover={false}>
          <div className="flex items-center gap-3 mb-4">
            <Icone3D icon={Tag} color="#5E5CE6" size={34} />
            <div className="min-w-0">
              <h3 className="font-bold tracking-tight text-ink">Dépenses de la caisse par catégorie</h3>
              <p className="text-[11px] text-ink-soft">Touchez une catégorie pour ne voir que ses dépenses</p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            {parCategorie.map((p, i) => {
              const couleur = p.id === SANS_CATEGORIE ? "#8E8E93" : couleurCategorie(p.id);
              const actif = filtreCategorie === p.id;
              return (
                <motion.button
                  type="button"
                  key={p.id}
                  whileTap={{ scale: 0.985 }}
                  onClick={() => setFiltreCategorie(actif ? "" : p.id)}
                  className={`rounded-2xl px-3 py-2 text-left transition-colors ${actif ? "bg-black/[0.06]" : "hover:bg-black/[0.03]"}`}
                >
                  <div className="flex items-center justify-between gap-3 text-[12.5px] mb-1.5">
                    <span className="flex min-w-0 items-center gap-2 font-semibold text-ink">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: couleur, boxShadow: `0 0 0 3px ${couleur}26` }} />
                      <span className="truncate">{p.id === SANS_CATEGORIE ? "Sans catégorie" : p.id}</span>
                      {actif && <Check size={13} strokeWidth={3} className="shrink-0 text-ink-soft" />}
                    </span>
                    <span className="shrink-0 tabular font-bold text-ink">{fmtFCFA(p.total)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-black/[0.06] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${(p.total / maxCategorie) * 100}%` }}
                      transition={{ duration: 0.8, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                      style={{ background: `linear-gradient(90deg, ${couleur}, ${couleur}bb)`, boxShadow: `0 0 10px ${couleur}66` }}
                    />
                  </div>
                </motion.button>
              );
            })}
          </div>
        </GlassCard>
      )}

      <div className="flex items-center gap-3 flex-wrap mb-4">
        <label className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft cursor-pointer">
          <input type="checkbox" checked={respecterPeriode} onChange={(e) => setRespecterPeriode(e.target.checked)} className="w-4 h-4 rounded accent-[#FF9F0A]" />
          Limiter à la période sélectionnée
        </label>
        <span className="text-[12.5px] text-ink-soft font-medium">{affiches.length} mouvement(s)</span>
        <label className="relative flex w-full items-center sm:w-auto">
          <Tag size={14} strokeWidth={2.4} className="pointer-events-none absolute left-3 text-ink-soft/70" />
          <select
            value={filtreCategorie}
            onChange={(e) => setFiltreCategorie(e.target.value)}
            aria-label="Filtrer par catégorie"
            className={`glass w-full cursor-pointer rounded-2xl py-2.5 pl-8 pr-3 text-[14px] font-semibold outline-none sm:w-auto ${filtreCategorie ? "text-ink" : "text-ink-soft"}`}
          >
            <option value="">Toutes les catégories</option>
            {categoriesUtilisees.map((c) => <option key={c} value={c}>{c}</option>)}
            {existeSansCategorie && <option value={SANS_CATEGORIE}>Sans catégorie</option>}
          </select>
        </label>
        <div className="grid w-full grid-cols-2 gap-2.5 sm:ml-auto sm:flex sm:w-auto">
          {peutModifier && <Button icon={Plus} onClick={() => ouvrirCreation("sortie")} className="order-first col-span-2 sm:order-last sm:col-span-1">Ajouter une dépense</Button>}
          {peutModifier && <Button variant="ghost" icon={PiggyBank} onClick={() => ouvrirCreation("entree")}>Ajouter une dotation</Button>}
          <Button variant="ghost" icon={FileDown} onClick={exporterExcel} >Exporter Excel</Button>
        </div>
      </div>

      {/* Mobile et tablette : une carte par mouvement, sans défilement horizontal */}
      <div className="xl:hidden">
        {affiches.length === 0 ? (
          <GlassCard className="p-4" hover={false}>{etatVide}</GlassCard>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {affichageInverse.map((m, i) => {
              const t = TYPES[m.type];
              const FlecheType = m.type === "entree" ? ArrowDownLeft : ArrowUpRight;
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 8) * 0.04, duration: 0.3 }}
                  className="glass rounded-3xl p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: `${t.couleur}1a`, color: t.couleur }}>
                      <FlecheType size={18} strokeWidth={2.6} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-bold leading-snug text-ink">{m.libelle || "—"}</p>
                      <p className="mt-0.5 text-[11.5px] text-ink-soft">{new Date(m.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</p>
                    </div>
                    <p className="shrink-0 text-right text-[15px] font-extrabold tabular" style={{ color: m.type === "entree" ? "#1a7d34" : "#b3241b" }}>
                      {m.type === "entree" ? "+" : "-"}{fmtFCFA(m.montant)}
                    </p>
                  </div>
                  {(m.categorie || m.beneficiaire || m.piece) && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {m.categorie && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.05] px-2.5 py-1 text-[11px] font-semibold text-ink-soft"><Tag size={10} />{m.categorie}</span>
                      )}
                      {m.beneficiaire && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.05] px-2.5 py-1 text-[11px] font-semibold text-ink-soft"><UserRound size={10} />{m.beneficiaire}</span>
                      )}
                      {m.piece && (
                        <button type="button" onClick={() => ouvrirPiece(m.piece)} className="inline-flex items-center gap-1 rounded-full bg-[#FF9F0A]/15 px-2.5 py-1 text-[11px] font-bold text-[#a8630a] active:scale-95">
                          <Paperclip size={10} />Justificatif
                        </button>
                      )}
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-black/[0.06] pt-2.5">
                    <p className="text-[11.5px] text-ink-soft">
                      Solde <span className={`font-extrabold tabular ${m.solde < 0 ? "text-[#b3241b]" : "text-ink"}`}>{fmtFCFA(m.solde)}</span>
                    </p>
                    {(peutModifier || peutSupprimer) && (
                      <div className="flex gap-1">
                        {peutModifier && <motion.button whileTap={{ scale: 0.88 }} onClick={() => ouvrirEdition(m)} title="Modifier" className="rounded-xl p-2.5 text-ink-soft hover:bg-black/[0.05]"><Pencil size={16} /></motion.button>}
                        {peutSupprimer && <motion.button whileTap={{ scale: 0.88 }} onClick={() => setToDelete(m)} title="Supprimer" className="rounded-xl p-2.5 text-[#FF453A] hover:bg-[#FF453A]/10"><Trash2 size={16} /></motion.button>}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <GlassCard className="hidden overflow-hidden p-2 xl:block" hover={false}>
        <div className="max-h-[calc(100vh-340px)] overflow-auto">
          <table className="w-full min-w-[820px] border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="text-left text-[11.5px] font-bold text-ink-soft uppercase tracking-wide">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Libellé</th>
                <th className="px-4 py-3">Bénéficiaire</th>
                <th className="px-4 py-3 text-right">Entrée</th>
                <th className="px-4 py-3 text-right">Sortie</th>
                <th className="px-4 py-3 text-right">Solde</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {affichageInverse.map((m, i) => {
                const t = TYPES[m.type];
                const FlecheType = m.type === "entree" ? ArrowDownLeft : ArrowUpRight;
                return (
                  <motion.tr
                    key={m.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 10) * 0.03, duration: 0.3 }}
                    className="text-[13.5px] hover:bg-white/50 transition-colors"
                  >
                    <td className="px-4 py-2.5 tabular text-ink-soft whitespace-nowrap">{new Date(m.date).toLocaleDateString("fr-FR")}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: `${t.couleur}1a`, color: t.couleur }}>
                          <FlecheType size={16} strokeWidth={2.6} />
                        </span>
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 font-semibold text-ink">
                            {m.libelle || "—"}
                            {m.piece && (
                              <button type="button" onClick={() => ouvrirPiece(m.piece)} title={`Voir le justificatif : ${m.piece.nom}`} className="rounded-md p-0.5 text-[#FF9F0A] hover:bg-[#FF9F0A]/15">
                                <Paperclip size={13} strokeWidth={2.4} />
                              </button>
                            )}
                          </p>
                          {m.categorie && <p className="flex items-center gap-1 text-[11px] text-ink-soft"><Tag size={10} />{m.categorie}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-ink-soft">{m.beneficiaire || "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular font-bold text-[#1a7d34]">{m.type === "entree" ? "+" + fmtFCFA(m.montant) : ""}</td>
                    <td className="px-4 py-2.5 text-right tabular font-bold text-[#b3241b]">{m.type === "sortie" ? "-" + fmtFCFA(m.montant) : ""}</td>
                    <td className={`px-4 py-2.5 text-right tabular font-extrabold ${m.solde < 0 ? "text-[#b3241b]" : "text-ink"}`}>{fmtFCFA(m.solde)}</td>
                    <td className="px-4 py-2.5">
                      {(peutModifier || peutSupprimer) && (
                        <div className="flex justify-end gap-1">
                          {peutModifier && <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onClick={() => ouvrirEdition(m)} title="Modifier" className="rounded-lg p-1.5 text-ink-soft hover:bg-black/[0.05] hover:text-ink"><Pencil size={14} /></motion.button>}
                          {peutSupprimer && <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onClick={() => setToDelete(m)} title="Supprimer" className="rounded-lg p-1.5 text-[#FF453A] hover:bg-[#FF453A]/10"><Trash2 size={14} /></motion.button>}
                        </div>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
              {affiches.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6">{etatVide}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.id ? (modal.data.type === "entree" ? "Modifier la dotation" : "Modifier la dépense") : (modal?.data.type === "entree" ? "Nouvelle dotation" : "Nouvelle dépense")}
        moduleLabel="Caisse courante"
        iconNode={<Icone3D icon={Banknote} color={ACCENT} size={46} flotte />}
        accent={ACCENT}
        feuille
        footerCollant
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>Annuler</Button>
            <BoutonEnregistrer couleur={cfg.couleur} foncee={cfg.foncee} saving={saving} onClick={soumettre}>{modal?.id ? "Enregistrer les modifications" : cfg.bouton}</BoutonEnregistrer>
          </>
        }
      >
        {modal && (
          <form onSubmit={soumettre}>
            <MessageErreur message={error} />

            <div className="grid grid-cols-2 gap-2.5 mb-5">
              {["sortie", "entree"].map((type) => {
                const t = TYPES[type];
                const actif = modal.data.type === type;
                return (
                  <motion.button
                    key={type} type="button" onClick={() => majChamp("type", type)}
                    whileTap={{ scale: 0.97 }}
                    className="relative rounded-2xl border p-3 text-left"
                    style={{ borderColor: actif ? "transparent" : "rgba(0,0,0,0.08)" }}
                  >
                    {actif && (
                      <motion.span
                        layoutId="caisse-type-actif"
                        className="absolute inset-0 rounded-2xl"
                        style={{ background: `linear-gradient(135deg, ${t.couleur}1f, ${t.couleur}0a)`, boxShadow: `0 0 0 1.5px ${t.couleur}80, 0 12px 26px -12px ${t.couleur}` }}
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      />
                    )}
                    <span className="relative flex flex-col items-start gap-2.5">
                      <Icone3D icon={t.icone} color={t.couleur} size={40} flotte={actif} />
                      <span className="min-w-0">
                        <span className={`block text-[14px] font-bold leading-tight ${actif ? "text-ink" : "text-ink-soft"}`}>{t.titre}</span>
                        <span className="block text-[11px] leading-snug text-ink-soft/80 mt-0.5">{t.sous}</span>
                      </span>
                    </span>
                    <AnimatePresence>
                      {actif && (
                        <motion.span
                          initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-white"
                          style={{ background: t.couleur, boxShadow: `0 4px 10px -2px ${t.couleur}` }}
                        >
                          <Check size={12} strokeWidth={3} />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>

            <Champ label={modal.data.type === "sortie" ? "Objet de la dépense" : "Libellé"} icone={PenLine} couleur={cfg.couleur}
              hint={modal.data.type === "sortie" ? "Ex : achat de carburant, frais de déplacement" : "Ex : retrait bancaire pour la caisse, versement de recette"}>
              <input className={CLASSE_CHAMP} value={modal.data.libelle} onChange={(e) => majChamp("libelle", e.target.value)} />
            </Champ>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
              <Champ label="Date" icone={CalendarDays} couleur={cfg.couleur}>
                <input type="date" className={CLASSE_CHAMP} value={modal.data.date} onChange={(e) => majChamp("date", e.target.value)} />
              </Champ>
              <Champ label="Montant (FCFA)" icone={Coins} couleur={cfg.couleur}>
                <input type="number" min="0" className={`${CLASSE_CHAMP} ${SANS_FLECHES} pr-16 text-[16px] font-bold tabular`} value={modal.data.montant} onChange={(e) => majChamp("montant", e.target.value)} placeholder="25 000" />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold tracking-wide text-ink-soft/70">FCFA</span>
              </Champ>
            </div>

            <AnimatePresence initial={false}>
              {montantSaisi > 0 && (
                <motion.div
                  key="apercu"
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 14 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div
                    className="rounded-2xl border p-3.5 transition-colors duration-300"
                    style={{ background: decouvert ? "#FF453A12" : `${cfg.couleur}0d`, borderColor: decouvert ? "#FF453A55" : `${cfg.couleur}33` }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">Reste actuel</p>
                        <p className="tabular text-[14px] font-bold text-ink">{fmtFCFA(soldeActuel)}</p>
                      </div>
                      <motion.span animate={{ x: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.3, ease: "easeInOut" }} className="flex text-ink-soft">
                        <ArrowRight size={18} strokeWidth={2.4} />
                      </motion.span>
                      <div className="text-left sm:text-right">
                        <p className="flex items-center justify-start gap-1 text-[10px] font-bold uppercase tracking-wide text-ink-soft sm:justify-end"><Sparkles size={10} />Nouveau reste</p>
                        <p className="tabular whitespace-nowrap text-[18px] font-extrabold" style={{ color: decouvert ? "#b3241b" : cfg.foncee }}><NombreAnime valeur={soldeApres} /></p>
                      </div>
                    </div>
                    <AnimatePresence>
                      {decouvert && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                          className="flex items-start gap-1.5 overflow-hidden pt-2.5 text-[11.5px] font-medium text-[#b3241b]"
                        >
                          <TriangleAlert size={13} strokeWidth={2.5} className="mt-px shrink-0" />
                          La caisse serait à découvert de {fmtFCFA(Math.abs(soldeApres))}. Vérifiez qu'une dotation n'a pas été oubliée.
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {modal.data.type === "sortie" && (
                <motion.div
                  key="details-sortie"
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="-mx-1 overflow-hidden px-1"
                >
                  <Champ label="Catégorie" icone={Tag} couleur={cfg.couleur} hint="Choisissez une proposition ou saisissez la vôtre">
                    <input className={CLASSE_CHAMP} value={modal.data.categorie} onChange={(e) => majChamp("categorie", e.target.value)} />
                  </Champ>
                  {propositionsCategorie.length > 0 && (
                    <div className="-mt-1 mb-3.5 flex flex-wrap gap-1.5">
                      {propositionsCategorie.map((c) => {
                        const actif = modal.data.categorie.trim().toLowerCase() === c.toLowerCase();
                        return (
                          <motion.button
                            type="button"
                            key={c}
                            whileTap={{ scale: 0.92 }}
                            onClick={() => majChamp("categorie", actif ? "" : c)}
                            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${actif ? "text-white" : "bg-black/[0.05] text-ink-soft hover:bg-black/[0.09]"}`}
                            style={actif ? { background: cfg.couleur, boxShadow: `0 4px 12px ${cfg.couleur}55` } : undefined}
                          >
                            {c}
                          </motion.button>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <Champ label={modal.data.type === "sortie" ? "Bénéficiaire" : "Versé par"} icone={UserRound} couleur={cfg.couleur} hint="Facultatif">
              <input className={CLASSE_CHAMP} value={modal.data.beneficiaire} onChange={(e) => majChamp("beneficiaire", e.target.value)} />
            </Champ>

            <AnimatePresence initial={false}>
              {modal.data.type === "sortie" && (
                <motion.div
                  key="justificatif"
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="-mx-1 overflow-hidden px-1"
                >
                  <span className="ml-1 text-[12.5px] font-semibold text-ink-soft">Justificatif</span>
                  <AnimatePresence mode="wait" initial={false}>
                    {modal.data.piece ? (
                      <motion.div
                        key="piece"
                        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
                        className="glass mt-1.5 mb-1 flex items-center gap-3 rounded-2xl p-2.5"
                      >
                        {modal.data.piece.type.startsWith("image/") ? (
                          <img src={modal.data.piece.dataURL} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                        ) : (
                          <Icone3D icon={FileText} color="#FF453A" size={44} />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-bold text-ink">{modal.data.piece.nom}</p>
                          <p className="text-[11px] text-ink-soft">{formatTaille(modal.data.piece.taille)}</p>
                        </div>
                        <motion.button type="button" whileTap={{ scale: 0.88 }} onClick={() => ouvrirPiece(modal.data.piece)} title="Voir" className="rounded-xl p-2.5 text-ink-soft hover:bg-black/[0.05]"><Eye size={17} /></motion.button>
                        <motion.button type="button" whileTap={{ scale: 0.88 }} onClick={() => majChamp("piece", null)} title="Retirer" className="rounded-xl p-2.5 text-[#FF453A] hover:bg-[#FF453A]/10"><X size={17} /></motion.button>
                      </motion.div>
                    ) : (
                      <motion.label
                        key="ajout"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        whileTap={{ scale: 0.985 }}
                        className="group mt-1.5 mb-1 flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-black/15 px-4 py-3.5 transition-colors hover:border-(--c) hover:bg-(--c)/5"
                        style={{ "--c": cfg.couleur }}
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--c)/12 text-(--c) transition-transform group-hover:-translate-y-0.5">
                          {lecturePiece ? <LoaderCircle size={18} className="animate-spin" /> : <Upload size={18} strokeWidth={2.4} />}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[13.5px] font-bold text-ink">{lecturePiece ? "Chargement…" : "Joindre un justificatif"}</span>
                          <span className="block text-[11px] text-ink-soft">Photo ou PDF (4 Mo max), facultatif</span>
                        </span>
                        <input type="file" accept="image/*,application/pdf" className="hidden" onChange={choisirPiece} disabled={lecturePiece} />
                      </motion.label>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        )}
      </Modal>

      <ConfirmSuppressionModal
        open={!!toDelete}
        titre="Supprimer ce mouvement de caisse ?"
        description={toDelete ? `Vous allez supprimer « ${toDelete.libelle || "mouvement"} » de ${fmtFCFA(toDelete.montant)} du ${new Date(toDelete.date).toLocaleDateString("fr-FR")}.` : ""}
        onConfirm={confirmerSuppression}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
