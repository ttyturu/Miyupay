import { db } from '../utils/db';

// Separate, much smaller rule set from fraudService.ts — this watches the
// funding side (money entering via Stripe), not the sending side. A rapid
// burst of top-up attempts is the classic "card testing" signature (many
// small charges to find a still-valid stolen card), so this only flags for
// admin visibility — it never blocks the top-up, since Stripe's own checkout
// already gates whether a charge actually succeeds, and a legitimate user
// retrying a declined card looks identical for the first couple of attempts.
const VELOCITY_THRESHOLD = 3; // attempts, including this one
const VELOCITY_WINDOW = '10 minutes';
const VELOCITY_WEIGHT = 35;

export interface TopupFraudResult {
  flagged: boolean;
  reason: string | null;
  riskScore: number;
}

export const runTopupFraudChecks = async (userId: string): Promise<TopupFraudResult> => {
  const { rows } = await db.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM topups
     WHERE user_id = $1 AND created_at > NOW() - INTERVAL '${VELOCITY_WINDOW}'`,
    [userId]
  );
  const attemptsIncludingThis = parseInt(rows[0].count) + 1;
  const triggered = attemptsIncludingThis >= VELOCITY_THRESHOLD;

  return {
    flagged: triggered,
    reason: triggered ? `${attemptsIncludingThis} top-up attempts in the last 10 minutes` : null,
    riskScore: triggered ? VELOCITY_WEIGHT : 0,
  };
};
