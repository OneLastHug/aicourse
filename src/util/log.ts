/** Tiny leveled logger. Respects NO_COLOR / CI. */
const useColor = process.env.NO_COLOR == null && process.stdout.isTTY;

function paint(code: string, s: string): string {
  return useColor ? `\x1b[${code}m${s}\x1b[0m` : s;
}

const c = {
  dim: (s: string) => paint("2", s),
  gray: (s: string) => paint("90", s),
  cyan: (s: string) => paint("36", s),
  green: (s: string) => paint("32", s),
  yellow: (s: string) => paint("33", s),
  red: (s: string) => paint("31", s),
  magenta: (s: string) => paint("35", s),
  bold: (s: string) => paint("1", s),
};

export function ts(): string {
  return new Date().toISOString().slice(11, 19);
}

export const log = {
  info: (msg: string) => console.log(`${c.gray(ts())} ${c.cyan("INFO ")} ${msg}`),
  ok: (msg: string) => console.log(`${c.gray(ts())} ${c.green(" OK  ")} ${msg}`),
  warn: (msg: string) => console.log(`${c.gray(ts())} ${c.yellow("WARN ")} ${msg}`),
  error: (msg: string) => console.error(`${c.gray(ts())} ${c.red("ERROR")} ${msg}`),
  stage: (msg: string) => console.log(`\n${c.magenta(c.bold("● " + msg))}`),
  step: (msg: string) => console.log(`${c.gray(ts())} ${c.dim("·")} ${c.dim(msg)}`),
};
