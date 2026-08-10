/**
 * Calls the Google Gemini API to summarize a batch of open-text survey
 * answers into themes, sentiment breakdown, and a few representative
 * quotes. Uses Gemini's free tier instead of a paid API.
 *
 * Returns null (instead of throwing) if the API key is missing or the
 * request fails, so the analytics route can degrade gracefully instead
 * of crashing the whole dashboard.
 */
async function callLLMForInsights(texts) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.warn("GEMINI_API_KEY not set - skipping AI insights");
    return null;
  }

  if (!texts || texts.length === 0) {
    return null;
  }

  const prompt = `You are analyzing open-text survey responses. Here are the raw answers, one per line:

${texts.map((t, i) => `${i + 1}. ${t}`).join("\n")}

Respond with ONLY valid JSON (no markdown fences, no preamble) in this exact shape:
{
  "themes": ["theme 1", "theme 2", "theme 3"],
  "sentiment": { "positive": 0, "neutral": 0, "negative": 0 },
  "quotes": ["short representative quote 1", "short representative quote 2"]
}

The sentiment values should be percentages that add up to 100. Keep themes short (2-4 words each). Keep quotes under 20 words each, drawn from the actual answers.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 500 }
        })
      }
    );

    if (!response.ok) {
      console.error("Gemini API error:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textOutput) return null;

    const cleaned = textOutput.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return parsed;
  } catch (err) {
    console.error("callLLMForInsights failed:", err.message);
    return null;
  }
}

module.exports = callLLMForInsights;