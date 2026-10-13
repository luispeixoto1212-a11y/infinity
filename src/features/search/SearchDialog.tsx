import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from '../../components/Icon';
import { BodyThumb } from '../../components/BodyThumb';
import { navigate } from '../../app/router';
import { findBodyById } from '../../data/catalog';
import { useI18n } from '../../i18n';
import { closeSearch, useUi } from '../../state/ui';
import { useHistory } from '../../state/userData';
import { buildIndex, search, type SearchEntry } from './searchIndex';

export function SearchDialog() {
  const { t } = useI18n();
  const { searchOpen } = useUi();
  const history = useHistory();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const index = useMemo(() => buildIndex(), []);

  const results: SearchEntry[] = useMemo(() => {
    if (query.trim()) return search(index, query).map((r) => r.entry);
    return history
      .map((id) => index.find((e) => e.id === id))
      .filter((e): e is SearchEntry => Boolean(e))
      .slice(0, 6);
  }, [query, index, history]);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (searchOpen && !d.open) {
      setActive(0);
      d.showModal();
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (!searchOpen) {
      if (d.open) d.close();
      setQuery('');
    }
  }, [searchOpen]);

  useEffect(() => setActive(0), [query]);

  const openEntry = (entry: SearchEntry, mode: 'page' | 'space') => {
    closeSearch();
    if (mode === 'space' && entry.bodyId) {
      const body = findBodyById(entry.bodyId);
      if (body) navigate({ name: 'explore', focus: body.slug });
      return;
    }
    navigate(entry.route);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      // Num campo de pesquisa, Esc limparia só o texto; aqui fecha sempre o diálogo.
      e.preventDefault();
      closeSearch();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      const entry = results[active];
      if (entry) {
        e.preventDefault();
        openEntry(entry, e.shiftKey ? 'space' : 'page');
      }
    }
  };

  const activeId = results[active] ? `${listId}-${active}` : undefined;
  const showEmpty = query.trim() !== '' && results.length === 0;

  return (
    <dialog
      ref={dialogRef}
      className="search-dialog"
      aria-label={t.search.open}
      onClose={closeSearch}
      onClick={(e) => {
        if (e.target === dialogRef.current) closeSearch();
      }}
    >
      <div className="search-box">
        <div className="search-input-row">
          <Icon name="search" size={20} />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t.search.placeholder}
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listId}
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" className="icon-btn" onClick={closeSearch} aria-label={t.search.close}>
            <Icon name="close" />
          </button>
        </div>

        <div className="search-meta" aria-live="polite">
          {query.trim()
            ? showEmpty
              ? t.search.noResults(query.trim())
              : t.search.resultsCount(results.length)
            : results.length > 0
              ? t.search.recent
              : t.search.empty}
        </div>

        <ul id={listId} role="listbox" className="search-results" aria-label={t.search.open}>
          {results.map((entry, i) => {
            const body = entry.bodyId ? findBodyById(entry.bodyId) : undefined;
            return (
              <li
                key={entry.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={i === active ? 'search-result is-active' : 'search-result'}
                onMouseEnter={() => setActive(i)}
              >
                <button type="button" className="search-result-main" onClick={() => openEntry(entry, 'page')} tabIndex={-1}>
                  {body ? <BodyThumb body={body} size={36} /> : <span className="search-page-icon"><Icon name="layers" /></span>}
                  <span className="search-result-text">
                    <span className="search-result-title">
                      {entry.title}
                      <span className="search-result-cat">{t.categories[entry.category]}</span>
                    </span>
                    <span className="search-result-sub">{entry.subtitle}</span>
                  </span>
                </button>
                {entry.bodyId ? (
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    onClick={() => openEntry(entry, 'space')}
                    tabIndex={-1}
                  >
                    {t.search.flyTo}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
        <p className="search-help">
          <kbd>↑</kbd> <kbd>↓</kbd> para escolher, <kbd>Enter</kbd> abre a ficha, <kbd>Shift</kbd>+<kbd>Enter</kbd> mostra no espaço.
        </p>
      </div>
    </dialog>
  );
}
