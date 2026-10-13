import { href } from '../app/router';
import { useI18n } from '../i18n';
import { openSearch } from '../state/ui';

export function NotFoundPage() {
  const { t } = useI18n();
  return (
    <div className="page page--narrow">
      <h1 className="page-title">{t.notFound.title}</h1>
      <p className="page-lede">{t.notFound.body}</p>
      <div className="body-actions">
        <a className="btn" href={href({ name: 'explore' })}>
          {t.notFound.back}
        </a>
        <button type="button" className="btn btn--ghost" onClick={openSearch}>
          {t.search.open}
        </button>
      </div>
    </div>
  );
}
