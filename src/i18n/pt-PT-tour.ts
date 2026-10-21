/** Textos da visita guiada (tutorial inicial opcional). */
export const tourPt = {
  title: 'Visita guiada',
  offerTitle: 'Primeira visita?',
  offerText: 'Uma visita guiada de um minuto mostra as secções e como ler os dados.',
  offerStart: 'Fazer a visita',
  offerDismiss: 'Agora não',
  menuItem: 'Visita guiada',
  step: (i: number, n: number) => `Passo ${i} de ${n}`,
  prev: 'Anterior',
  next: 'Seguinte',
  finish: 'Concluir',
  close: 'Fechar a visita guiada',
  later: 'Pode voltar a esta visita a qualquer momento no menu «Mais».',
  steps: [
    {
      id: 'welcome',
      title: 'Bem-vindo ao Universe Infinity',
      text: 'Um atlas científico do Universo: o Sistema Solar em 3D com as posições reais, o céu visto de qualquer lugar da Terra, galáxias, estrelas, exoplanetas, missões espaciais e a história do Universo.',
      kinds: 'Cada valor diz o que é e de onde vem:',
    },
    {
      id: 'explore',
      title: 'Explorar em 3D',
      text: 'Arraste para rodar a vista e use a roda do rato ou dois dedos para aproximar. Clique num planeta para ver a sua informação. As posições dos planetas e das luas são calculadas para o instante atual; com a tecla Espaço pausa o tempo e com [ e ] muda a velocidade.',
      action: 'Abrir a vista 3D',
    },
    {
      id: 'planetarium',
      title: 'O céu de qualquer lugar',
      text: 'O planetário mostra o céu de qualquer cidade, em qualquer data entre 1800 e 2050: estrelas, constelações, Via Láctea, Sol, Lua e planetas, com as horas a que nascem e se põem.',
      action: 'Abrir o planetário',
    },
    {
      id: 'search',
      title: 'Pesquisa em todo o Universo',
      text: 'Prima Ctrl K ou / para procurar planetas, luas, asteroides, estrelas, galáxias, exoplanetas, missões e conceitos, em português ou em inglês. Os últimos objetos abertos ficam no histórico.',
      action: 'Abrir a pesquisa',
    },
    {
      id: 'sections',
      title: 'Secções',
      text: 'No menu superior estão o Sistema Solar, o Espaço profundo, os Exoplanetas e o Planetário. Em «Mais» encontra as Missões espaciais, a Linha temporal do Universo, os Favoritos e os Dados e métodos.',
      action: 'Abrir o Sistema Solar',
    },
    {
      id: 'data',
      title: 'Dados verificáveis',
      text: 'Em «Dados e métodos» explicamos de onde vêm os dados e comparamos os cálculos desta aplicação com o JPL Horizons, no próprio navegador. Os favoritos, o histórico e as preferências ficam guardados apenas neste navegador; não é preciso conta.',
      action: 'Abrir Dados e métodos',
    },
  ],
};
