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
import { MOON_CHECK_DATES, MOON_CHECK_VECTORS } from '../../data/moonValidation';
import { ARCHIVE_CHECK, ARCHIVE_CHECK_DATE } from '../exoplanets/archiveCheck';
import { HIPPARCOS_CHECK } from '../stars/hipparcosCheck';
import { planetocentricOffsetKm } from '../../core/astro/positions';
import { useI18n } from '../../i18n';
import { SkyValidationSection } from './SkyValidationSection';

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

export function useMoonValidationRows() {
  return useMemo(
    () =>
      MOON_CHECK_VECTORS.map((ref) => {
        const body = findBodyById(ref.id);
        if (!body) return null;
        const errorsDeg = MOON_CHECK_DATES.map((d, i) => {
          const offset = planetocentricOffsetKm(body, d.jd);
          return offset ? angleBetweenDeg(offset, ref.vectorsKm[i]!) : Number.NaN;
        });
        const parent = body.parent ? findBodyById(body.parent) : undefined;
        return { body, parent, errorsDeg };
      }).filter((r): r is NonNullable<typeof r> => r !== null),
    [],
  );
}

export function DataPage() {
  const { t } = useI18n();
  const rows = useValidationRows();
  const moonRows = useMoonValidationRows();
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
          <li><a href="#luas" onClick={(e) => jump(e, 'luas')}>Órbitas das luas</a></li>
          <li><a href="#planetario" onClick={(e) => jump(e, 'planetario')}>Planetário: o céu de um lugar</a></li>
          <li><a href="#exoplanetas" onClick={(e) => jump(e, 'exoplanetas')}>Exoplanetas</a></li>
          <li><a href="#missoes" onClick={(e) => jump(e, 'missoes')}>Missões espaciais</a></li>
          <li><a href="#espaco-profundo" onClick={(e) => jump(e, 'espaco-profundo')}>Espaço profundo, estrelas e buracos negros</a></li>
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
          corpos. A Lua usa a teoria ELP-2000/82 truncada de J. Meeus (cap. 47, 120 termos periódicos): face ao
          Horizons, a diferença fica entre 9″ e 22″ em cinco datas de 2000 a 2030 (ver a secção Planetário).
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

      <section id="luas" className="prose-section">
        <h2>Órbitas das luas</h2>
        <p>
          As 20 luas além da nossa usam órbitas ajustadas às efemérides do JPL Horizons. A partir da posição e da velocidade
          de cada lua em relação ao planeta a 13 de outubro de 2026, a aplicação calcula os elementos orbitais e ajusta o
          movimento médio às posições do Horizons 400 dias antes e um ano depois, contando as voltas com o período sideral
          publicado pelo JPL. A órbita fica depois fixa: não inclui a precessão nem as perturbações entre luas.
        </p>
        <p>
          Para medir o erro de forma independente, a tabela compara o modelo com posições do Horizons em duas datas que não entraram
          no ajuste: uma entre as datas usadas e outra dois anos depois. Os períodos obtidos coincidem com os publicados
          (por exemplo, 1,769 dias para Io e 0,3189 dias para Fobos) e Tritão surge, como deve, numa órbita retrógrada
          inclinada cerca de 157° face ao equador de Neptuno. Os maiores desvios, entre 2° e 6°, são os de Fobos, Mimas,
          Miranda, Europa e Tétis, cujas órbitas mudam depressa (achatamento do planeta e ressonâncias entre luas). Fora de
          2025–2028 os erros crescem; para datas a décadas de distância, as posições das luas são apenas indicativas.
        </p>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Lua</th>
                <th scope="col">Planeta</th>
                {MOON_CHECK_DATES.map((d) => (
                  <th key={d.jd} scope="col" className="num">
                    Diferença a {d.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {moonRows.map((r) => (
                <tr key={r.body.id}>
                  <th scope="row">{tr(r.body.name)}</th>
                  <td>{r.parent ? tr(r.parent.name) : '—'}</td>
                  {r.errorsDeg.map((e, i) => (
                    <td key={i} className="num">
                      {e < 0.01 ? '< 0,01°' : `${formatNumber(e, e < 1 ? 2 : 1)}°`}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="section-note">
          Diferença angular vista do centro do planeta, calculada agora com o mesmo código da vista 3D. As luas com rotação
          síncrona mostram sempre a mesma face ao planeta. Os mapas das luas e de Plutão são da coleção
          NASA 3D Resources; as zonas que nenhuma sonda fotografou aparecem com um tom neutro uniforme.
        </p>
      </section>

      <SkyValidationSection />

      <section id="exoplanetas" className="prose-section">
        <h2>Exoplanetas</h2>
        <p>
          Os exoplanetas vêm da tabela Planetary Systems Composite Parameters (PSCompPars) do NASA Exoplanet Archive, que
          junta para cada planeta confirmado os valores mais completos publicados. A aplicação usa a cópia que o projeto
          Open Exoplanet Catalogue descarrega todas as noites do arquivo (versão de 13 de outubro de 2026, com 6445
          planetas) e converte-a sem alterar os valores, apenas arredondando a cinco algarismos significativos.
        </p>
        <p>
          O arquivo completa alguns raios e massas com valores calculados a partir da outra grandeza (relação
          massa–raio), mas a cópia não guarda essa indicação. Por isso, a aplicação só trata como medido um valor com
          incerteza publicada; os restantes aparecem com ≈ e a etiqueta «Estimativa». O raio de planetas fotografados
          diretamente é sempre tratado como estimativa, porque resulta de modelos. Nos planetas descobertos por
          velocidade radial que não transitam, a massa é em regra a massa mínima (M·sin i).
        </p>
        <p>
          Algumas grandezas são calculadas pela aplicação e marcadas como tal: a luminosidade da estrela, L = R² × (T /
          5772 K)⁴; a energia recebida pelo planeta, S = L / a² (a Terra recebe 1); o semieixo maior pela terceira lei
          de Kepler, a³ = M × P², quando o arquivo não o indica; e a classe de tamanho, com os intervalos da missão
          Kepler (menos de 1,25 raios terrestres; 1,25 a 2; 2 a 6; 6 a 15; mais de 15).
        </p>
        <p>
          Na vista das órbitas, as distâncias e as excentricidades estão à escala, mas a orientação das órbitas não é
          conhecida para a maioria dos sistemas e é ilustrativa. A faixa verde marca as distâncias a que o planeta
          receberia tanta energia como Vénus (cerca de 1,91 vezes a da Terra) ou como Marte (cerca de 0,43): é uma
          referência de comparação, não um modelo de zona habitável.
        </p>
        <p>
          Verificação: para {ARCHIVE_CHECK.length} planetas de 14 sistemas (TRAPPIST-1, Proxima Centauri, 55 Cancri, Kepler-90
          e outros), a aplicação foi comparada com consultas feitas diretamente à API TAP do arquivo a{' '}
          {ARCHIVE_CHECK_DATE}. Período, semieixo maior, raio, massa e ano de descoberta coincidem (diferenças abaixo de
          1%); os testes automáticos repetem esta comparação.
        </p>
      </section>

      <section id="espaco-profundo" className="prose-section">
        <h2>Espaço profundo, estrelas e buracos negros</h2>
        <p>
          Os 110 objetos Messier têm as posições, os tipos, as dimensões aparentes e as magnitudes do OpenNGC. As
          distâncias e as descrições vêm das páginas do NASA Hubble Messier Catalog (89 objetos). As páginas foram
          transcritas duas vezes, de forma independente, a 13 e a 14 de outubro de 2026, e as duas transcrições coincidem
          nos 89 objetos (distância, magnitude, constelação e tipo). Para 13 enxames abertos sem página da NASA, a
          distância é a calculada a partir das paralaxes da Gaia por Cantat-Gaudin et al. (2020). Oito objetos ficam
          sem distância, por nenhuma destas fontes a indicar.
        </p>
        <p>
          O tamanho real aproximado é calculado pela aplicação: distância × tamanho aparente (em radianos). Depende de
          até onde se mede o brilho difuso do objeto e serve só como ordem de grandeza.
        </p>
        <p>
          O mapa do céu usa a projeção de Hammer–Aitoff, que conserva as áreas, em coordenadas equatoriais J2000. As
          linhas das constelações e o contorno da Via Láctea são do d3-celestial; a Via Láctea é desenhada a partir de
          uma grelha de 0,5° com os cinco níveis de brilho desse contorno, por isso é ilustrativa.
        </p>
        <p>
          As estrelas vêm do AT-HYG v3.2: as que têm nome próprio aprovado pela IAU e todas as conhecidas a menos de
          20 anos-luz. As distâncias usam a Gaia DR3 quando existe e, para as estrelas mais brilhantes, o Hipparcos. Para{' '}
          {HIPPARCOS_CHECK.length} estrelas brilhantes e próximas, as distâncias foram comparadas com as paralaxes do
          Hipparcos (nova redução de 2007) consultadas diretamente no VizieR: coincidem a menos de 1% quando a fonte é o
          Hipparcos e dentro do erro do Hipparcos quando é a Gaia. A temperatura é estimada a partir do índice de cor
          B−V (Ballesteros 2012) e a luminosidade a partir da magnitude absoluta, só no visível; ambas estão assinaladas
          como calculadas.
        </p>
        <p>
          Nos buracos negros, a massa e a distância são as das fontes indicadas em cada caso; o raio do horizonte é
          calculado pela aplicação (raio de Schwarzschild, 2GM/c², cerca de 2,95 km por massa solar, sem rotação).
        </p>
      </section>

      <section id="missoes" className="prose-section">
        <h2>Missões espaciais</h2>
        <p>
          As datas históricas seguem o catálogo NSSDCA da NASA e as páginas das agências (NASA, ESA, JAXA, ISRO, CNSA). Para
          cada missão em curso ou planeada, o estado foi verificado a 14 de outubro de 2026 numa fonte indicada na própria
          ficha, com a data dessa fonte: comunicados da NASA, da ESA ou do JPL sempre que existem e, na sua falta, notícias
          especializadas ou a Wikipédia, assinaladas como tal. Os acontecimentos futuros aparecem como "previstos" e são
          planos das agências, que podem mudar.
        </p>
        <p>
          Quando as fontes não permitem confirmar o estado, a ficha diz isso mesmo: é o caso da Juno, cuja extensão aprovada
          terminava em setembro de 2025 e para a qual não encontrámos um comunicado oficial posterior. As fotografias vêm em
          tempo real da NASA Image and Video Library.
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
          <li>
            Luas: a direção em relação ao planeta é a real, mas a distância é comprimida em escala logarítmica, d = R ×
            ({SCENE_SCALE.moonDistanceBase} + {SCENE_SCALE.moonDistanceLog} × ln(r / R)), em que R é o raio desenhado do
            planeta e r / R a distância real em raios do planeta. A ordem das órbitas mantém-se e as luas ficam fora dos
            anéis desenhados.
          </li>
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
            {illustrative.map((b) => tr(b.name)).join(', ')}. As luas e Plutão usam mapas da NASA 3D Resources (sem
            direitos de autor).
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
          <li>Na vista 3D, as luas, as suas órbitas e as etiquetas só aparecem quando a câmara se aproxima do planeta.</li>
          <li>Fobos e Deimos são muito irregulares, mas aparecem como esferas.</li>
          <li>
            Na vista 3D, as posições são geométricas (sem aberração nem tempo de viagem da luz). O planetário inclui o tempo
            de luz e a paralaxe, mas não a nutação nem a aberração anual (até 20″).
          </li>
          <li>As estrelas do planetário estão nas posições J2000, sem movimento próprio: para 1800 ou 2050, a Estrela de Barnard pode estar deslocada até 0,5°; as restantes, muito menos.</li>
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
