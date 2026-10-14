import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n';
import { searchNasaImages, type NasaImage } from '../../services/nasaImages';
import { Icon } from '../../components/Icon';

type State = { status: 'loading' } | { status: 'error' } | { status: 'done'; images: NasaImage[] };

function formatDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : new Intl.DateTimeFormat('pt-PT', { year: 'numeric', month: 'short', day: 'numeric' }).format(d);
}

/** Galeria de fotografias pedidas em tempo real à NASA Image and Video Library. */
export function NasaGallery({ query, note }: { query?: { q: string; mustInclude: string[] }; note?: string }) {
  const { t } = useI18n();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    setState({ status: 'loading' });
    searchNasaImages(query.q, query.mustInclude, { signal: controller.signal, max: 8 })
      .then((images) => setState({ status: 'done', images }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' });
      });
    return () => controller.abort();
  }, [query, attempt]);

  if (!query) return null;

  return (
    <section className="body-section" aria-labelledby="gallery-title">
      <h2 id="gallery-title">{t.body.gallery}</h2>
      <p className="section-note">
        {t.body.galleryLive}
        {note ? ` ${note}` : ''}
      </p>
      {state.status === 'loading' ? (
        <p className="muted" role="status">
          <span className="spinner spinner--small" aria-hidden="true" /> {t.body.galleryLoading}
        </p>
      ) : null}
      {state.status === 'error' ? (
        <div className="inline-error" role="alert">
          <p>{t.body.galleryError}</p>
          <button type="button" className="btn btn--small" onClick={() => setAttempt((a) => a + 1)}>
            {t.body.galleryRetry}
          </button>
        </div>
      ) : null}
      {state.status === 'done' && state.images.length === 0 ? <p className="muted">{t.body.galleryEmpty}</p> : null}
      {state.status === 'done' && state.images.length > 0 ? (
        <ul className="gallery">
          {state.images.map((img) => (
            <li key={img.nasaId}>
              <figure>
                <a href={img.detailsUrl} target="_blank" rel="noopener noreferrer" className="gallery-img">
                  <img
                    src={img.thumbUrl}
                    alt={img.title}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      e.currentTarget.closest('li')?.classList.add('is-broken');
                    }}
                  />
                </a>
                <figcaption>
                  <span className="gallery-title">{img.title}</span>
                  <span className="gallery-meta">
                    {t.body.galleryCredit}: {img.credit}
                    {formatDate(img.dateCreated) ? `, ${formatDate(img.dateCreated)}` : ''}
                  </span>
                  <a href={img.detailsUrl} target="_blank" rel="noopener noreferrer" className="gallery-link">
                    {t.body.viewSource} <Icon name="external" size={14} />
                  </a>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
