import { href } from '../../app/router';
import { BodyThumb } from '../../components/BodyThumb';
import { FavoriteButton } from '../../components/FavoriteButton';
import { findBodyById, tr } from '../../data/catalog';
import type { CelestialBody } from '../../data/types';
import { useI18n } from '../../i18n';
import { clearHistory, useFavorites, useHistory } from '../../state/userData';

function BodyRow({ body, withFavorite }: { body: CelestialBody; withFavorite?: boolean }) {
  const { t } = useI18n();
  return (
    <li className="fav-row">
      <a href={href({ name: 'body', slug: body.slug })} className="fav-link">
        <BodyThumb body={body} size={40} />
        <span>
          <span className="fav-name">{tr(body.name)}</span>
          <span className="fav-type">{t.categories[body.type]}</span>
        </span>
      </a>
      <a className="btn btn--ghost btn--small" href={href({ name: 'explore', focus: body.slug })}>
        {t.search.flyTo}
      </a>
      {withFavorite ? <FavoriteButton id={body.id} /> : null}
    </li>
  );
}

export function FavoritesPage() {
  const { t } = useI18n();
  const favorites = useFavorites()
    .map((id) => findBodyById(id))
    .filter((b): b is CelestialBody => Boolean(b));
  const history = useHistory()
    .map((id) => findBodyById(id))
    .filter((b): b is CelestialBody => Boolean(b));

  return (
    <div className="page page--narrow">
      <header className="page-head">
        <h1 className="page-title">{t.favorites.title}</h1>
        <p className="page-lede">{t.favorites.storageNote}</p>
      </header>

      <section className="body-section" aria-labelledby="fav-title">
        <h2 id="fav-title" className="visually-hidden">
          {t.favorites.title}
        </h2>
        {favorites.length === 0 ? (
          <p className="empty-state">{t.favorites.empty}</p>
        ) : (
          <ul className="fav-list">
            {favorites.map((b) => (
              <BodyRow key={b.id} body={b} withFavorite />
            ))}
          </ul>
        )}
      </section>

      <section className="body-section" aria-labelledby="history-title">
        <div className="section-head">
          <h2 id="history-title">{t.favorites.history}</h2>
          {history.length > 0 ? (
            <button type="button" className="btn btn--ghost btn--small" onClick={clearHistory}>
              {t.favorites.clearHistory}
            </button>
          ) : null}
        </div>
        {history.length === 0 ? (
          <p className="empty-state">{t.favorites.historyEmpty}</p>
        ) : (
          <ul className="fav-list">
            {history.map((b) => (
              <BodyRow key={b.id} body={b} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
