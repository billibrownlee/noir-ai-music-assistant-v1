import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface Props {
  children: ReactNode;
  tabLabel: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Isolates failures to a single studio tab so other tabs stay usable.
 */
export class StudioTabErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error | null | undefined): Partial<State> {
    return { hasError: true, error: error ?? new Error("Unknown error") };
  }

  componentDidCatch(error: Error | null | undefined, errorInfo: ErrorInfo) {
    console.error(`[StudioTab: ${this.props.tabLabel}]`, error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-3"
        >
          <div className="flex items-start gap-2 text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">This tab hit an error</p>
              <p className="text-sm text-muted-foreground mt-1">
                {this.props.tabLabel} — other tabs still work. Try again or switch away and back.
              </p>
            </div>
          </div>
          {this.state.error && (
            <pre className="text-xs font-mono bg-muted/50 p-2 rounded overflow-auto max-h-24">
              {this.state.error.message}
            </pre>
          )}
          <Button type="button" size="sm" variant="secondary" onClick={this.handleReset}>
            Try again in this tab
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
