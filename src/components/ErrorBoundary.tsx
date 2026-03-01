import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error | null | undefined): State {
    try {
      return {
        hasError: true,
        error: error || new Error('Unknown error occurred'),
        errorInfo: null
      };
    } catch (e) {
      // Fallback if getDerivedStateFromError itself fails
      return {
        hasError: true,
        error: new Error('Error boundary initialization failed'),
        errorInfo: null
      };
    }
  }

  componentDidCatch(error: Error | null | undefined, errorInfo: ErrorInfo | null | undefined) {
    try {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
      this.setState({
        error: error || new Error('Unknown error'),
        errorInfo: errorInfo || null
      });
    } catch (setStateError) {
      // If setState fails, log it but don't crash
      console.error('ErrorBoundary: Failed to set error state:', setStateError);
    }
  }

  handleReset = () => {
    try {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null
      });
    } catch (resetError) {
      console.error('ErrorBoundary: Failed to reset:', resetError);
      // Force reload if reset fails
      try {
        window.location.reload();
      } catch (reloadError) {
        console.error('ErrorBoundary: Failed to reload:', reloadError);
      }
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-5 h-5" />
                Something went wrong
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                The application encountered an error. This has been logged and won't affect your uploaded files.
              </p>
              
              {this.state.error && (
                <div className="bg-muted p-4 rounded-lg">
                  <p className="font-mono text-sm text-destructive">
                    {this.state.error?.toString() || 'Unknown error occurred'}
                  </p>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button 
                  onClick={this.handleReset} 
                  variant="default"
                  onError={(e) => {
                    console.error('Error in reset button:', e);
                    try {
                      window.location.reload();
                    } catch (reloadError) {
                      console.error('Failed to reload:', reloadError);
                    }
                  }}
                >
                  Try Again
                </Button>
                <Button 
                  onClick={() => {
                    try {
                      window.location.reload();
                    } catch (reloadError) {
                      console.error('Failed to reload page:', reloadError);
                      // Last resort: try to navigate
                      try {
                        window.location.href = '/';
                      } catch (navError) {
                        console.error('Failed to navigate:', navError);
                      }
                    }
                  }} 
                  variant="outline"
                >
                  Reload Page
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground">
                Your uploaded audio files are safe. You can continue working after reloading.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
