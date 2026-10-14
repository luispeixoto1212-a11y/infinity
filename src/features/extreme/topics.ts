/**
 * Fenómenos extremos: textos em três níveis (iniciante, intermédio, avançado), números-chave com o tipo de
 * valor e fontes. As visualizações associadas dizem se são calculadas (equações físicas) ou ilustrativas.
 */
import type { Route } from '../../app/router';

export type Level = 'beginner' | 'intermediate' | 'advanced';
export type VizId = 'horizon' | 'disk' | 'waves' | 'lensing' | 'pulsar' | 'rotation' | 'expansion';

export interface TopicFact {
  label: string;
  value: string;
  kind: 'measured' | 'derived' | 'estimate';
}

export interface TopicSource {
  title: string;
  url: string;
}

export interface Topic {
  id: string;
  title: string;
  summary: string;
  levels: Record<Level, string[]>;
  facts: TopicFact[];
  viz?: VizId;
  sources: TopicSource[];
  links?: Array<{ label: string; route: Route }>;
  /** Termos para a pesquisa global. */
  terms: string[];
}

const PLANCK = { title: 'Planck Collaboration (2020), Planck 2018 results VI', url: 'https://arxiv.org/abs/1807.06209' };
const GW150914 = { title: 'Abbott et al. (2016), Observation of Gravitational Waves from a Binary Black Hole Merger', url: 'https://arxiv.org/abs/1602.03837' };

