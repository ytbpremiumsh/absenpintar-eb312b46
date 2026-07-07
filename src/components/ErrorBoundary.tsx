import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global React error boundary — prevents whole-app white screens
 * when a component throws during render/lifecycle.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  reload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  goHome = () => {
    if (typeof window !== "undefined") window.location.assign("/");
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-destructive" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Ups, terjadi kesalahan</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Ada masalah saat menampilkan halaman ini. Coba muat ulang atau kembali ke beranda.
            </p>
            {this.state.error?.message && (
              <p className="text-xs text-muted-foreground/70 mt-3 font-mono break-all">
                {this.state.error.message}
              </p>
            )}
          </div>
          <div className="flex gap-2 justify-center">
            <Button onClick={this.reload} className="gap-2">
              <RefreshCw className="w-4 h-4" /> Muat Ulang
            </Button>
            <Button variant="outline" onClick={this.goHome} className="gap-2">
              <Home className="w-4 h-4" /> Beranda
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
