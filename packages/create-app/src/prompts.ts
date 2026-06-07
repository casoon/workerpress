/**
 * Minimale interaktive Prompts (M3-3) auf Basis von `node:readline` — keine
 * externe Abhängigkeit. Nicht-interaktiv (`--yes`) überspringt die Abfragen.
 */

import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

export async function text(message: string, fallback: string): Promise<string> {
  const answer = await ask(`${message} (${fallback}): `);
  return answer || fallback;
}

export async function confirm(message: string, fallback: boolean): Promise<boolean> {
  const answer = (await ask(`${message} [${fallback ? 'Y/n' : 'y/N'}]: `)).toLowerCase();
  if (!answer) return fallback;
  return answer === 'y' || answer === 'yes' || answer === 'j';
}

export async function select<T extends string>(
  message: string,
  options: { value: T; label: string }[],
  fallback: T,
): Promise<T> {
  const list = options.map((o, i) => `  ${i + 1}) ${o.label}`).join('\n');
  const answer = await ask(`${message}\n${list}\nWahl (${fallback}): `);
  if (!answer) return fallback;
  const byIndex = options[Number(answer) - 1];
  if (byIndex) return byIndex.value;
  const byValue = options.find((o) => o.value === answer);
  return byValue?.value ?? fallback;
}
