import { useEffect, useState, type ComponentType, type MouseEvent } from 'react';
import { href } from '../../app/router';
import { readJson, writeJson } from '../../core/storage';
import { useI18n } from '../../i18n';
import { SpaceTabs } from '../deepsky/SpaceTabs';
import { LEVELS, type Level, type Topic, type VizId, TOPICS } from './topics';
import { DiskViz, PulsarViz, WavesViz } from './viz/AnimatedViz';
import { HorizonViz } from './viz/HorizonViz';
import { ExpansionViz, LensingViz, RotationViz } from './viz/ModelViz';

const LEVEL_KEY = 'extreme-level';
const isLevel = (v: unknown): v is Level => typeof v === 'string' && (LEVELS as string[]).includes(v);

const VIZ: Record<VizId, ComponentType> = {
  horizon: HorizonViz,
  disk: DiskViz,
  waves: WavesViz,
  lensing: LensingViz,
  pulsar: PulsarViz,
  rotation: RotationViz,
  expansion: ExpansionViz,
};

function TopicSection({ topic, level }: { topic: Topic; level: Level }) {
  const { t } = useI18n();
  const tx = t.extreme;
  const Viz = topic.viz ? VIZ[topic.viz] : null;
  return (
    <section id={topic.id} className="extreme-topic" aria-labelledby={`${topic.id}-title`}>
      <div className="extreme-text">
        <p className="body-kicker">{tx.levels[level]}</p>
        <h2 id={`${topic.id}-title`}>{topic.title}</h2>
        <p className="extreme-summary">{topic.summary}</p>
        {topic.levels[level].map((p) => (
          <p key={p.slice(0, 24)}>{p}</p>
        ))}
        <h3>{tx.facts}</h3>
        <dl className="extreme-facts">
          {topic.facts.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>
                {f.value} <span className={`kind kind--${f.kind}`}>{tx.kinds[f.kind]}</span>
              </dd>
            </div>
          ))}
        </dl>
        {topic.links?.length ? (
          <p className="extreme-links">
            {tx.seeAlso}:{' '}
            {topic.links.map((l, i) => (
              <span key={l.label}>
                {i > 0 ? ' · ' : ''}
                <a href={href(l.route)}>{l.label}</a>
              </span>
            ))}
          </p>
        ) : null}
        <details className="extreme-sources">
          <summary>{tx.sources}</summary>
          <ul>
            {topic.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </details>
      </div>
      {Viz ? (
        <div className="extreme-viz">
          <Viz />
        </div>
      ) : null}
    </section>
  );
}

export default function ExtremePage({ topic }: { topic?: string }) {
  const { t } = useI18n();
  const tx = t.extreme;
  const [level, setLevel] = useState<Level>(() => readJson(LEVEL_KEY, 'beginner', isLevel));
  useEffect(() => {
    writeJson(LEVEL_KEY, level);
  }, [level]);
  // Ligação direta a um tema (por exemplo, a partir da pesquisa)
  useEffect(() => {
    if (!topic) return;
    const id = window.setTimeout(() => document.getElementById(topic)?.scrollIntoView({ block: 'start' }), 50);
    return () => window.clearTimeout(id);
  }, [topic]);

  const jump = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    // O hash é usado pelo router: em vez de navegar, desloca a página até ao tema
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="page page--wide extreme-page">
      <SpaceTabs current="extreme" />
      <header className="page-head">
        <h1 className="page-title">{tx.title}</h1>
        <p className="page-lede">{tx.lede}</p>
      </header>
      <div className="extreme-controls">
        <div className="segmented" role="group" aria-label={tx.levelLabel}>
          {LEVELS.map((l) => (
            <button key={l} type="button" className={level === l ? 'is-active' : ''} aria-pressed={level === l} onClick={() => setLevel(l)}>
              {tx.levels[l]}
            </button>
          ))}
        </div>
        <p className="section-note">{tx.levelHint}</p>
      </div>
      <nav className="extreme-index" aria-label={tx.topicsLabel}>
        <ul className="chips">
          {TOPICS.map((tp) => (
            <li key={tp.id}>
              <a className="chip" href={`#${tp.id}`} onClick={(e) => jump(e, tp.id)}>
                {tp.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <p className="section-note">{tx.vizNote}</p>
      {TOPICS.map((tp) => (
        <TopicSection key={tp.id} topic={tp} level={level} />
      ))}
    </div>
  );
}
