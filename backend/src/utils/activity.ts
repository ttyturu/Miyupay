// Shared helper for merging transactions + top-ups into one chronological (or
// risk-sorted) activity feed — used by the regular Transactions endpoint, the
// admin user lookup, and the admin flagged list, since all three now show
// both types of activity in a single list rather than transfers only.
export const sortActivity = <T extends { created_at: Date | string; risk_score?: number }>(
  items: T[],
  sortBy: 'recent' | 'risk' = 'recent'
): T[] => {
  return [...items].sort((a, b) => {
    if (sortBy === 'risk') {
      const diff = (b.risk_score ?? 0) - (a.risk_score ?? 0);
      if (diff !== 0) return diff;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
};
