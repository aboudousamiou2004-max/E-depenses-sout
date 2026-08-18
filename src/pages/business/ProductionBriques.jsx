import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, Factory, Layers, ArrowRight } from "lucide-react";
import TopBarSimple from "../../components/layout/TopBarSimple";
import GlassCard from "../../components/ui/GlassCard";
import StatTile from "../../components/ui/StatTile";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field, { TextInput, Select } from "../../components/ui/Field";
import { useStockStore } from "../../store/stockStore";
import { useAuthStore } from "../../store/authStore";
import { ETATS_BRIQUE } from "../../data/stockData";

// Production E-BRIQUETERIE — volet dédié (extrait de l'ancien Stock de
// briques, désormais réparti entre Production, Matériaux et Matériel), à la
// demande explicite de l'utilisateur (2026-08-18) : enregistre les briques
// produites (état « appâtam ») et leur transition jusqu'à « prêt à la vente ».
export default function ProductionBriques() {
  const config = useOutletContext();
  const { user } = useAuthStore();
  const { typesBriques, stockBriques, journalBriques, ajouterProduction, transitionBrique } = useStockStore();

  const [openProd, setOpenProd] = useState(false);
  const [prodForm, setProdForm] = useState({ typeId: typesBriques[0]?.id, quantite: "" });
  const [openTrans, setOpenTrans] = useState(false);
  const [transForm, setTransForm] = useState({ typeId: typesBriques[0]?.id, de: "appatam", vers: "sechage", quantite: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const totalPret = typesBriques.reduce((acc, t) => acc + (stockBriques[t.id]?.pret || 0), 0);
  const totalAppatam = typesBriques.reduce((acc, t) => acc + (stockBriques[t.id]?.appatam || 0), 0);
  const totalCaillasses = typesBriques.reduce((acc, t) => acc + (stockBriques[t.id]?.caillasses || 0), 0);
  const valeurPret = typesBriques.reduce((acc, t) => acc + (stockBriques[t.id]?.pret || 0) * t.tarifVente, 0);

  async function submitProd(e) {
    e.preventDefault();
    if (!prodForm.quantite) return;
    setSaving(true);
    setError("");
    const res = await ajouterProduction(prodForm.typeId, prodForm.quantite, user);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setOpenProd(false);
    setProdForm((f) => ({ ...f, quantite: "" }));
  }

  async function submitTrans(e) {
    e.preventDefault();
    if (!transForm.quantite || transForm.de === transForm.vers) return;
    setSaving(true);
    setError("");
    const res = await transitionBrique(transForm.typeId, transForm.de, transForm.vers, transForm.quantite, user);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setOpenTrans(false);
    setTransForm((f) => ({ ...f, quantite: "" }));
  }

  return (
    <div>
      <TopBarSimple title="Production" subtitle={`${config.nom} — production de briques et séchage jusqu'à la vente`} icon={Factory} accent={config.color} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-5">
        <StatTile icon={Factory} label="En appâtam" value={String(totalAppatam)} tone="#8E8E93" />
        <StatTile icon={Layers} label="Prêt à la vente" value={String(totalPret)} tone="#30D158" />
        <StatTile icon={Factory} label="Caillasses (pertes)" value={String(totalCaillasses)} tone="#FF453A" />
        <StatTile icon={Layers} label="Valeur du stock prêt" value={Math.round(valeurPret / 1000) + "k FCFA"} tone={config.color} />
      </div>

      <div className="flex flex-wrap justify-end gap-2.5 mb-4">
        <Button variant="ghost" icon={Plus} onClick={() => setOpenProd(true)}>Nouvelle production</Button>
        <Button icon={ArrowRight} onClick={() => setOpenTrans(true)} style={{ background: config.color }}>Faire transiter</Button>
      </div>

      <GlassCard className="p-2 overflow-auto mb-5" hover={false}>
        <table className="w-full min-w-[480px] border-collapse">
          <thead>
            <tr className="text-left text-[11.5px] font-bold text-ink-soft uppercase tracking-wide">
              <th className="px-4 py-3">Type de brique</th>
              {ETATS_BRIQUE.map((e) => <th key={e.id} className="px-4 py-3 text-right">{e.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {typesBriques.map((t) => (
              <tr key={t.id} className="text-[13.5px] hover:bg-white/50 transition-colors">
                <td className="px-4 py-3 font-semibold text-ink">{t.nom}</td>
                {ETATS_BRIQUE.map((e) => (
                  <td key={e.id} className="px-4 py-3 text-right font-bold tabular" style={{ color: e.color }}>
                    {stockBriques[t.id]?.[e.id] ?? 0}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>

      <GlassCard className="p-5" hover={false}>
        <h3 className="font-bold tracking-tight text-ink mb-3">Journal des transitions</h3>
        <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto">
          {journalBriques.length === 0 && <p className="text-[13px] text-ink-soft italic">Aucun mouvement.</p>}
          {journalBriques.slice(0, 20).map((j) => {
            const type = typesBriques.find((t) => t.id === j.typeId);
            return (
              <div key={j.id} className="text-[12px] px-1">
                <span className="font-semibold text-ink">{type?.nom}</span> — {j.action} <span className="font-bold tabular">{j.quantite}</span>
              </div>
            );
          })}
        </div>
      </GlassCard>

      <Modal open={openProd} onClose={() => setOpenProd(false)} title="Nouvelle production" icon={Factory} accent={config.color} moduleLabel={config.nom} footer={<><Button variant="ghost" onClick={() => setOpenProd(false)}>Annuler</Button><Button onClick={submitProd} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></>}>
        <form onSubmit={submitProd}>
          {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
          <Field label="Type de brique">
            <Select value={prodForm.typeId} onChange={(e) => setProdForm({ ...prodForm, typeId: e.target.value })}>
              {typesBriques.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
            </Select>
          </Field>
          <Field label="Quantité produite (appâtam)">
            <TextInput type="number" value={prodForm.quantite} onChange={(e) => setProdForm({ ...prodForm, quantite: e.target.value })} placeholder="500" />
          </Field>
        </form>
      </Modal>

      <Modal open={openTrans} onClose={() => setOpenTrans(false)} title="Transition d'état" icon={Factory} accent={config.color} moduleLabel={config.nom} footer={<><Button variant="ghost" onClick={() => setOpenTrans(false)}>Annuler</Button><Button onClick={submitTrans} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></>}>
        <form onSubmit={submitTrans}>
          {error && <p className="text-[12.5px] text-[#b3241b] bg-[#FF453A]/10 rounded-xl px-3 py-2 mb-3">{error}</p>}
          <Field label="Type de brique">
            <Select value={transForm.typeId} onChange={(e) => setTransForm({ ...transForm, typeId: e.target.value })}>
              {typesBriques.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="De">
              <Select value={transForm.de} onChange={(e) => setTransForm({ ...transForm, de: e.target.value })}>
                {ETATS_BRIQUE.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
              </Select>
            </Field>
            <Field label="Vers">
              <Select value={transForm.vers} onChange={(e) => setTransForm({ ...transForm, vers: e.target.value })}>
                {ETATS_BRIQUE.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Quantité">
            <TextInput type="number" value={transForm.quantite} onChange={(e) => setTransForm({ ...transForm, quantite: e.target.value })} placeholder="200" />
          </Field>
          <p className="text-[12px] text-ink-soft">Ex : séchage → prêt une fois le séchage terminé.</p>
        </form>
      </Modal>
    </div>
  );
}
