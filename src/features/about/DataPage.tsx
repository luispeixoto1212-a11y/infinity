import { useMemo, type MouseEvent } from 'react';
import { href } from '../../app/router';
import { JPL_TABLE_1 } from '../../core/astro/elements';
import { heliocentricPositionAu } from '../../core/astro/positions';
import { SCENE_SCALE, compressDistanceAu, sizeExaggerationAt } from '../../core/astro/scale';
import { angleBetweenDeg, length, sub } from '../../core/astro/vector';
import { formatNumber } from '../../core/format';
import { BODIES, findBodyById, tr } from '../../data/catalog';
import { ALL_SOURCES } from '../../data/sources';
import { HORIZONS_EPOCH_JD, HORIZONS_REFERENCE } from '../../data/validation';
import { useI18n } from '../../i18n';

const AU_KM = 149_597_870.7;

export function useValidationRows() {
  return useMemo(
    () =>
      HORIZONS_REFERENCE.map((ref) => {
        const body = findBodyById(ref.id);
        if (!body) return null;
        const ours = heliocentricPositionAu(body, HORIZONS_EPOCH_JD);
        const angleArcsec = angleBetweenDeg(ours, ref.vector) * 3600;
        const distKm = length(sub(ours, ref.vector)) * AU_KM;
        const tableKey = body.orbit.kind === 'jpl-approx' ? body.orbit.key : undefined;
        const stated = tableKey ? JPL_TABLE_1[tableKey].stated : undefined;
        return { body, angleArcsec, distKm, target: ref.target, stated };
      }).filter((r): r is NonNullable<typeof r> => r !== null),
    [],
  );
}

