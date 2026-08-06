import { useMemo, useState } from "react";
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
import { ETATS_BRIQUE, MATIERES_PREMIERES } from "../../data/stockData";

// Stock de briques d'E-BRIQUETERIE — même modèle que le vrai module : chaque
// type de brique suit 4 états (appâtam → séchage → prêt, ou casse en cours de
// route), plus un stock de matières premières simple (init + entrées - conso).
export default function StockBriques() {
  const config = useOutletContext();
  const { user } = useAuthStore();
  const { typesBriques, stockBriques, journalBriques, ajouterProduction, transitionBrique, referentielMatieres, stockMatiere, addMouvementMatiere, mouvementsMatieres } = useStockStore();

  const [openProd, setOpenProd] = useState(false);
  const [prodForm, setProdForm] = useState({ typeId: typesBriques[0]?.id, quantite: "" });
  const [openTrans, setOpenTrans] = useState(false);
  const [transForm, setTransForm] = useState({ typeId: typesBriques[0]?.id, de: "appatam", vers: "sechage", quantite: "" });
  const [openMatiere, setOpenMatiere] = useState(false);
  const [matiereForm, setMatiereForm] = useState({ matiereId: referentielMatieres[0]?.id, type: "arrivage", quantite: "" });

  const totalPret = typesBriques.reduce((acc, t) => acc + (stockBriques[t.id]?.pret || 0), 0);
  const totalAppatam = typesBriques.reduce((acc, t) => acc + (stockBriques[t.id]?.appatam || 0), 0);
  const totalCaillasses = typesBriques.reduce((acc, t) => acc + (stockBriques[t.id]?.caillasses || 0), 0);
  const valeurPret = typesBriques.reduce((acc, t) => acc + (stockBriques[t.id]?.pret || 0) * t.tarifVente, 0);

  function submitProd(e) {
    e.preventDefault();
    if (!prodForm.quantite) return;
    ajouterProduction(prodForm.typeId, prodForm.quantite, user);
    setOpenProd(false);
    setProdForm((f) => ({ ...f, quantite: "" }));
  }

  function submitTrans(e) {
    e.preventDefault();
    if (!transForm.quantite || transForm.de === transForm.vers) return;
    transitionBrique(transForm.typeId, transForm.de, transForm.vers, transForm.quantite, user);
    setOpenTrans(false);
    setTransForm((f) => ({ ...f, quantite: "" }));
  }

  function submitMatiere(e) {
    e.preventDefault();
    if (!matiereForm.quantite) return;
    addMouvementMatiere(matiereForm, user);
    setOpenMatiere(false);
    setMatiereForm((f) => ({ ...f, quantite: "" }));
  }

  return (
    <div>
      <TopBarSimple title="Stock de briques" subtitle={`${config.nom} — production, séchage et matières premières`} accent={config.color} />

      <div className="grid grid-cols-4 gap-5 mb-5">
        <StatTile icon={Factory} label="En appâtam" value={String(totalAppatam)} tone="#8E8E93" />
        <StatTile icon={Layers} label="Prêt à la vente" value={String(totalPret)} tone="#30D158" />
        <StatTile icon={Factory} label="Caillasses (pertes)" value={String(totalCaillasses)} tone="#FF453A" />
        <StatTile icon={Layers} label="Valeur du stock prêt" value={Math.round(valeurPret / 1000) + "k FCFA"} tone={config.color} />
      </div>

      <div className="flex justify-end gap-2.5 mb-4">
        <Button variant="ghost" icon={Plus} onClick={() => setOpenProd(true)}>Nouvelle production</Button>
        <Button icon={ArrowRight} onClick={() => setOpenTrans(true)} style={{ background: config.color }}>Faire transiter</Button>
      </div>

      <GlassCard className="p-2 overflow-hidden mb-5" hover={false}>
        <table className="w-full border-collapse">
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

      <div className="grid grid-cols-3 gap-5">
        <GlassCard className="p-5 col-span-2" hover={false}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold tracking-tight text-ink">Matières premières</h3>
            <Button variant="ghost" icon={Plus} onClick={() => setOpenMatiere(true)}>Mouvement</Button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {referentielMatieres.map((m) => (
              <div key={m.id} className="glass rounded-2xl p-4">
                <p className="text-[12px] text-ink-soft font-semibold">{m.nom}</p>
                <p className="text-[22px] font-bold tabular text-ink mt-1">{stockMatiere(m.id)} <span className="text-[12px] font-medium text-ink-soft">{m.unite}</span></p>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-5" hover={false}>
          <h3 className="font-bold tracking-tight text-ink mb-3">Journal des transitions</h3>
          <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto">
            {journalBriques.length === 0 && <p className="text-[13px] text-ink-soft italic">Aucun mouvement.</p>}
            {journalBriques.slice(0, 10).map((j) => {
              const type = typesBriques.find((t) => t.id === j.typeId);
              return (
                <div key={j.id} className="text-[12px] px-1">
                  <span className="font-semibold text-ink">{type?.nom}</span> — {j.action} <span className="font-bold tabular">{j.quantite}</span>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>

      <Modal open={openProd} onClose={() => setOpenProd(false)} title="Nouvelle production" footer={<><Button variant="ghost" onClick={() => setOpenProd(false)}>Annuler</Button><Button onClick={submitProd}>Enregistrer</Button></>}>
        <form onSubmit={submitProd}>
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

      <Modal open={openTrans} onClose={() => setOpenTrans(false)} title="Transition d'état" footer={<><Button variant="ghost" onClick={() => setOpenTrans(false)}>Annuler</Button><Button onClick={submitTrans}>Enregistrer</Button></>}>
        <form onSubmit={submitTrans}>
          <Field label="Type de brique">
            <Select value={transForm.typeId} onChange={(e) => setTransForm({ ...transForm, typeId: e.target.value })}>
              {typesBriques.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
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
          <p className="text-[12px] text-ink-soft">Ex : séchage → prêt une fois les {ETATS_BRIQUE.length > 0 ? "5 jours" : ""} de séchage écoulés.</p>
        </form>
      </Modal>

      <Modal open={openMatiere} onClose={() => setOpenMatiere(false)} title="Mouvement matière première" footer={<><Button variant="ghost" onClick={() => setOpenMatiere(false)}>Annuler</Button><Button onClick={submitMatiere}>Enregistrer</Button></>}>
        <form onSubmit={submitMatiere}>
          <Field label="Matière">
            <Select value={matiereForm.matiereId} onChange={(e) => setMatiereForm({ ...matiereForm, matiereId: e.target.value })}>
              {referentielMatieres.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
            </Select>
          </Field>
          <Field label="Type">
            <Select value={matiereForm.type} onChange={(e) => setMatiereForm({ ...matiereForm, type: e.target.value })}>
              <option value="arrivage">Arrivage</option>
              <option value="consommation">Consommation</option>
            </Select>
          </Field>
          <Field label="Quantité">
            <TextInput type="number" value={matiereForm.quantite} onChange={(e) => setMatiereForm({ ...matiereForm, quantite: e.target.value })} placeholder="10" />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
