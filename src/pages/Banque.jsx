import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Plus, Landmark, ArrowDownCircle, ArrowUpCircle, Pencil, Trash2, FileDown } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import GlassCard from "../components/ui/GlassCard";
import StatTile from "../components/ui/StatTile";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import Field, { TextInput } from "../components/ui/Field";
import { useDataStore } from "../store/dataStore";
import { fmtFCFA } from "../lib/logic";
import { ROLES_ACCES_TOTAL } from "../lib/modules";
import { useAuthStore } from "../store/authStore";

// Compte bancaire — mouvements de dépôts/retraits, miroir du relevé bancaire,
// avec solde courant calculé automatiquement. Porté depuis
// termitiere-platform/src/modules/depense/Banque.jsx (version simplifiée :
// pas d'export Excel stylé, ce projet n'a pas la dépendance xlsx-js-style).
export default function Banque() {
  const { banque, addMouvementBanque, modifierMouvementBanque, supprimerMouvementBanque, definirSoldeOuverture } = useDataStore();
  const { user } = useAuthStore();
  const peutModifier = ROLES_ACCES_TOTAL.includes(user?.role);

  const [modal, setModal] = useState(null); // { data, id }
  const [modalOuverture, setModalOuverture] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const ouverture = useMemo(() => banque.find((m) => m.ouverture), [banque]);
  const soldeInitial = ouverture?.montant || 0;

  const avecSolde = useMemo(() => {
    const rows = [...banque]
      .filter((m) => !m.ouverture)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return rows.reduce((acc, m) => {
      const soldePrecedent = acc.length ? acc[acc.length - 1].solde : soldeInitial;
      const solde = soldePrecedent + (m.type === "depot" ? 1 : -1) * (Number(m.montant) || 0);
      return [...acc, { ...m, solde }];
    }, []);
  }, [banque, soldeInitial]);

  const soldeActuel = avecSolde.length ? avecSolde[avecSolde.length - 1].solde : soldeInitial;
  const totalDepots = avecSolde.filter((m) => m.type === "depot").reduce((s, m) => s + m.montant, 0);
  const totalRetraits = avecSolde.filter((m) => m.type === "retrait").reduce((s, m) => s + m.montant, 0);

  function openCreate() { setModal({ data: { date: new Date().toISOString().slice(0, 10), type: "depot", libelle: "", origine: "", personne: "", montant: "" }, id: null }); }
  function openEdit(m) { setModal({ data: { date: m.date, type: m.type, libelle: m.libelle, origine: m.origine, personne: m.personne, montant: m.montant }, id: m.id }); }

  async function submit(e) {
    e.preventDefault();
    const d = modal.data;
    if (!d.date || !d.montant) return;
    setSaving(true);
    setError("");
    const payload = { ...d, montant: Number(d.montant) };
    const res = modal.id ? await modifierMouvementBanque(modal.id, payload) : await addMouvementBanque(payload);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setModal(null);
  }

  async function submitOuverture(e) {
    e.preventDefault();
    setSaving(true);
    const res = await definirSoldeOuverture(ouverture?.id, modalOuverture.date, Number(modalOuverture.montant) || 0);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setModalOuverture(null);
  }

  async function confirmerSuppression() {
    setSaving(true);
    await supprimerMouvementBanque(toDelete.id);
    setSaving(false);
    setToDelete(null);
  }

  function exportExcel() {
    const rows = [
      { Date: ouverture?.date ? new Date(ouverture.date).toLocaleDateString("fr-FR") : "", Libellé: "SOLDE D'OUVERTURE", Origine: "", Personne: "", Dépôt: "", Retrait: "", Solde: soldeInitial },
      ...avecSolde.map((m) => ({
        Date: new Date(m.date).toLocaleDateString("fr-FR"),
        Libellé: m.libelle || "",
        Origine: m.origine || "",
        Personne: m.personne || "",
        Dépôt: m.type === "depot" ? m.montant : "",
        Retrait: m.type === "retrait" ? m.montant : "",
        Solde: m.solde,
      })),
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 12 }, { wch: 26 }, { wch: 26 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Compte bancaire");
    XLSX.writeFile(wb, "compte-bancaire.xlsx");
  }

  return (
    <div>
      <TopBar title="Compte bancaire" subtitle="Dépôts et retraits — miroir du relevé bancaire de l'entreprise" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 mb-5">
        <StatTile icon={Landmark} label="Solde actuel" value={fmtFCFA(soldeActuel)} tone="#0A84FF" onClick={peutModifier ? () => setModalOuverture({ date: ouverture?.date || new Date().toISOString().slice(0, 10), montant: soldeInitial }) : undefined} />
        <StatTile icon={ArrowDownCircle} label="Dépôts (total)" value={"+" + fmtFCFA(totalDepots)} tone="#30D158" />
        <StatTile icon={ArrowUpCircle} label="Retraits (total)" value={"-" + fmtFCFA(totalRetraits)} tone="#FF453A" />
      </div>

      <div className="flex items-center gap-2.5 mb-4">
        <span className="text-[12.5px] text-ink-soft font-medium">{avecSolde.length} mouvement(s)</span>
        <div className="ml-auto flex gap-2.5">
          <Button variant="ghost" icon={FileDown} onClick={exportExcel}>Exporter Excel</Button>
          {peutModifier && <Button icon={Plus} onClick={openCreate}>Ajouter un mouvement</Button>}
        </div>
      </div>

      <GlassCard className="p-2 overflow-hidden" hover={false}>
        <div className="max-h-[calc(100vh-360px)] overflow-auto">
          <table className="w-full min-w-[680px] border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="text-left text-[11.5px] font-bold text-ink-soft uppercase tracking-wide">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Libellé / Origine</th>
                <th className="px-4 py-3">Personne</th>
                <th className="px-4 py-3 text-right">Dépôt</th>
                <th className="px-4 py-3 text-right">Retrait</th>
                <th className="px-4 py-3 text-right">Solde</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              <tr className="text-[13px]">
                <td className="px-4 py-2.5"></td>
                <td className="px-4 py-2.5 font-extrabold uppercase tracking-wide text-ink-soft">{ouverture?.date ? `SOLDE AU ${new Date(ouverture.date).toLocaleDateString("fr-FR")}` : "SOLDE D'OUVERTURE"}</td>
                <td className="px-4 py-2.5"></td>
                <td className="px-4 py-2.5"></td>
                <td className="px-4 py-2.5"></td>
                <td className="px-4 py-2.5 text-right font-extrabold tabular text-ink">{fmtFCFA(soldeInitial)}</td>
                <td className="px-4 py-2.5"></td>
              </tr>
              {avecSolde.map((m) => (
                <tr key={m.id} className="text-[13.5px] hover:bg-white/50 transition-colors">
                  <td className="px-4 py-2.5 tabular text-ink-soft whitespace-nowrap">{new Date(m.date).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-2.5">
                    <p className="font-semibold text-ink">{m.libelle || "—"}</p>
                    {m.origine && <p className="text-[11px] text-ink-soft">{m.origine}</p>}
                  </td>
                  <td className="px-4 py-2.5 text-ink-soft">{m.personne || "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular font-bold text-[#0A5CB3]">{m.type === "depot" ? "+" + fmtFCFA(m.montant) : ""}</td>
                  <td className="px-4 py-2.5 text-right tabular font-bold text-[#b3241b]">{m.type === "retrait" ? "-" + fmtFCFA(m.montant) : ""}</td>
                  <td className="px-4 py-2.5 text-right tabular font-extrabold text-ink">{fmtFCFA(m.solde)}</td>
                  <td className="px-4 py-2.5">
                    {peutModifier && (
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(m)} className="rounded-lg p-1.5 text-[#0A84FF] hover:bg-[#0A84FF]/10"><Pencil size={14} /></button>
                        <button onClick={() => setToDelete(m)} className="rounded-lg p-1.5 text-[#FF453A] hover:bg-[#FF453A]/10"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {avecSolde.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-[13px] text-ink-soft italic">Aucun mouvement bancaire enregistré.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.id ? "Modifier le mouvement" : "Ajouter un mouvement bancaire"}
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Annuler</Button><Button onClick={submit} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></>}
      >
        {modal && (
          <form onSubmit={submit}>
            {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
            <Field label="Type de mouvement">
              <div className="flex gap-2">
                <button type="button" onClick={() => setModal((m) => ({ ...m, data: { ...m.data, type: "depot" } }))}
                  className={`flex-1 rounded-2xl border px-3 py-2.5 text-[13px] font-bold transition-colors ${modal.data.type === "depot" ? "border-[#0A84FF] bg-[#0A84FF1a] text-[#0A84FF]" : "border-black/10 text-ink-soft"}`}>
                  ⬇️ Dépôt
                </button>
                <button type="button" onClick={() => setModal((m) => ({ ...m, data: { ...m.data, type: "retrait" } }))}
                  className={`flex-1 rounded-2xl border px-3 py-2.5 text-[13px] font-bold transition-colors ${modal.data.type === "retrait" ? "border-[#FF453A] bg-[#FF453A1a] text-[#FF453A]" : "border-black/10 text-ink-soft"}`}>
                  ⬆️ Retrait
                </button>
              </div>
            </Field>
            <Field label="Libellé" hint="Ex : DEPOT, RETRAIT CHÈQUE, ALIMENTATION CAISSE…">
              <TextInput value={modal.data.libelle} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, libelle: e.target.value } }))} placeholder="DEPOT" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Date">
                <TextInput type="date" value={modal.data.date} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, date: e.target.value } }))} />
              </Field>
              <Field label="Montant (FCFA)">
                <TextInput type="number" min="0" value={modal.data.montant} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, montant: e.target.value } }))} placeholder="100 000" />
              </Field>
            </div>
            <Field label="Origine / destination des fonds" hint="D'où vient l'argent (dépôt) ou à quoi il sert (retrait)">
              <TextInput value={modal.data.origine} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, origine: e.target.value } }))} placeholder="ex : RECETTE LOGISTIQUE" />
            </Field>
            <Field label="Personne en charge">
              <TextInput value={modal.data.personne} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, personne: e.target.value } }))} />
            </Field>
          </form>
        )}
      </Modal>

      <Modal
        open={!!modalOuverture}
        onClose={() => setModalOuverture(null)}
        title="Solde d'ouverture du compte"
        footer={<><Button variant="ghost" onClick={() => setModalOuverture(null)}>Annuler</Button><Button onClick={submitOuverture} disabled={saving}>Enregistrer</Button></>}
      >
        {modalOuverture && (
          <form onSubmit={submitOuverture}>
            <p className="text-[12.5px] text-ink-soft mb-3">Solde du compte avant le premier mouvement enregistré ici. Tous les soldes affichés en découlent.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Date">
                <TextInput type="date" value={modalOuverture.date} onChange={(e) => setModalOuverture((s) => ({ ...s, date: e.target.value }))} />
              </Field>
              <Field label="Montant (FCFA)">
                <TextInput type="number" value={modalOuverture.montant} onChange={(e) => setModalOuverture((s) => ({ ...s, montant: e.target.value }))} />
              </Field>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Supprimer ce mouvement ?"
        footer={<><Button variant="ghost" onClick={() => setToDelete(null)}>Annuler</Button><Button variant="danger" onClick={confirmerSuppression} disabled={saving}>Supprimer</Button></>}
      >
        {toDelete && <p className="text-[13px] text-ink-soft">Vous allez supprimer le mouvement de <strong className="text-ink">{fmtFCFA(toDelete.montant)}</strong> du {new Date(toDelete.date).toLocaleDateString("fr-FR")}. Cette action est irréversible.</p>}
      </Modal>
    </div>
  );
}