export function DataPage() {
  const { t } = useI18n();
  const rows = useValidationRows();
  const earthExaggeration = sizeExaggerationAt(1, 6371);
  const illustrative = BODIES.filter((b) => !b.render.texture);

  return (
    <div className="page page--prose">
      <header className="page-head">
        <h1 className="page-title">{t.about.title}</h1>
        <p className="page-lede">
          Como são calculadas as posições, de onde vêm os números e o que a vista 3D mostra ou não mostra. Todas as
          fontes indicam a data em que foram consultadas.
        </p>
      </header>

      <nav className="toc" aria-label="Nesta página">
        <ol>
          <li><a href="#posicoes" onClick={(e) => jump(e, 'posicoes')}>Posições dos planetas</a></li>
          <li><a href="#validacao" onClick={(e) => jump(e, 'validacao')}>Validação com o JPL Horizons</a></li>
          <li><a href="#escala" onClick={(e) => jump(e, 'escala')}>Escala da vista 3D</a></li>
          <li><a href="#orientacao" onClick={(e) => jump(e, 'orientacao')}>Orientação, rotação e tempo</a></li>
          <li><a href="#dados" onClick={(e) => jump(e, 'dados')}>Dados físicos e tipos de valor</a></li>
          <li><a href="#imagens" onClick={(e) => jump(e, 'imagens')}>Imagens, texturas e estrelas</a></li>
          <li><a href="#limitacoes" onClick={(e) => jump(e, 'limitacoes')}>Limitações conhecidas</a></li>
          <li><a href="#fontes" onClick={(e) => jump(e, 'fontes')}>Todas as fontes</a></li>
        </ol>
      </nav>

      <section id="posicoes" className="prose-section">
        <h2>Posições dos planetas</h2>
        <p>
          Os oito planetas usam os elementos keplerianos médios e as respetivas taxas de variação da Tabela 1 de E. M.
          Standish (JPL), válida entre 1800 e 2050. Para cada instante, a aplicação calcula os elementos, resolve a
          equação de Kepler pelo método iterativo indicado pelo JPL (tolerância de 10⁻⁶ graus) e converte o resultado
          para coordenadas eclípticas J2000. Para a Terra, a tabela dá o baricentro Terra–Lua.
        </p>
        <p>
          Erros máximos indicados pelo JPL para este intervalo: de {JPL_TABLE_1.neptune.stated.lambdaArcsec}″ (Neptuno) a{' '}
          {JPL_TABLE_1.saturn.stated.lambdaArcsec}″ (Saturno) em longitude heliocêntrica. Fora de 1800–2050 os erros
          crescem, por isso a simulação para nesses limites.
        </p>
        <p>
          Plutão e Ceres usam elementos osculadores do JPL Small-Body Database, propagados como um problema de dois
          corpos. A Lua usa os seus elementos médios (Meeus, cap. 47), sem as perturbações periódicas: o erro em
          longitude pode chegar a cerca de 1,5°.
        </p>
      </section>

      <section id="validacao" className="prose-section">
        <h2>Validação com o JPL Horizons</h2>
        <p>
          A tabela compara, no próprio navegador, as posições calculadas por esta aplicação com os vetores das
          efemérides do JPL Horizons (DE441) para 13 de outubro de 2026, 00:00 TDB. Os mesmos valores são verificados
          nos testes automáticos do projeto.
        </p>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Objeto</th>
                <th scope="col">Alvo no Horizons</th>
                <th scope="col" className="num">Diferença angular vista do Sol</th>
                <th scope="col" className="num">Erro máx. indicado (longitude)</th>
                <th scope="col" className="num">Diferença de posição</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.body.id}>
                  <th scope="row">{tr(r.body.name)}</th>
                  <td>{r.target}</td>
                  <td className="num">{r.angleArcsec < 120 ? `${formatNumber(r.angleArcsec, 1)}″` : `${formatNumber(r.angleArcsec / 60, 1)}′`}</td>
                  <td className="num">{r.stated ? `${r.stated.lambdaArcsec}″` : 'não indicado'}</td>
                  <td className="num">{formatNumber(r.distKm, 0)} km</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="section-note">
          1″ = 1/3600 de grau; 1′ = 60″. Diferenças calculadas agora com o mesmo código usado na vista 3D. Em Neptuno a
          diferença em longitude (cerca de 32″) fica acima dos 10″ indicados pelo JPL, e em Mercúrio a diferença de
          distância ao Sol (cerca de 1200 km) fica ligeiramente acima dos 1000 km indicados; todas as diferenças
          angulares dos planetas ficam abaixo de 0,1°. Plutão e Ceres usam um modelo de dois corpos, para o qual a
          tabela do JPL não indica erros.
        </p>
      </section>

      <section id="escala" className="prose-section">
        <h2>Escala da vista 3D</h2>
        <p>
          A vista 3D mostra a direção real de cada objeto em relação ao Sol, mas não as distâncias nem os tamanhos reais.
          À escala real os planetas seriam invisíveis: se a órbita de Neptuno ocupasse a largura do ecrã, a Terra
          teria cerca de um milionésimo dessa largura.
        </p>
        <ul className="prose-list">
          <li>
            Distâncias comprimidas: r<sub>cena</sub> = {SCENE_SCALE.distanceK} × r<sub>UA</sub>
            <sup>{SCENE_SCALE.distancePower}</sup>. Mercúrio fica a {formatNumber(compressDistanceAu(0.387), 0)} unidades
            do Sol e Neptuno a {formatNumber(compressDistanceAu(30.07), 0)}, em vez de uma razão real de cerca de 78.
          </li>
          <li>
            Tamanhos ampliados: o raio desenhado cresce com a raiz quadrada do raio real, com um mínimo para os corpos
            pequenos. À distância da Terra, os planetas aparecem cerca de {formatNumber(Math.round(earthExaggeration / 10) * 10, 0)} vezes maiores
            do que deveriam em relação às distâncias.
          </li>
          <li>O Sol é desenhado com um tamanho fixo e reduzido, para não cobrir as órbitas interiores.</li>
          <li>A Lua é colocada a {SCENE_SCALE.moonDistanceEarthRadii} raios terrestres (desenhados) da Terra, na direção real.</li>
        </ul>
        <p>
          Para comparar tamanhos reais entre si, use a vista <a href={href({ name: 'solar-system' })}>Tamanhos relativos</a> do
          Sistema Solar.
        </p>
      </section>

      <section id="orientacao" className="prose-section">
        <h2>Orientação, rotação e tempo</h2>
        <p>
          A direção do polo norte e a rotação de cada corpo seguem o modelo da IAU (relatório WGCCRE de 2015, Archinal et
          al. 2018), através dos parâmetros publicados no ficheiro pck00011 da NAIF. Na Terra, isto faz coincidir o lado
          iluminado com a hora real. Os mapas de textura de alguns corpos podem não estar alinhados com o meridiano de
          referência oficial, pelo que a orientação das superfícies deve ser vista como aproximada. Ceres não tem modelo
          de polo nesta versão.
        </p>
        <p>
          O relógio do dispositivo dá UTC; os cálculos usam TDB, aproximado por UTC + 69,184 s. A diferença entre esta
          aproximação e o TDB rigoroso é de milissegundos.
        </p>
      </section>

      <section id="dados" className="prose-section">
        <h2>Dados físicos e tipos de valor</h2>
        <p>
          Os valores físicos vêm das fichas da NASA (NSSDCA) e, para as luas, dos parâmetros físicos do JPL. Cada valor
          indica a fonte e um tipo:
        </p>
        <dl className="kind-list">
          {(Object.keys(t.valueKinds) as Array<keyof typeof t.valueKinds>).map((k) => (
            <div key={k}>
              <dt>
                <span className={`kind kind--${k}`}>{t.valueKinds[k]}</span>
              </dt>
              <dd>{t.valueKindsHelp[k]}</dd>
            </div>
          ))}
        </dl>
        <p>
          A gravidade usa a tabela-resumo da NASA para todos os planetas (no equador, incluindo o efeito da rotação; nos
          gigantes gasosos, ao nível de 1 bar), para que a comparação seja coerente. O número de luas muda com frequência
          e é apresentado sempre com a data de consulta.
        </p>
      </section>

      <section id="imagens" className="prose-section">
        <h2>Imagens, texturas e estrelas</h2>
        <ul className="prose-list">
          <li>
            Texturas dos planetas, do Sol e da Lua: Solar System Scope, licença CC BY 4.0, baseadas em dados da NASA. A
            textura de Vénus mostra a superfície obtida por radar, com cores ilustrativas. As nuvens da Terra são um
            mapa estático.
          </li>
          <li>
            Representações ilustrativas, sem textura fiável nesta versão:{' '}
            {illustrative.map((b) => tr(b.name)).join(', ')}.
          </li>
          <li>
            Fotografias nas fichas: obtidas em tempo real da NASA Image and Video Library, com o título, a data e o
            crédito da própria fonte. Se a ligação falhar, a ficha continua utilizável.
          </li>
          <li>
            Estrelas de fundo: as cerca de 5000 estrelas do Yale Bright Star Catalogue até à magnitude 6, nas suas
            posições reais (J2000). A cor é estimada a partir do índice B−V e o tamanho indica o brilho aparente.
          </li>
          <li>O brilho em volta do Sol e das atmosferas é um efeito visual, não uma simulação física.</li>
        </ul>
      </section>

      <section id="limitacoes" className="prose-section">
        <h2>Limitações conhecidas</h2>
        <ul className="prose-list">
          <li>Não há sombras projetadas (por exemplo, a sombra dos anéis em Saturno) nem eclipses.</li>
          <li>As luas, além da nossa, ainda não estão representadas na vista 3D; aparecem nas fichas dos planetas.</li>
          <li>As posições não incluem a aberração da luz nem o tempo de viagem da luz: são posições geométricas.</li>
          <li>A interface está em português de Portugal; a estrutura está preparada para inglês e espanhol.</li>
        </ul>
      </section>

      <section id="fontes" className="prose-section">
        <h2>Todas as fontes</h2>
        <ul className="sources">
          {ALL_SOURCES.map((s) => (
            <li key={s.id}>
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.title}
              </a>
              <span className="source-meta">
                {s.publisher}
                {s.updated ? `; atualizado em ${s.updated}` : ''}; consultado em {s.accessed}
                {s.license ? `; licença ${s.license}` : ''}
                {s.note ? `. ${s.note}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function jump(e: MouseEvent, id: string) {
  // O hash é usado pelo router: faz scroll sem alterar o endereço
  e.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
