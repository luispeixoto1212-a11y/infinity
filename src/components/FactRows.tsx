import type { ReactNode } from 'react';
import type { ValueKind } from '../data/types';
import { useI18n } from '../i18n';

export function KindBadge({ kind }: { kind: ValueKind }) {
  const { t } = useI18n();
  return (
    <span className={`kind kind--${kind}`} title={t.valueKindsHelp[kind]}>
      {t.valueKinds[kind]}
    </span>
  );
}

export interface FactRow {
  label: string;
  value: ReactNode;
  secondary?: string;
  kind: ValueKind;
  note?: string;
  /** Nome curto da fonte (ou "Calculado nesta aplicação"). */
  source: string;
  sourceUrl?: string;
}

/** Tabela de dados com tipo de valor e fonte por linha (mesmo aspeto das fichas do Sistema Solar). */
export function FactRows({ rows }: { rows: FactRow[] }) {
  return (
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
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">
                {r.label}
                {r.note ? <span className="fact-note">{r.note}</span> : null}
              </th>
              <td className="num">
                <span className="fact-value">{r.value}</span>
                {r.secondary ? <span className="secondary">{r.secondary}</span> : null}
              </td>
              <td className="fact-meta">
                <KindBadge kind={r.kind} />
                {r.sourceUrl ? (
                  <a className="fact-source" href={r.sourceUrl} target="_blank" rel="noopener noreferrer">
                    {r.source}
                  </a>
                ) : (
                  <span className="fact-source">{r.source}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
