// The examples are the directories under examples/: each holds main.ant, any modules it
// imports, and optionally stdin.txt, the program's input.

export interface Example {
  id: string;
  title: string;
  files: Record<string, string>;
  stdin: string;
}

const titles: [id: string, title: string][] = [
  ["hello", "Hello, world"],
  ["pipes", "Pipes and lambdas"],
  ["shapes", "Unions and modules"],
  ["errors", "Errors as values"],
  ["nulls", "Nothing undefined"],
  ["goroutines", "Goroutines and channels"],
  ["text-and-time", "Text and time"],
  ["calculator", "A calculator"],
];

const sources = import.meta.glob<string>("./examples/*/*.{ant,txt}", { query: "?raw", import: "default", eager: true });

export const examples: Example[] = titles.map(([id, title]) => {
  const files: Record<string, string> = {};
  let stdin = "";
  for (const [path, text] of Object.entries(sources)) {
    const [, dir, name] = path.match(/^\.\/examples\/([^/]+)\/(.+)$/)!;
    if (dir !== id) continue;
    if (name === "stdin.txt") stdin = text;
    else files[name] = text;
  }
  return { id, title, files, stdin };
});

export const defaultExample = examples[0];
