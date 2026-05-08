import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: (args: { error: Error; reset: () => void }) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface to console for now; a Sentry/LogRocket hook would slot in here.
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback({ error, reset: this.reset });
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-destructive/40 bg-destructive/10 text-destructive">
          <span className="font-display text-2xl">!</span>
        </div>
        <div className="font-display text-2xl font-semibold tracking-tight">
          Something went wrong
        </div>
        <div className="max-w-md text-sm text-muted-foreground">
          The app hit an unexpected error. Reload to try again. If it keeps
          happening, contact support.
        </div>
        <pre className="max-w-xl overflow-auto rounded-md border border-border bg-muted/40 p-3 text-left text-xs text-muted-foreground">
          {error.message}
        </pre>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Reload
          </button>
          <button
            type="button"
            onClick={this.reset}
            className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted/40"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}
