import { useEffect, useMemo, useState } from "react";
import { Archive as ArchiveIcon, Clock } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import GlassCard from "../components/ui/GlassCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import { Select } from "../components/ui/Field";
import { useDataStore } from "../store/dataStore";
import { useAuthStore } from "../store/authStore";
import { ROLES_ACCES_TOTAL } from "../lib/modules";
import { fmtFCFA } from "../lib/logic";

const TYPE_LABEL = { depense: "Dépense", recette: "Recette", journal: "Action" };
const TYPE_TONE = { depense: "coral", recette: "mint", journal: "ink" };
const MOTIF_LABEL = { suppression_module: "Module supprimé", anciennete: "Ancienneté (+1 an)" };
const MOTIF_TONE = { suppression_module: "amber", anciennete: "accent" };

// Volet Archives : où se logent, pour toujours, les dépenses/recettes/actions
// d'un module supprimé ainsi que celles de plus d'un an — à la demande
// explicite de l'utilisateur (2026-09-15) : « on peut supprimer un module
// mais ses actions et mouvements restent dans les archives ». Réservé aux
// rôles à accès total, comme le Journal (audit sensible).
export default function Archives() {
  const { user } = useAuthStore();
  const { archives, chargerArchives, archiverAnciennete } = useDataStore();
  const [chargement, setChargement] = useState(true);
  const [filtreType, setFiltreType] = useState("tous");
  const [archivage, setArchivage] = useState(false);
  const [resultat, setResultat] = useState("");

  useEffect(() => {
    chargerArchives().finally(() => setChargement(false));
  }, [chargerArchives]);

  if (!ROLES_ACCES_TOTAL.includes(user?.role)) {
    return (
      <GlassCard className="p-8 text-center" hover={false}>
        <p className="text-[13.5px] text-ink-soft">Cette page est réservée aux rôles à accès total.</p>
      </GlassCard>
    );
  }

  const liste = filtreType === "tous" ? archives : archives.filter((a) => a.type === filtreType);

  async function lancerArchivageAnciennete() {
    setArchivage(true);
    setResultat("");
    const res = await archiverAnciennete(user);
    setArchivage(false);
    if (!res.ok) return setResultat(`Échec : ${res.error}`);
    setResultat(res.archivees === 0 ? "Aucune donnée de plus d'un an à archiver." : `${res.archivees} enregistrement(s) archivé(s).`);
    await chargerArchives();
  }

  return (
    <div>
      <TopBar title="Archives" subtitle="Dépenses, recettes et actions conservées : modules supprimés et données de plus d'un an" icon={ArchiveIcon} accent="#8E8E93" />

      <GlassCard className="p-6 mb-5" hover={false}>
        <div className="flex items-start gap-3">
          <Clock size={20} className="mt-0.5 shrink-0 text-ink-soft" />
          <div className="flex-1">
            <h3 className="font-bold tracking-tight text-ink">Archivage par ancienneté</h3>
            <p className="mt-1 text-[12.5px] text-ink-soft">
              Copie dans les archives puis retire de la base active toutes les dépenses, recettes et actions du journal antérieures à un an. Rien n'est perdu : tout reste consultable ci-dessous.
            </p>
            <Button variant="ghost" className="mt-3" icon={Clock} onClick={lancerArchivageAnciennete} disabled={archivage}>
              {archivage ? "Archivage…" : "Archiver les données de plus d'un an"}
            </Button>
            {resultat && <p className="mt-2 text-[12.5px] font-semibold text-ink">{resultat}</p>}
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-6" hover={false}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-bold tracking-tight text-ink flex items-center gap-2">
            <ArchiveIcon size={17} className="text-ink-soft" /> {liste.length} enregistrement(s) archivé(s)
          </h3>
          <div className="w-full sm:w-48">
            <Select value={filtreType} onChange={(e) => setFiltreType(e.target.value)}>
              <option value="tous">Tous les types</option>
              <option value="depense">Dépenses</option>
              <option value="recette">Recettes</option>
              <option value="journal">Actions</option>
            </Select>
          </div>
        </div>

        {chargement ? (
          <p className="text-[13px] text-ink-soft italic">Chargement…</p>
        ) : liste.length === 0 ? (
          <p className="text-[13px] text-ink-soft italic">Aucune archive pour le moment.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11.5px] uppercase tracking-wide text-ink-soft/70">
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Secteur / module</th>
                  <th className="px-3 py-2">Détail</th>
                  <th className="px-3 py-2">Date d'origine</th>
                  <th className="px-3 py-2">Motif</th>
                  <th className="px-3 py-2 text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {liste.map((a) => (
                  <LigneArchive key={a.id} archive={a} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

function LigneArchive({ archive }) {
  const d = archive.data || {};
  const detail = useMemo(() => {
    if (archive.type === "depense") return d.description || d.categorie || "—";
    if (archive.type === "recette") return d.description || d.origine || d.client || "—";
    return d.details || d.action || "—";
  }, [archive.type, d]);

  return (
    <tr className="border-t border-black/5">
      <td className="px-3 py-2.5"><Badge tone={TYPE_TONE[archive.type] || "ink"}>{TYPE_LABEL[archive.type] || archive.type}</Badge></td>
      <td className="px-3 py-2.5 font-semibold text-ink">{archive.secteurNom || "—"}</td>
      <td className="px-3 py-2.5 text-ink-soft max-w-[320px] truncate" title={detail}>{detail}</td>
      <td className="px-3 py-2.5 text-ink-soft">
        {archive.dateOrigine ? new Date(archive.dateOrigine).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
      </td>
      <td className="px-3 py-2.5"><Badge tone={MOTIF_TONE[archive.motif] || "ink"}>{MOTIF_LABEL[archive.motif] || archive.motif}</Badge></td>
      <td className="px-3 py-2.5 text-right font-bold tabular text-ink">
        {archive.type !== "journal" && d.montant != null ? fmtFCFA(Number(d.montant)) : "—"}
      </td>
    </tr>
  );
}
