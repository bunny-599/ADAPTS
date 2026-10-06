export interface QuickRevisionPoint {
  text: string;
  concept?: string;
  sourceUrl?: string;
  sourceTitle?: string;
}

export interface QuickRevisionResult {
  topic: string;
  points: QuickRevisionPoint[];
  groundedSourceCount: number;
}
