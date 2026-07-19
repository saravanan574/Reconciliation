import OpenAI from "openai";

let client = null;
function getClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

const RESPONSE_SCHEMA = {
  name: "discrepancy_explanation",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      overall_assessment: {
        type: "string",
        description: "1-2 sentence plain-language summary of what is going on across these discrepancies.",
      },
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            order_ref: { type: "string" },
            likely_cause: {
              type: "string",
              description: "Plain-language explanation of what most likely happened, in 1-3 sentences.",
            },
            recommended_action: {
              type: "string",
              description: "A concrete next step someone on the revenue team should take.",
            },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
          },
          required: ["order_ref", "likely_cause", "recommended_action", "confidence"],
        },
      },
    },
    required: ["overall_assessment", "items"],
  },
};

/**
 * Temperature: 0.2. We want consistent, low-variance explanations of the same
 * underlying facts rather than creative variety - two calls on the same
 * discrepancy should read as the same analysis, not different opinions.
 */
export async function explainDiscrepancies(discrepancies) {
  const openai = getClient();
  if (!openai) {
    return {
      ok: false,
      error: "OPENAI_API_KEY is not configured on the server.",
      overall_assessment: null,
      items: [],
    };
  }

  const facts = discrepancies.map((d) => ({
    order_ref: d.orderRef,
    type: d.type,
    severity: d.severity,
    amount_at_risk: d.amountAtRisk,
    currency: d.currency,
    deterministic_summary: d.summary,
    details: d.details || {},
  }));

  const system = `You are a financial-operations assistant. You will be given a list of
payment/order discrepancies that were already detected and classified by a deterministic
reconciliation engine - the facts (type, amounts, cause category) are final and correct.
Your only job is to explain each one in plain language for a non-technical revenue
stakeholder and suggest a concrete next action. Do not dispute, second-guess, or change
the classification or amounts. Do not invent facts that are not in the provided data.
Respond only in the requested JSON structure.`;

  const user = `Here are the discrepancies to explain:\n${JSON.stringify(facts, null, 2)}`;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 1200,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_schema", json_schema: RESPONSE_SCHEMA },
    });

    const raw = completion.choices?.[0]?.message?.content;
    if (!raw) {
      return { ok: false, error: "The model returned an empty response.", overall_assessment: null, items: [] };
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        ok: false,
        error: "The model returned malformed JSON.",
        overall_assessment: null,
        items: [],
      };
    }

    if (!parsed || !Array.isArray(parsed.items)) {
      return {
        ok: false,
        error: "The model response did not match the expected shape.",
        overall_assessment: null,
        items: [],
      };
    }

    return { ok: true, error: null, ...parsed };
  } catch (err) {
    console.error("OpenAI call failed:", err.message);
    return {
      ok: false,
      error: "The explanation service is temporarily unavailable. Please try again.",
      overall_assessment: null,
      items: [],
    };
  }
}
