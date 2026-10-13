import { SOURCES, type SourceId } from '../data/sources';
import { useI18n } from '../i18n';

/** Lista de fontes com editor, datas de atualização e de consulta, licença e nota. */
export function SourcesList({ ids, showNotes = false }: { ids: readonly SourceId[]; showNotes?: boolean }) {
  const { t } = useI18n();
  const unique = [...new Set(ids)];
  return (
    <ul className="sources">
      {unique.map((id) => {
        const s = SOURCES[id];
        return (
          <li key={id}>
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {s.title}
            </a>
            <span className="source-meta">
              {s.publisher}
              {s.updated ? `; ${t.body.updated} ${s.updated}` : ''}; {t.body.accessed} {s.accessed}
              {s.license ? `; ${t.body.license} ${s.license}` : ''}
            </span>
            {showNotes && s.note ? <span className="source-meta">{s.note}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}
