import type { BoardItemStatus } from "./board-types";

export type LocalIconAsset = {
  id: string;
  name: string;
  code: string;
  categoryId: string;
  imageUrl: string;
  statusImageUrls?: Partial<Record<BoardItemStatus, string>>;
};

export const localIconAssets: LocalIconAsset[] = [
  {
    id: "asset-helic",
    name: "Helic",
    code: "00.00",
    categoryId: "helicoides",
    imageUrl: "/icons/00-00-helic.png",
  },
  {
    id: "asset-pit",
    name: "PIT",
    code: "01.01",
    categoryId: "instrumentacao",
    imageUrl: "/icons/01-01-pit-disponivel.png",
    statusImageUrls: {
      available: "/icons/01-01-pit-disponivel.png",
      on_site: "/icons/01-02-pit-em-obra.png",
      maintenance: "/icons/01-03-pit-manutencao.png",
    },
  },
  {
    id: "asset-pda",
    name: "PDA",
    code: "02.01",
    categoryId: "instrumentacao",
    imageUrl: "/icons/02-01-pda-disponivel.png",
    statusImageUrls: {
      available: "/icons/02-01-pda-disponivel.png",
      on_site: "/icons/02-02-pda-em-obra.png",
      maintenance: "/icons/02-03-pda-manutencao.png",
    },
  },
  {
    id: "asset-hammer",
    name: "Hammer",
    code: "03.01",
    categoryId: "cravacao",
    imageUrl: "/icons/03-01-hammer-disponivel.png",
    statusImageUrls: {
      available: "/icons/03-01-hammer-disponivel.png",
      on_site: "/icons/03-02-hammer-em-obra.png",
      maintenance: "/icons/03-03-hammer-manutencao.png",
    },
  },
  {
    id: "asset-torre",
    name: "Torre",
    code: "04.01",
    categoryId: "cravacao",
    imageUrl: "/icons/04-01-torre-disponivel.png",
    statusImageUrls: {
      available: "/icons/04-01-torre-disponivel.png",
      on_site: "/icons/04-02-torre-em-obra.png",
      maintenance: "/icons/04-03-torre-manutencao.png",
    },
  },
  {
    id: "asset-viga-pce",
    name: "Viga PCE",
    code: "05.01",
    categoryId: "vigas",
    imageUrl: "/icons/05-01-viga-pce-disponivel.png",
    statusImageUrls: {
      available: "/icons/05-01-viga-pce-disponivel.png",
      on_site: "/icons/05-02-viga-pce-em-obra.png",
      maintenance: "/icons/05-03-viga-pce-manutencao.png",
    },
  },
  {
    id: "asset-bobcat",
    name: "Bobcat",
    code: "06.01",
    categoryId: "apoio",
    imageUrl: "/icons/06-01-bobcat-disponivel.png",
    statusImageUrls: {
      available: "/icons/06-01-bobcat-disponivel.png",
      on_site: "/icons/06-02-bobcat-em-obra.png",
      maintenance: "/icons/06-03-bobcat-manutencao.png",
    },
  },
  {
    id: "asset-t10",
    name: "T10",
    code: "07.01",
    categoryId: "perfuracao",
    imageUrl: "/icons/07-01-t10-disponivel.png",
    statusImageUrls: {
      available: "/icons/07-01-t10-disponivel.png",
      on_site: "/icons/07-02-t10-em-obra.png",
      maintenance: "/icons/07-03-t10-manutencao.png",
    },
  },
  {
    id: "asset-munck",
    name: "Munck",
    code: "08.01",
    categoryId: "apoio",
    imageUrl: "/icons/08-01-munck-disponivel.png",
    statusImageUrls: {
      available: "/icons/08-01-munck-disponivel.png",
      on_site: "/icons/08-02-munck-em-obra.png",
      maintenance: "/icons/08-03-munck-manutencao.png",
    },
  },
  {
    id: "asset-bomba",
    name: "Bomba",
    code: "09.01",
    categoryId: "apoio",
    imageUrl: "/icons/09-01-bomba-disponivel.png",
    statusImageUrls: {
      available: "/icons/09-01-bomba-disponivel.png",
      on_site: "/icons/09-02-bomba-em-obra.png",
      maintenance: "/icons/09-03-bomba-manutencao.png",
    },
  },
  {
    id: "asset-cilindro",
    name: "Cilindro",
    code: "10.01",
    categoryId: "pecas",
    imageUrl: "/icons/10-01-cilindro-disponivel.png",
    statusImageUrls: {
      available: "/icons/10-01-cilindro-disponivel.png",
      on_site: "/icons/10-02-cilindro-em-obra.png",
      maintenance: "/icons/10-03-cilindro-manutencao.png",
    },
  },
  {
    id: "asset-relogio",
    name: "Relógio",
    code: "11.01",
    categoryId: "instrumentacao",
    imageUrl: "/icons/11-01-relogio-disponivel.png",
    statusImageUrls: {
      available: "/icons/11-01-relogio-disponivel.png",
      on_site: "/icons/11-02-relogio-em-obra.png",
      maintenance: "/icons/11-03-relogio-manutencao.png",
    },
  },
  {
    id: "asset-cavalete",
    name: "Cavalete",
    code: "12.01",
    categoryId: "apoio",
    imageUrl: "/icons/12-01-cavalete-disponivel.png",
    statusImageUrls: {
      available: "/icons/12-01-cavalete-disponivel.png",
      on_site: "/icons/12-02-cavalete-em-obra.png",
      maintenance: "/icons/12-03-cavalete-manutencao.png",
    },
  },
  {
    id: "asset-regua",
    name: "Régua",
    code: "13.01",
    categoryId: "instrumentacao",
    imageUrl: "/icons/13-01-regua-disponivel.png",
    statusImageUrls: {
      available: "/icons/13-01-regua-disponivel.png",
      on_site: "/icons/13-02-regua-em-obra.png",
      maintenance: "/icons/13-03-regua-manutencao.png",
    },
  },
  {
    id: "asset-sensor-aceleracao",
    name: "Sensor de Aceleração",
    code: "SNS-ACL",
    categoryId: "instrumentacao",
    imageUrl: "/icons/sensor-aceleracao.png",
  },
  {
    id: "asset-sensor-deformacao",
    name: "Sensor de Deformação",
    code: "SNS-DEF",
    categoryId: "instrumentacao",
    imageUrl: "/icons/sensor-deformacao.png",
  },
  {
    id: "asset-sensor-pit",
    name: "Sensor PIT",
    code: "SNS-PIT",
    categoryId: "instrumentacao",
    imageUrl: "/icons/sensor-pit.png",
  },
];


