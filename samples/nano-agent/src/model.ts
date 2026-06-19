/** Thin wrapper around the chat completions API. Returns { content: Block[] }. */
export async function callModel({ systemPrompt, messages }) {
  const res = await fetch("https://api.example.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ system: systemPrompt, messages, model: "nano-1" }),
  });
  return res.json();
}
