// Places past this show as a Top % bucket instead of a rank.
const RANKED_PLACES = 100;
const TOP_PERCENT_BUCKETS = [5, 10, 20, 30, 40, 50];

export type Standing = { rank: number } | { topPercent: number } | null;

/** A rank within the ranked places, else the smallest Top % bucket the place fits; null past the last bucket or with an unknown total. */
export function standingFor(rank: number, total: number | undefined): Standing {
  if (rank <= RANKED_PLACES) return { rank };
  if (!total) return null;
  const bucket = TOP_PERCENT_BUCKETS.find(b => rank * 100 <= b * total);
  return bucket === undefined ? null : { topPercent: bucket };
}
