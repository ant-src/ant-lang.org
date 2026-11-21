// The examples are the directories under examples/: each holds main.ant, one program in one file.

export interface Example {
  id: string;
  title: string;
  code: string;
}

const titles: [id: string, title: string][] = [
  ["hello", "Hello, world"],
  ["pipes", "Pipes and lambdas"],
  ["shapes", "Unions"],
  ["errors", "Errors as values"],
  ["nulls", "Nothing undefined"],
  ["goroutines", "Goroutines and channels"],
  ["text-and-time", "Text and time"],
  ["calculator", "A calculator"],
];

const sources = import.meta.glob<string>("./examples/*/main.ant", { query: "?raw", import: "default", eager: true });

export const examples: Example[] = titles.map(([id, title]) => ({
  id,
  title,
  code: sources[`./examples/${id}/main.ant`],
}));
