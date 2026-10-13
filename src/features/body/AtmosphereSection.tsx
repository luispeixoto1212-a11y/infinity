import { formatNumber } from '../../core/format';
import { tr } from '../../data/catalog';
import { SOURCES } from '../../data/sources';
import type { Atmosphere } from '../../data/types';
import { useI18n } from '../../i18n';

const PALETTE = ['#7aa2ff', '#a98bff', '#5fd0c5', '#ffc874', '#ff8f7a', '#c9d3ea'];

export function AtmosphereSection({ atmosphere, accent }: { atmosphere: Atmosphere; accent: string }) {
  const { t } = useI18n();
  const major = atmosphere.components.filter((c) => c.unit === '%');
  const minor = atmosphere.components.filter((c) => c.unit === 'ppm');
  const total = major.reduce((s, c) => s + c.value, 0);
  const source = SOURCES[atmosphere.sourceId];

  return (
    <section className="body-section" aria-labelledby="atmo-title">
      <h2 id="atmo-title">{t.body.atmosphere}</h2>
      <p>{tr(atmosphere.summary)}</p>
      {major.length > 0 ? (
        <>
          <div className="atmo-bar" role="img" aria-label={major.map((c) => `${tr(c.name)} ${formatNumber(c.value, 3)}%`).join(', ')}>
            {major.map((c, i) => (
              <span
                key={c.formula}
                style={{ flexGrow: c.value, background: i === 0 ? accent : PALETTE[i % PALETTE.length] }}
                title={`${tr(c.name)}: ${formatNumber(c.value, 3)}%`}
              />
            ))}
            {total < 99.5 ? <span className="atmo-rest" style={{ flexGrow: 100 - total }} /> : null}
          </div>
          <table className="data-table">
            <caption className="visually-hidden">{t.body.composition}</caption>
            <thead>
              <tr>
                <th scope="col">Componente</th>
                <th scope="col" className="num">
                  Fração por volume
                </th>
              </tr>
            </thead>
            <tbody>
              {[...major, ...minor].map((c, i) => (
                <tr key={c.formula}>
                  <th scope="row">
                    {c.unit === '%' ? (
                      <span className="dot" style={{ background: i === 0 ? accent : PALETTE[i % PALETTE.length] }} aria-hidden="true" />
                    ) : (
                      <span className="dot dot--empty" aria-hidden="true" />
                    )}
                    {tr(c.name)} <span className="formula">{c.formula}</span>
                  </th>
                  <td className="num">
                    {formatNumber(c.value, 3)} {c.unit}
                    {c.uncertainty !== undefined ? ` ± ${formatNumber(c.uncertainty, 3)}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
      {atmosphere.note ? <p className="section-note">{tr(atmosphere.note)}</p> : null}
      <p className="section-note">
        Fonte: <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>
        {source.updated ? `, atualizada em ${source.updated}` : ''}.
      </p>
    </section>
  );
}
