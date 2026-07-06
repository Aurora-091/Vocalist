import { Component, type ReactNode } from "react";
import { TriangleAlert as AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="h-screen flex flex-col items-center justify-center px-6 text-center">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <AlertTriangle className="w-6 h-6 text-destructive" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          An unexpected error occurred. Try reloading the page or contact support if the problem persists.
        </p>
        {this.state.error && (
          <pre className="mt-4 text-xs text-muted-foreground bg-muted rounded-md px-4 py-3 max-w-lg overflow-x-auto text-left">
            {this.state.error.message}
          </pre>
        )}
        <div className="mt-6 flex gap-3">
          <Button variant="outline" size="sm" onClick={this.handleReset}>
            Try again
          </Button>
          <Button size="sm" onClick={this.handleReload}>
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Reload page
          </Button>
        </div>
      </div>
    );
  }
}
