// Centroide aproximado de cada estado brasileiro — usado pra plotar o
// mapa de distribuição geográfica sem precisar geocodificar cidade por
// cidade (a app não tem serviço de geocoding configurado).
export const UF_COORDENADAS: Record<string, [number, number]> = {
  AC: [-9.0238, -70.812],
  AL: [-9.5713, -36.782],
  AP: [1.41, -51.77],
  AM: [-3.4168, -65.8561],
  BA: [-12.5797, -41.7007],
  CE: [-5.4984, -39.3206],
  DF: [-15.7998, -47.8645],
  ES: [-19.1834, -40.3089],
  GO: [-15.827, -49.8362],
  MA: [-4.9609, -45.2744],
  MT: [-12.6819, -56.9211],
  MS: [-20.7722, -54.7852],
  MG: [-18.5122, -44.555],
  PA: [-3.4168, -52.2038],
  PB: [-7.24, -36.782],
  PR: [-25.2521, -52.0215],
  PE: [-8.8137, -36.9541],
  PI: [-8.5569, -42.0759],
  RJ: [-22.9068, -43.1729],
  RN: [-5.4026, -36.9541],
  RS: [-30.0346, -51.2177],
  RO: [-10.83, -63.34],
  RR: [1.99, -61.33],
  SC: [-27.2423, -50.2189],
  SP: [-23.5505, -46.6333],
  SE: [-10.9472, -37.0731],
  TO: [-10.1753, -48.2982],
};

export const BRASIL_CENTRO: [number, number] = [-14.235, -51.9253];
