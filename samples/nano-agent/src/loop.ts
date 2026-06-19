/**
 * The agent loop: keep calling the model until it stops asking for tools.
 * This is the beating heart of a Claude-Code-like agent.
 */
import { callModel } from "./model.js";
import { executeTool } from "./tools.js";

export async function run({ messages, systemPrompt }) {
  while (true) {
    const response = await callModel({ systemPrompt, messages });
    messages.push({ role: "assistant", content: response.content });

    const toolUses = response.content.filter((b) => b.type === "tool_use");
    if (toolUses.length === 0) {
      return response.content; // model is done — print the final answer
    }

    for (const use of toolUses) {
      const result = await executeTool(use.name, use.input);
      messages.push({ role: "tool", tool_use_id: use.id, content: String(result) });
    }
  }
}
