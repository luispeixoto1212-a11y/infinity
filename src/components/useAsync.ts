import { useCallback, useEffect, useState } from 'react';

export type AsyncState<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; value: T };

/** Executa um carregamento assíncrono (com nova tentativa) e devolve o estado para a interface. */
export function useAsync<T>(loader: () => Promise<T>): { state: AsyncState<T>; retry: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    loader()
      .then((value) => alive && setState({ status: 'ready', value }))
      .catch((err: unknown) => alive && setState({ status: 'error', message: err instanceof Error ? err.message : String(err) }));
    return () => {
      alive = false;
    };
    // O carregador é uma função estável (módulo); só uma nova tentativa volta a carregar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return { state, retry };
}
