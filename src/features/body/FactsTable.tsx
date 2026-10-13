import { useState } from 'react';
import { tr } from '../../data/catalog';
import { SOURCES } from '../../data/sources';
import type { BodyType, CelestialBody, Fact, ValueKind } from '../../data/types';
import { useI18n } from '../../i18n';
import { factLabel, formatFact } from './formatFact';

const KEY_FACTS: Fact['key'][] = [
  'diameter',
  'mass',
  'gravity',
  'meanDistanceSun',
  'distanceEarth',
  'dayLength',
  'siderealRotation',
  'orbitalPeriod',
  'meanTemperature',
  'temperature1bar',
  'effectiveTemperature',
  'surfacePressure',
];

function KindBadge({ kind }: { kind: ValueKind }) {
  const { t } = useI18n();
  return (
    <span className={`kind kind--${kind}`} title={t.valueKindsHelp[kind]}>
      {t.valueKinds[kind]}
    </span>
  );
}

function FactRow({ f, bodyType }: { f: Fact; bodyType: BodyType }) {
  const { t } = useI18n();
  const ff = formatFact(f);
  const source = SOURCES[f.sourceId];
  return (
    <tr>
      <th scope="row">
        {factLabel(t, f.key, bodyType)}
        {f.note ? <span className="fact-note">{tr(f.note)}</span> : null}
      </th>
      <td className="num">
        <span className="fact-value">{ff.text}</span>
        {ff.secondary ? <span className="secondary">{ff.secondary}</span> : null}
      </td>
      <td className="fact-meta">
        <KindBadge kind={f.kind} />
        <a href={source.url} target="_blank" rel="noopener noreferrer" className="fact-source">
          {source.publisher.split(' (')[0]}
        </a>
      </td>
    </tr>
  );
}

export function FactsTable({ body }: { body: CelestialBody }) {
  const { t } = useI18n();
  const [showAll, setShowAll] = useState(false);
  const key = body.facts.filter((f) => KEY_FACTS.includes(f.key));
  const rest = body.facts.filter((f) => !KEY_FACTS.includes(f.key));
  const rows = showAll ? [...key, ...rest] : key;

  return (
    <section className="body-section" aria-labelledby="facts-title">
      <h2 id="facts-title">{showAll ? t.body.allData : t.body.keyFacts}</h2>
      <div className="table-scroll">
        <table className="data-table facts-table">
          <thead>
            <tr>
              <th scope="col">Grandeza</th>
              <th scope="col" className="num">
                Valor
              </th>
              <th scope="col">Tipo e fonte</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <FactRow key={f.key} f={f} bodyType={body.type} />
            ))}
          </tbody>
        </table>
      </div>
      {rest.length > 0 ? (
        <button type="button" className="btn btn--ghost btn--small" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Mostrar só os dados principais' : `Mostrar todos os dados (${body.facts.length})`}
        </button>
      ) : null}
      <p className="section-note kind-legend">
        {(Object.keys(t.valueKinds) as ValueKind[]).map((k) => (
          <span key={k}>
            <KindBadge kind={k} /> {t.valueKindsHelp[k]}
          </span>
        ))}
      </p>
    </section>
  );
}
