import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = "Une erreur inattendue est survenue.";
      let isFirestoreError = false;

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error && parsed.operationType) {
            isFirestoreError = true;
            errorMessage = `Erreur de base de données : ${parsed.error}`;
            if (parsed.error.includes('permission-denied')) {
              errorMessage = "Accès refusé. Vous n'avez pas les permissions nécessaires pour cette opération.";
            }
          }
        }
      } catch (e) {
        // Not a JSON error message
        if (this.state.error?.message) {
          errorMessage = this.state.error.message;
        }
      }

      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center space-y-6 bg-red-50 rounded-3xl border-2 border-red-100 my-8">
          <div className="bg-red-100 p-4 rounded-full">
            <AlertTriangle className="h-12 w-12 text-red-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">Oups ! Quelque chose s'est mal passé</h2>
            <p className="text-gray-600 max-w-md mx-auto">
              {errorMessage}
            </p>
          </div>
          <Button 
            onClick={this.handleReset}
            className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
          >
            <RefreshCcw className="h-4 w-4" />
            Recharger la page
          </Button>
          {isFirestoreError && (
            <p className="text-xs text-red-400 mt-4">
              Détails techniques envoyés à l'administrateur pour résolution.
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
