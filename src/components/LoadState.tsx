import type { AsyncState } from './useAsync';

/** Mensagens de carregamento e de erro (com nova tentativa) partilhadas pelas páginas de catálogos. */
export function LoadState<T>({
  state,
  retry,
  loading,
  error,
  retryLabel,
}: {
  state: AsyncState<T>;
  retry: () => void;
  loading: string;
  error: string;
  retryLabel: string;
}) {
  if (state.status === 'loading') {
    return (
      <div className="page-loading page-loading--inline" role="status">
        <span className="spinner" aria-hidden="true" />
        <span>{loading}</span>
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="notice-box" role="alert">
        <p>{error}</p>
        <button type="button" className="btn btn--small" onClick={retry}>
          {retryLabel}
        </button>
      </div>
    );
  }
  return null;
}
