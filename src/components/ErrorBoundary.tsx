import { Component, ReactNode } from "react";

type State = { error: Error | null };

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReload = () => {
    // Limpa cache de service worker / força reload sem cache
    if ("caches" in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen grid place-items-center p-6 bg-background">
        <div className="max-w-lg w-full rounded-xl border border-destructive/30 bg-destructive/5 p-6 space-y-4">
          <h1 className="text-xl font-bold text-destructive">Ocorreu um erro ao carregar a tela</h1>
          <p className="text-sm text-muted-foreground">
            Isso geralmente acontece quando o navegador está com uma versão antiga do sistema em cache.
            Clique em <strong>Recarregar</strong> para atualizar.
          </p>
          <pre className="text-xs bg-background/50 p-3 rounded overflow-auto max-h-48 whitespace-pre-wrap break-words">
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack}
          </pre>
          <div className="flex gap-2">
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold"
            >
              Recarregar
            </button>
            <button
              onClick={() => (window.location.href = "/")}
              className="px-4 py-2 rounded-lg border border-border text-sm font-semibold"
            >
              Voltar ao início
            </button>
          </div>
        </div>
      </div>
    );
  }
}
