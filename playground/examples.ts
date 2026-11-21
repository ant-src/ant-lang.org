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
  ["nulls", "Nothing undefined"],
  ["errors", "Errors as values"],
  ["interfaces", "Interfaces"],
  ["sequences", "Endless sequences"],
  ["goroutines", "Goroutines and channels"],
  ["html", "HTML expressions"],
  ["text-and-time", "Text and time"],
  ["life", "Game of Life"],
  ["calculator", "A calculator"],
];

const sources = import.meta.glob<string>("./examples/*/main.ant", { query: "?raw", import: "default", eager: true });

export const examples: Example[] = titles.map(([id, title]) => ({
  id,
  title,
  code: sources[`./examples/${id}/main.ant`],
}));
