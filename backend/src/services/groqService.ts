// RAG-lite summary: retrieval is the SQL query in adminController (a user's
// real activity rows — transfers and top-ups), this file is purely the
// "generation" step. In between sits "augmentation" — formatting those rows
// plus the aggregate risk score into the prompt text below — before handing
// it to Groq. Uses Groq's OpenAI-compatible REST endpoint directly (no SDK
// dependency needed).
import { ActivityItem } from '../types';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

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

  const direction = item.sender_email === userEmail ? 'sent' : 'received';
  const flagInfo = item.fraud_flagged
    ? `FLAGGED (risk: ${riskLabel(item.risk_score)}/${item.risk_score} — ${item.fraud_reason})`
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

  const prompt =
    `You are assisting a fintech compliance reviewer. Summarize this user's activity — both ` +
    `money sent/received and wallet top-ups — in 3-4 sentences, in plain English. Only use ` +
    `the data given below — do not invent numbers or dates. This user has an overall risk ` +
    `rating of ${aggregateRisk}/100 (a rolling 30-day score combining every flagged transfer ` +
    `and top-up). Open with that rating and what's driving it, then prioritize which flags ` +
    `deserve attention first rather than listing them as equally important.\n\n` +
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
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      return 'AI summary unavailable — the Groq API returned an error.';
    }

    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content?.trim() || 'AI summary unavailable — empty response.';
  } catch {
    return 'AI summary unavailable — could not reach the Groq API.';
  }
};
