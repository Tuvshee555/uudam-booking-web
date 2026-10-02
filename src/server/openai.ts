/**
 * The site's one AI provider (OpenAI — the same account the chatbot uses).
 * Gemini was dropped on 2026-10-02 after its prepaid credits ran out.
 *
 * JSON mode only: every caller here wants structured output, and a prompt
 * that mentions "JSON" plus response_format guarantees parseable text.
 */
export async function openaiJson(
  prompt: string,
  { model = process.env.OPENAI_MODEL || "gpt-4o-mini", timeoutMs = 30000 }: { model?: string; timeoutMs?: number } = {},
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned no content");
  return content;
}
