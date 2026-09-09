export type Action = "BUY" | "HOLD" | "WATCH" | "SELL" | "EXIT";

export type Holding = {
  ticker: string;
  name: string;
  value: number;
  pnl: number;
  action: Action;
  actionAmount: number;
  thesis: string;
};

export const portfolio: Holding[] = [
  { ticker:"NVDA", name:"NVIDIA", value:3387.53, pnl:0, action:"HOLD", actionAmount:0, thesis:"AI compute leader; maintain core exposure." },
  { ticker:"SKHY", name:"SK Hynix", value:2426.58, pnl:0, action:"HOLD", actionAmount:0, thesis:"HBM demand remains a major AI-memory tailwind." },
  { ticker:"POWL", name:"Powell Industries", value:1827.55, pnl:0, action:"HOLD", actionAmount:0, thesis:"Data-center power infrastructure exposure." },
  { ticker:"APH", name:"Amphenol", value:1654.40, pnl:0, action:"SELL", actionAmount:550, thesis:"Excellent business, but trim to fund higher-conviction opportunities." },
  { ticker:"SPCX", name:"SpaceX", value:1573.66, pnl:0, action:"HOLD", actionAmount:0, thesis:"High-growth strategic holding; position already meaningful." },
  { ticker:"HUBB", name:"Hubbell", value:1553.23, pnl:0, action:"SELL", actionAmount:550, thesis:"Quality power exposure, but capital can be concentrated elsewhere." },
  { ticker:"GOOG", name:"Alphabet", value:1302.79, pnl:0, action:"SELL", actionAmount:600, thesis:"Trim broad mega-cap exposure for the current aggressive mission." },
  { ticker:"POET", name:"POET Technologies", value:845.50, pnl:0, action:"BUY", actionAmount:400, thesis:"Asymmetric optical-interconnect opportunity; high execution risk." },
  { ticker:"SMCI", name:"Super Micro Computer", value:811.80, pnl:0, action:"HOLD", actionAmount:0, thesis:"AI-server exposure remains interesting, but financing and cash-flow risk argue for patience." },
  { ticker:"SNDK", name:"SanDisk", value:722.75, pnl:0, action:"HOLD", actionAmount:0, thesis:"Strong AI-storage/memory exposure after a major rally; do not chase." },
  { ticker:"VERA", name:"Vera Therapeutics", value:353.00, pnl:0, action:"WATCH", actionAmount:0, thesis:"Commercial launch creates upside, but cash burn and execution risk remain." },
];

export const START_VALUE = 16468.79;
export const TARGET_VALUE = 30000;
export const TOTAL_PNL = 1171.56;
export const actionBudget = portfolio.reduce((sum, h) => sum + h.actionAmount, 0);