export const TOPICS: Topic[] = [
  {
    id: 'formacao-buracos-negros',
    title: 'Como se formam os buracos negros',
    summary: 'Quando a gravidade vence todas as outras forças.',
    terms: ['buraco negro', 'black hole', 'colapso estelar', 'formação de buracos negros'],
    levels: {
      beginner: [
        'Uma estrela é um equilíbrio: a gravidade puxa a matéria para dentro e o calor das reações nucleares empurra-a para fora. Quando uma estrela muito grande gasta o combustível, o centro deixa de se aguentar e cai sobre si mesmo.',
        'Se o que sobra for pesado demais, nada consegue travar o colapso e forma-se um buraco negro: uma região de onde nem a luz consegue sair.',
      ],
      intermediate: [
        'Estrelas com mais de cerca de 8 massas solares terminam com um núcleo de ferro que colapsa em menos de um segundo, provocando uma supernova. Se o núcleo restante ultrapassar a massa máxima de uma estrela de neutrões (cerca de 2 a 2,5 massas solares), colapsa num buraco negro de massa estelar.',
        'Os buracos negros supermassivos, com milhões a milhares de milhões de massas solares, estão no centro das galáxias. Como cresceram tanto, e tão cedo na história do Universo, ainda é uma questão em aberto.',
      ],
      advanced: [
        'A pressão de degenerescência dos neutrões e a interação nuclear forte suportam estrelas de neutrões até ao limite de Tolman–Oppenheimer–Volkoff, que depende da equação de estado da matéria densa; as observações de pulsares de cerca de 2 massas solares fixam-no acima desse valor. Acima do limite, nenhuma pressão finita impede o colapso: os teoremas de singularidade de Penrose e Hawking garantem a formação de uma singularidade escondida por um horizonte (se valer a censura cósmica).',
        'Os buracos negros supermassivos podem nascer de "sementes" leves (restos de estrelas de população III, ~10²–10³ M☉) ou pesadas (colapso direto de nuvens de gás, ~10⁴–10⁶ M☉). Os quasares a z > 7 e os núcleos ativos detetados pelo James Webb a z ≈ 10 favorecem crescimento muito rápido ou sementes pesadas.',
      ],
    },
    facts: [
      { label: 'Massa mínima da estrela que dá uma supernova de colapso', value: 'cerca de 8 massas solares', kind: 'estimate' },
      { label: 'Maior massa medida de uma estrela de neutrões', value: '2,35 ± 0,17 massas solares (PSR J0952−0607)', kind: 'measured' },
      { label: 'Sagitário A*, no centro da Via Láctea', value: '4,3 milhões de massas solares', kind: 'measured' },
    ],
    sources: [
      { title: 'Romani et al. (2022), PSR J0952−0607: The Fastest and Heaviest Known Galactic Neutron Star', url: 'https://arxiv.org/abs/2207.05124' },
      { title: 'GRAVITY Collaboration (2022), Mass distribution in the Galactic Center', url: 'https://arxiv.org/abs/2112.07478' },
    ],
    links: [{ label: 'Buracos negros notáveis', route: { name: 'black-holes' } }],
  },
  {
    id: 'horizonte',
    title: 'Horizonte de acontecimentos',
    summary: 'A fronteira sem regresso, e o que acontece ao tempo perto dela.',
    terms: ['horizonte de acontecimentos', 'event horizon', 'raio de Schwarzschild', 'dilatação do tempo', 'espaguetificação', 'esfera de fotões'],
    viz: 'horizon',
    levels: {
      beginner: [
        'O horizonte de acontecimentos é a "superfície" de um buraco negro, mas não é feita de nada: é a distância a partir da qual seria preciso ir mais depressa do que a luz para escapar.',
        'Perto de um buraco negro o tempo passa mais devagar do que longe dele. E a diferença de atração entre a cabeça e os pés pode esticar um corpo como esparguete.',
      ],
      intermediate: [
        'Para um buraco negro sem rotação, o raio do horizonte é proporcional à massa: cerca de 3 km por cada massa solar. O Sol, comprimido assim, teria 6 km de diâmetro; a Terra, cerca de 1,8 cm.',
        'A 1,5 vezes esse raio fica a esfera de fotões, onde a luz pode orbitar; a 3 vezes, a última órbita estável para a matéria. As forças de maré são enormes junto a buracos negros pequenos, mas fracas no horizonte de um supermassivo: um astronauta atravessaria o de Sagitário A* sem sentir nada de especial.',
      ],
      advanced: [
        'Na métrica de Schwarzschild, rₛ = 2GM/c². Um relógio estático em r marca dτ/dt = √(1 − rₛ/r); a esfera de fotões está em r = 3GM/c² e a órbita circular estável mais interna (ISCO) em r = 6GM/c². A sombra observada tem raio √27 GM/c² ≈ 2,6 rₛ.',
        'A aceleração de maré radial sobre um corpo de comprimento L é Δa ≈ 2GML/r³; no horizonte, Δa ∝ 1/M², por isso diminui para buracos negros mais massivos. Em buracos negros com rotação (métrica de Kerr) o horizonte encolhe até GM/c² e a ISCO pode chegar a GM/c² para órbitas diretas.',
      ],
    },
    facts: [
      { label: 'Raio do horizonte por massa solar', value: '2,95 km', kind: 'derived' },
      { label: 'Relógios GPS: efeito total da relatividade', value: '+38 microssegundos por dia', kind: 'measured' },
      { label: 'Raio da sombra', value: 'cerca de 2,6 vezes o raio do horizonte', kind: 'derived' },
    ],
    sources: [{ title: 'Ashby (2003), Relativity in the Global Positioning System, Living Reviews in Relativity', url: 'https://link.springer.com/article/10.12942/lrr-2003-1' }],
  },
  {
    id: 'disco-acrecao',
    title: 'Disco de acreção',
    summary: 'A matéria que gira e aquece antes de cair.',
    terms: ['disco de acreção', 'accretion disk', 'jatos relativistas', 'M87*'],
    viz: 'disk',
    levels: {
      beginner: [
        'A matéria que cai para um buraco negro não vai a direito: forma um disco que gira muito depressa, como água a escorrer por um ralo.',
        'O atrito aquece o disco a milhões de graus e ele brilha muito. É por isso que alguns buracos negros estão entre os objetos mais luminosos do Universo.',
      ],
      intermediate: [
        'Para cair, o gás tem de perder momento angular; a viscosidade turbulenta (gerada por campos magnéticos) transporta-o para fora e converte energia de órbita em calor. A parte interior emite raios X.',
        'A imagem do Event Horizon Telescope de M87* (2019) mostra um anel brilhante mais intenso de um lado: o gás que se aproxima de nós parece mais brilhante (efeito Doppler relativista).',
      ],
      advanced: [
        'A eficiência radiativa η = 1 − E_ISCO/mc² vale cerca de 5,7 % para um buraco negro de Schwarzschild e até 42 % para um de Kerr extremo, muito acima dos 0,7 % da fusão de hidrogénio. A luminosidade de Eddington, L_Edd ≈ 1,26 × 10³¹ W (M/M☉), limita a acreção esférica estacionária.',
        'O modelo de disco fino de Shakura–Sunyaev dá T(r) ∝ r^(−3/4) longe da ISCO; a acreção pouco eficiente (como em Sagitário A*) forma fluxos quentes e espessos. Os jatos podem extrair energia da rotação do buraco negro pelo mecanismo de Blandford–Znajek.',
      ],
    },
    facts: [
      { label: 'Massa de M87*', value: '6,5 mil milhões de massas solares', kind: 'measured' },
      { label: 'Eficiência máxima da acreção', value: 'até 42 % da energia em repouso', kind: 'derived' },
      { label: 'Eficiência da fusão nuclear no Sol', value: '0,7 %', kind: 'derived' },
    ],
    sources: [{ title: 'Event Horizon Telescope Collaboration (2019), First M87 Event Horizon Telescope Results I', url: 'https://arxiv.org/abs/1906.11238' }],
  },
  {
    id: 'ondas-gravitacionais',
    title: 'Ondas gravitacionais',
    summary: 'Ondulações do próprio espaço-tempo.',
    terms: ['ondas gravitacionais', 'gravitational waves', 'LIGO', 'Virgo', 'GW150914', 'GW170817', 'kilonova'],
    viz: 'waves',
    levels: {
      beginner: [
        'Quando objetos muito pesados se movem depressa, como dois buracos negros a girar um à volta do outro, o espaço à sua volta ondula, como a superfície de um lago.',
        'Em 2015, detetores nos Estados Unidos sentiram pela primeira vez estas ondas, vindas de dois buracos negros que se fundiram há 1300 milhões de anos.',
      ],
      intermediate: [
        'A onda estica e encolhe o espaço numa direção e na perpendicular. Os detetores LIGO usam braços de 4 km com laser: a passagem de GW150914 mudou o comprimento dos braços cerca de 400 vezes menos do que o diâmetro de um protão.',
        'Em 2017, a fusão de duas estrelas de neutrões (GW170817) foi vista também em raios gama e luz: a "kilonova" mostrou que estas colisões produzem elementos pesados como o ouro.',
      ],
      advanced: [
        'Na relatividade geral linearizada, a radiação gravitacional é quadrupolar: a potência emitida por um binário circular é P = (32/5) G⁴(m₁m₂)²(m₁+m₂)/(c⁵a⁵). A frequência e a amplitude crescem até à fusão ("chirp"), e a evolução da frequência dá a massa de chirp ℳ = (m₁m₂)^(3/5)/(m₁+m₂)^(1/5).',
        'Em GW150914, buracos negros de cerca de 36 e 29 massas solares fundiram-se num de cerca de 62, irradiando cerca de 3 massas solares de energia em ondas gravitacionais em frações de segundo, com deformação máxima h ≈ 10⁻²¹.',
      ],
    },
    facts: [
      { label: 'GW150914 (14/09/2015)', value: '36 + 29 → 62 massas solares', kind: 'measured' },
      { label: 'Energia irradiada', value: 'cerca de 3 massas solares × c²', kind: 'measured' },
      { label: 'Distância', value: 'cerca de 410 Mpc (1300 milhões de anos-luz)', kind: 'measured' },
    ],
    sources: [
      GW150914,
      { title: 'Abbott et al. (2017), GW170817: Observation of Gravitational Waves from a Binary Neutron Star Inspiral', url: 'https://arxiv.org/abs/1710.05832' },
    ],
  },
  {
    id: 'lentes-gravitacionais',
    title: 'Lentes gravitacionais',
    summary: 'A gravidade que curva a luz e amplia galáxias distantes.',
    terms: ['lente gravitacional', 'gravitational lensing', 'anel de Einstein', 'microlente', 'Eddington'],
    viz: 'lensing',
    levels: {
      beginner: [
        'A gravidade curva o caminho da luz. Uma galáxia ou um enxame de galáxias pode funcionar como uma lupa gigante e mostrar-nos, ampliadas e deformadas, galáxias que estão muito mais longe.',
        'Quando tudo está perfeitamente alinhado, a imagem forma um anel: um anel de Einstein.',
      ],
      intermediate: [
        'Durante o eclipse do Sol de 1919, Eddington e colegas mediram a deflexão da luz de estrelas perto do Sol, com o valor previsto pela relatividade geral (1,75″ no limbo). Em 1979 foi descoberto o primeiro quasar duplicado por uma lente.',
        'As lentes permitem pesar galáxias e enxames (incluindo a matéria escura) e, através da microlente, descobrir planetas noutras estrelas.',
      ],
      advanced: [
        'Para uma lente pontual, a deflexão é α = 4GM/(c²b) e a equação da lente β = θ − θ_E²/θ dá duas imagens θ± = [β ± √(β² + 4θ_E²)]/2, com o raio de Einstein θ_E = √(4GM D_LS/(c² D_L D_S)). A ampliação total é A = (u² + 2)/(u√(u² + 4)), com u = β/θ_E.',
        'Lentes extensas são descritas pela convergência κ = Σ/Σ_cr; os atrasos temporais entre imagens de quasares variáveis medem H₀ independentemente da escada de distâncias.',
      ],
    },
    facts: [
      { label: 'Deflexão da luz no limbo do Sol', value: '1,75″', kind: 'derived' },
      { label: 'Primeira lente gravitacional', value: 'quasar duplo Q0957+561 (1979)', kind: 'measured' },
    ],
    sources: [
      { title: 'Dyson, Eddington & Davidson (1920), Phil. Trans. R. Soc. A 220, 291', url: 'https://doi.org/10.1098/rsta.1920.0009' },
      { title: 'Walsh, Carswell & Weymann (1979), Nature 279, 381', url: 'https://doi.org/10.1038/279381a0' },
    ],
  },
  {
    id: 'estrelas-de-neutroes',
    title: 'Estrelas de neutrões e pulsares',
    summary: 'Uma estrela maior do que o Sol comprimida no tamanho de uma cidade.',
    terms: ['estrela de neutrões', 'neutron star', 'pulsar', 'magnetar', 'Jocelyn Bell'],
    viz: 'pulsar',
    levels: {
      beginner: [
        'Uma estrela de neutrões é o que sobra do núcleo de uma estrela que explodiu: mais massa do que o Sol num diâmetro de cerca de 25 km, o tamanho de uma cidade. Uma colher de chá do seu material pesaria milhares de milhões de toneladas.',
        'Muitas giram muito depressa e emitem feixes de rádio, como um farol. Quando o feixe passa pela Terra vemos um impulso: são os pulsares.',
      ],
      intermediate: [
        'O primeiro pulsar foi descoberto em 1967 por Jocelyn Bell Burnell. O pulsar do Caranguejo, no centro da nebulosa M1, roda cerca de 30 vezes por segundo; o mais rápido conhecido, 716 vezes por segundo.',
        'As medições do telescópio NICER, na Estação Espacial, indicam raios de cerca de 12 km. Os magnetares têm os campos magnéticos mais intensos conhecidos, até 10¹¹ tesla.',
      ],
      advanced: [
        'A densidade central excede a densidade nuclear de saturação (~2,7 × 10¹⁷ kg/m³); a equação de estado, ainda incerta, liga massa e raio. As medições de massas de ~2 M☉ e os raios do NICER e a deformabilidade de maré de GW170817 restringem-na.',
        'A travagem da rotação de um pulsar dipolar dá o campo magnético B ∝ √(P Ṗ) e a idade característica τ = P/(2Ṗ). A rotação limite é fixada pela velocidade de rotura à superfície; a frequência máxima observada (716 Hz) já limita equações de estado muito "macias".',
      ],
    },
    facts: [
      { label: 'Raio típico (NICER)', value: 'cerca de 12 km', kind: 'measured' },
      { label: 'Pulsar mais rápido conhecido', value: '716 rotações por segundo (PSR J1748−2446ad)', kind: 'measured' },
      { label: 'Pulsar do Caranguejo', value: 'período de 33,7 ms', kind: 'measured' },
    ],
    sources: [
      { title: 'Hewish et al. (1968), Observation of a Rapidly Pulsating Radio Source, Nature 217, 709', url: 'https://doi.org/10.1038/217709a0' },
      { title: 'Hessels et al. (2006), A Radio Pulsar Spinning at 716 Hz', url: 'https://arxiv.org/abs/astro-ph/0601337' },
      { title: 'Riley et al. (2019), A NICER View of PSR J0030+0451', url: 'https://arxiv.org/abs/1912.05702' },
    ],
    links: [{ label: 'Nebulosa do Caranguejo (M1)', route: { name: 'deep-sky-object', id: 'm1' } }],
  },
  {
    id: 'supernovas',
    title: 'Supernovas',
    summary: 'As explosões que espalham os elementos pelo Universo.',
    terms: ['supernova', 'SN 1987A', 'SN 1054', 'vela-padrão', 'tipo Ia'],
    levels: {
      beginner: [
        'Uma supernova é a explosão de uma estrela. Durante algumas semanas pode brilhar mais do que uma galáxia inteira.',
        'Grande parte dos átomos do nosso corpo, como o cálcio dos ossos ou o ferro do sangue, foram fabricados em estrelas e espalhados por explosões destas.',
      ],
      intermediate: [
        'Há dois grandes tipos. As de colapso do núcleo acontecem em estrelas com mais de cerca de 8 massas solares e deixam uma estrela de neutrões ou um buraco negro. As do tipo Ia são anãs brancas que explodem por inteiro numa reação termonuclear.',
        'A SN 1987A, na Grande Nuvem de Magalhães, foi a mais próxima vista desde a invenção do telescópio, e dela chegaram cerca de duas dezenas de neutrinos. A Nebulosa do Caranguejo é o resto da supernova registada por astrónomos chineses em 1054.',
      ],
      advanced: [
        'No colapso do núcleo, cerca de 99 % dos ~10⁴⁶ J libertados saem em neutrinos; só ~1 % se converte na energia cinética da explosão, e o mecanismo (aquecimento por neutrinos, instabilidades multidimensionais) só recentemente começou a ser reproduzido em simulações 3D.',
        'As supernovas Ia atingem uma magnitude absoluta de pico M ≈ −19,3 depois de padronizadas pela relação entre o brilho máximo e a rapidez do declínio (Phillips), o que as tornou "velas-padrão": foi com elas que se descobriu, em 1998, que a expansão do Universo acelera.',
      ],
    },
    facts: [
      { label: 'SN 1987A', value: '23/02/1987, a cerca de 168 000 anos-luz', kind: 'measured' },
      { label: 'Pico das supernovas Ia', value: 'magnitude absoluta ≈ −19,3', kind: 'measured' },
      { label: 'Última supernova vista na Via Láctea', value: 'SN 1604 (Kepler)', kind: 'measured' },
    ],
    sources: [
      { title: 'Hirata et al. (1987), Observation of a neutrino burst from the supernova SN1987A, PRL 58, 1490', url: 'https://doi.org/10.1103/PhysRevLett.58.1490' },
      { title: 'Riess et al. (1998), Observational Evidence from Supernovae for an Accelerating Universe', url: 'https://arxiv.org/abs/astro-ph/9805201' },
    ],
    links: [{ label: 'Nebulosa do Caranguejo (M1)', route: { name: 'deep-sky-object', id: 'm1' } }],
  },
  {
    id: 'quasares',
    title: 'Quasares',
    summary: 'Buracos negros supermassivos a devorar matéria, visíveis do outro lado do Universo.',
    terms: ['quasar', 'quasares', 'núcleo ativo', 'AGN', '3C 273', 'blazar'],
    levels: {
      beginner: [
        'Um quasar é o centro de uma galáxia onde um buraco negro gigante está a engolir muito gás. O gás aquece tanto que brilha mais do que todas as estrelas da galáxia juntas.',
        'São tão luminosos que os vemos a milhares de milhões de anos-luz, tal como eram quando o Universo era jovem.',
      ],
      intermediate: [
        'O primeiro foi identificado em 1963: Maarten Schmidt percebeu que a "estrela" 3C 273 tinha um desvio para o vermelho de 0,158, o que a colocava a mais de 2 mil milhões de anos-luz e exigia uma luminosidade enorme.',
        'Os quasares são uma fase dos núcleos ativos de galáxias. Quando o jato aponta para nós chamam-se blazares. Os mais distantes mostram que já existiam buracos negros de mil milhões de massas solares menos de 700 milhões de anos depois do Big Bang.',
      ],
      advanced: [
        'A luminosidade de um quasar, até ~10⁴⁰ W, implica acreção de alguns massas solares por ano com eficiência ~10 %. A largura das riscas da região de linhas largas e o seu tamanho (medido por reverberação) dão a massa do buraco negro pelo teorema do virial.',
        'O quasar J0313−1806 (z = 7,64) tem um buraco negro de ~1,6 × 10⁹ M☉ apenas ~670 milhões de anos depois do Big Bang; o James Webb e o Chandra detetaram núcleos ativos ainda mais cedo, como UHZ1 (z ≈ 10,1), o que favorece sementes pesadas.',
      ],
    },
    facts: [
      { label: '3C 273', value: 'z = 0,158; primeiro quasar identificado (1963)', kind: 'measured' },
      { label: 'Quasar J0313−1806', value: 'z = 7,64', kind: 'measured' },
    ],
    sources: [
      { title: 'Schmidt (1963), 3C 273: A Star-Like Object with Large Red-Shift, Nature 197, 1040', url: 'https://doi.org/10.1038/1971040a0' },
      { title: 'Wang et al. (2021), A Luminous Quasar at Redshift 7.642', url: 'https://arxiv.org/abs/2101.03179' },
      { title: 'Bogdán et al. (2023), Evidence for heavy-seed origin of early supermassive black holes from a z ≈ 10 X-ray quasar', url: 'https://arxiv.org/abs/2305.15458' },
    ],
    links: [{ label: 'Calculadora cosmológica', route: { name: 'timeline' } }],
  },
  {
    id: 'materia-escura',
    title: 'Matéria escura',
    summary: 'A massa invisível que segura as galáxias.',
    terms: ['matéria escura', 'dark matter', 'curva de rotação', 'Vera Rubin', 'Bullet Cluster'],
    viz: 'rotation',
    levels: {
      beginner: [
        'As estrelas nas zonas exteriores das galáxias giram depressa demais para a matéria que vemos: deviam ser atiradas para fora. Há algo invisível que as segura com a sua gravidade: chamamos-lhe matéria escura.',
        'Não emite nem absorve luz e ainda ninguém sabe do que é feita. Há cerca de cinco vezes mais matéria escura do que matéria normal.',
      ],
      intermediate: [
        'Fritz Zwicky notou-a em 1933 no enxame de Coma; Vera Rubin e Kent Ford mediram nos anos 1970 curvas de rotação de galáxias que ficam planas longe do centro. O enxame da Bala mostra a massa (medida por lentes gravitacionais) separada do gás quente.',
        'A radiação cósmica de fundo indica que a matéria escura é cerca de 26 % do conteúdo do Universo, contra 5 % de matéria normal. Experiências subterrâneas e no LHC procuram as suas partículas, até agora sem sucesso.',
      ],
      advanced: [
        'Num disco em equilíbrio, v²(r) = GM(<r)/r: com a massa visível concentrada, v deveria cair como r^(−1/2) (regime kepleriano). Curvas planas implicam M(<r) ∝ r, como num halo isotérmico (ρ ∝ r⁻²) ou no perfil de Navarro–Frenk–White das simulações.',
        'O Planck mede Ω_c h² = 0,1193 e Ω_b h² = 0,0224 a partir dos picos acústicos. Candidatos: partículas massivas de interação fraca, axiões, neutrinos estéreis; alternativas como a MOND explicam curvas de rotação mas têm dificuldade com enxames e com a radiação de fundo.',
      ],
    },
    facts: [
      { label: 'Matéria escura no Universo', value: '≈ 26 %', kind: 'measured' },
      { label: 'Matéria normal', value: '≈ 4,9 %', kind: 'measured' },
      { label: 'Velocidade de rotação junto ao Sol', value: '≈ 229 km/s', kind: 'measured' },
    ],
    sources: [
      PLANCK,
      { title: 'Rubin & Ford (1970), Rotation of the Andromeda Nebula, ApJ 159, 379', url: 'https://doi.org/10.1086/150317' },
      { title: 'Clowe et al. (2006), A direct empirical proof of the existence of dark matter', url: 'https://arxiv.org/abs/astro-ph/0608407' },
      { title: 'Eilers et al. (2019), The Circular Velocity Curve of the Milky Way', url: 'https://arxiv.org/abs/1810.09466' },
    ],
  },
  {
    id: 'energia-escura',
    title: 'Energia escura',
    summary: 'O que faz a expansão do Universo acelerar.',
    terms: ['energia escura', 'dark energy', 'constante cosmológica', 'expansão acelerada', 'DESI'],
    viz: 'expansion',
    levels: {
      beginner: [
        'O Universo está a expandir-se, e em 1998 descobriu-se que essa expansão está a acelerar. A causa desconhecida chama-se energia escura.',
        'É cerca de 69 % de tudo o que existe no Universo, mas não sabemos o que é.',
      ],
      intermediate: [
        'A descoberta veio de supernovas distantes que pareciam menos brilhantes do que o esperado, e valeu o Prémio Nobel da Física de 2011. A radiação de fundo e as oscilações acústicas dos bariões confirmaram-na.',
        'A explicação mais simples é a constante cosmológica de Einstein, uma energia do próprio vácuo. Em 2025, o levantamento DESI encontrou indícios de que a energia escura pode mudar com o tempo; ainda não é uma descoberta confirmada.',
      ],
      advanced: [
        'Com equação de estado w = p/(ρc²), a aceleração exige w < −1/3; a constante cosmológica tem w = −1 e ρ constante. A expansão acelera quando Ω_m(1+z)³ < 2Ω_Λ, isto é, para z ≲ 0,64 com os parâmetros do Planck.',
        'A previsão ingénua da energia do vácuo pela teoria quântica de campos excede o valor observado em dezenas de ordens de grandeza (o problema da constante cosmológica). Os dados DESI DR2 combinados com supernovas e a radiação de fundo preferem w₀ > −1 e wₐ < 0 com significância de 2,8 a 4,2σ, consoante as supernovas usadas.',
      ],
    },
    facts: [
      { label: 'Energia escura (Planck 2018)', value: 'Ω_Λ ≈ 0,69', kind: 'measured' },
      { label: 'A aceleração começou', value: 'há cerca de 6 mil milhões de anos', kind: 'derived' },
    ],
    sources: [
      PLANCK,
      { title: 'Perlmutter et al. (1999), Measurements of Ω and Λ from 42 High-Redshift Supernovae', url: 'https://arxiv.org/abs/astro-ph/9812133' },
      { title: 'DESI Collaboration (2025), DESI DR2 Results II: BAO and Cosmological Constraints', url: 'https://arxiv.org/abs/2503.14738' },
    ],
    links: [{ label: 'Linha temporal e calculadora cosmológica', route: { name: 'timeline' } }],
  },
];

export const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced'];
