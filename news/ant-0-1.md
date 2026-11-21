---
title: Introducing Ant
date: 2026-11-08
summary: The first release of Ant, a typed language with errors as values, pipes for data, and goroutines.
version: 0.1.0
---

Ant 0.1 is the first release of Ant, a statically typed language with errors as values, pipes for
data, and goroutines. A file of statements runs from top to bottom, so a script needs no `main`.
This post shows the three ideas the rest of the language is built around.

## Errors are values

A missing file and an index out of range are different kinds of failure. The first is expected, and
the program can do something about it. The second is a bug, and only a change to the code fixes it.
Exceptions put both through one mechanism, so I gave each its own.

A function that can fail returns a `Result`, and `try` hands an error up to the caller. Nothing is
thrown:

```ant
func load(path: string): Result[Json.Value, Error] {
  let text = try File.read(path)
  Json.parse(text)
}

let config = load("config.json")
if config is Err { println(config.error.message) }
```

```txt
open config.json: no such file or directory
```

A bug panics instead, and ends the program with a trace. The design note
[Why no exceptions](/docs/design/errors-are-values) goes through the split and what it costs.

## Data flows left to right

A pipe passes the value on its left as the first argument on its right, and a block with `x` is a
lambda. A chain of steps reads in the order it runs:

```ant
let result = [5, 2, 8, 1]
  | Array.filter({ x > 2 })
  | Array.map({ x * 10 })
  | Array.sort()
println(result)
```

```txt
[50, 80]
```

## Goroutines, not async

In a language with `async`, a function that waits is marked, its callers must `await` it, and the
mark spreads up to `main`. In Ant, any function can wait: a call that waits blocks only its own
goroutine, and any function can start one. `Parallel.map` runs a function over a
list on goroutines, at most `limit` at once:

```ant
func slowSquare(n: int, ctx: Context): int {
  Time.sleep(Time.duration(milliseconds: 100), ctx)
  n * n
}

let squares = Parallel.map([1, 2, 3, 4], slowSquare, limit: 3)
println(squares)
```

```txt
[1, 4, 9, 16]
```

[Why goroutines and not async](/docs/design/no-async) explains the choice.

## Get started

Install `ant` with one line:

```sh
curl -fsSL https://ant-lang.org/install.sh | sh
```

Then take the [tour](/docs/tour/01-hello), or try Ant in the [playground](/playground) without
installing anything.
