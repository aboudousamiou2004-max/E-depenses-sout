import { Component } from "react";
import { AlertTriangle } from "lucide-react";

// Filet de sécurité applicatif — sans ça, une exception non interceptée pendant
// le rendu (ex : conflit avec une extension navigateur qui modifie le DOM,
// comme Google Traduction) fait disparaître tout l'arbre React et laisse un
// écran blanc silencieux, sans aucune indication de ce qui s'est passé.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Erreur applicative interceptée :", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-md text-center flex flex-col items-center gap-3 rounded-[28px] p-8 bg-white/70 shadow-xl">
            <div className="w-14 h-14 rounded-full bg-[#FF453A]/10 flex items-center justify-center text-[#FF453A]">
              <AlertTriangle size={26} />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-ink">Une erreur est survenue</h1>
            <p className="text-[13.5px] text-ink-soft">
              L'application a rencontré un problème inattendu. Si une extension de traduction ou de
              modification de page est active, essayez de la désactiver puis rechargez.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 rounded-2xl px-5 py-2.5 bg-[#0A84FF] text-white text-[13.5px] font-semibold"
            >
              Recharger la page
            </button>
            <p className="text-[11px] text-ink-soft/70 mt-1 break-all">{String(this.state.error?.message || this.state.error)}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
