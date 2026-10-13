import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ptPT } from '../i18n/pt-PT';

interface Props {
  children: ReactNode;
  /** Muda quando a rota muda, para limpar o erro ao navegar. */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro na interface:', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="page page--narrow" role="alert">
          <h1 className="page-title">{ptPT.errors.generic}</h1>
          <p className="muted">{this.state.error.message}</p>
          <button className="btn" type="button" onClick={() => location.reload()}>
            {ptPT.errors.reload}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
