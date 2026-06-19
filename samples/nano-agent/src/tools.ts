/** Built-in tools the agent can call. Each tool is just an async function. */
import { readFile, writeFile } from "node:fs/promises";

export const TOOLS = {
  read_file: { description: "Read a file from disk", run: ({ path }) => readFile(path, "utf8") },
  write_file: {
    description: "Write text to a file",
    run: ({ path, content }) => writeFile(path, content, "utf8").then(() => "ok"),
  },
};

export async function executeTool(name, input) {
  const tool = TOOLS[name];
  if (!tool) throw new Error(`unknown tool: ${name}`);
  return tool.run(input);
}
