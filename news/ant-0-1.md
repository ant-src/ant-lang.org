---
title: Introducing Ant
date: 2026-11-08
summary: The first release of Ant, a typed language with errors as values, pipes for data, and goroutines.
version: 0.1.0
---

Ant 0.1 is the first release. Ant is a statically typed language that runs scripts as readily as
programs: a file of statements runs from top to bottom, with no `main` to write.

Data flows left to right. A pipe passes the value on its left as the first argument on its right,
and a block with `x` is a lambda:

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

A function that can fail returns a `Result`, and `try` hands an error up to the caller. Nothing is
thrown. Goroutines are cheap, and any function can start one.

## Get started

Install `ant` with one line:

```sh
curl -fsSL https://ant-lang.org/install.sh | sh
```

Then take the [tour](/docs/tour/01-hello), or try Ant without installing anything in the
[playground](/playground).
