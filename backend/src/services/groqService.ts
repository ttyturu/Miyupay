// RAG-lite summary: retrieval is the SQL query in adminController (a user's
// real activity rows — transfers and top-ups), this file is purely the
// "generation" step. In between sits "augmentation" — formatting those rows
// plus the aggregate risk score into the prompt text below — before handing
// it to Groq. Uses Groq's OpenAI-compatible REST endpoint directly (no SDK
// dependency needed).
import { ActivityItem } from '../types';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

const riskLabel = (score: number): string => {
  if (score >= 50) return 'high';
  if (score > 0) return 'medium';
  return 'none';
};

const describeActivity = (item: ActivityItem, userEmail: string): string => {
  if (item.type === 'topup') {
    const flagInfo = item.fraud_flagged
      ? `FLAGGED (risk: ${riskLabel(item.risk_score)}/${item.risk_score} — ${item.fraud_reason})`
      : 'clean';
    return `${new Date(item.created_at).toISOString()} | topup ${item.amount} ${item.currency} (${item.status}) | ${flagInfo}`;
  }

  const isSender = item.sender_email === userEmail;
  const direction = isSender ? 'sent' : 'received';

  // A flag describes the SENDER's behaviour, so a flag on a transfer this user
  // merely received is the counterparty's problem and is excluded from their
  // rating (see getAggregateRisk). Saying so inline stops the model treating a
  // received flag as evidence against this user.
  const flagInfo = item.fraud_flagged
    ? `FLAGGED (risk: ${riskLabel(item.risk_score)}/${item.risk_score} — ${item.fraud_reason})` +
      (isSender ? '' : ' [counterparty conduct — excluded from this user\'s rating]')
    : 'clean';

  return (
    `${new Date(item.created_at).toISOString()} | ${direction} ${item.sender_amount} ${item.sender_currency} | ` +
    `${flagInfo}${item.is_cross_border ? ' | cross-border' : ''}`
  );
};

export const summarizeUserActivity = async (
  userName: string,
  userEmail: string,
  activity: ActivityItem[],
  aggregateRisk: number
): Promise<string> => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return 'AI summary unavailable — GROQ_API_KEY is not configured.';
  }

  const dataAsText = activity.map(item => describeActivity(item, userEmail)).join('\n');

  // The rating deliberately covers only what this user DID — transfers they
  // sent and their own top-ups. Describing it as covering "every flag" made a
  // 0/100 rating look self-contradictory next to flagged receipts, and the
  // model resolved the contradiction by inventing a scoring threshold that
  // doesn't exist. State the real scope, and tell it what to do when nothing
  // is driving the score, so it reports the absence instead of confabulating.
  const ratingGuidance = aggregateRisk === 0
    ? `Their rating is 0/100: nothing they did in the window was flagged. Open by ` +
      `saying so plainly. Do NOT invent reasons for the zero, and do not imply ` +
      `flags were weighed and dismissed. If flagged transfers appear below, they ` +
      `were sent BY SOMEONE ELSE to this user — mention them only as context ` +
      `about who is paying them, never as findings against this user.`
    : `Open with that rating and what's driving it, then prioritize which flags ` +
      `deserve attention first rather than listing them as equally important.`;

  const prompt =
    `You are assisting a fintech compliance reviewer. Summarize this user's activity — both ` +
    `money sent/received and wallet top-ups — in 3-4 sentences, in plain English. Only use ` +
    `the data given below — do not invent numbers, dates, thresholds, or scoring rules. ` +
    `This user has an overall risk rating of ${aggregateRisk}/100: a rolling 30-day score ` +
    `covering only transfers this user SENT plus their own top-ups. Flags on transfers they ` +
    `RECEIVED reflect the sender's conduct and are excluded by design. ${ratingGuidance}\n\n` +
    `User: ${userName}\n\nActivity:\n${dataAsText}`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        // gpt-oss is a reasoning model: hidden reasoning tokens are drawn from
        // the SAME max_tokens budget as the visible answer. Left uncapped on a
        // prompt it finds ambiguous, it can spend the entire budget thinking
        // and return empty content with finish_reason='length'. 'low' keeps
        // reasoning to a few tokens, and the larger budget leaves room for the
        // summary even when it does deliberate.
        reasoning_effort: 'low',
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      return 'AI summary unavailable — the Groq API returned an error.';
    }

    const data = await response.json() as {
      choices?: { finish_reason?: string; message?: { content?: string } }[];
    };
    const choice = data.choices?.[0];
    const content = choice?.message?.content?.trim();
    if (content) return content;

    // Empty content with finish_reason='length' means the token budget ran out
    // before the model produced an answer — distinguish it so this is
    // debuggable from the admin panel rather than looking like an API outage.
    return choice?.finish_reason === 'length'
      ? 'AI summary unavailable — the model ran out of tokens before answering.'
      : 'AI summary unavailable — empty response.';
  } catch {
    return 'AI summary unavailable — could not reach the Groq API.';
  }
};
