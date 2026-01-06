export type Category =
  | 'asset_discovery'
  | 'asset_analysis'
  | 'trend_discovery'
  | 'trend_analysis'
  | 'onchain_fundamentals';

export type Sector =
  | 'defi'
  | 'ecosystems'
  | 'ai'
  | 'memecoins'
  | 'prediction_markets'
  | 'consumer'
  | 'stablecoins';

export type Tag =
  | 'large_cap'
  | 'middle_market'
  | 'small_cap';

export interface EvalQuestion {
  qid: string;
  query: string;
  level: number;
  categories: Category[];
  tags: Tag[] | null;
  sectors: Sector[] | null;
}
