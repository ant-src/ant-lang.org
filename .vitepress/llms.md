# Ant

> Ant is a typed language with errors as values, pipes for data, and goroutines. It is general-purpose, garbage-collected, and interpreted. One binary, `ant`, runs programs, checks types, formats code, runs tests, and prints docs, and the standard library is there in every file, with no import.

Ant first shipped in November 2026, so you may know little of it from training. It borrows from TypeScript and from Go, and code written from the habits of either does not pass `ant check`. Do not guess its syntax or its library. This page lists what habit gets wrong, `ant check` finds the rest, and `ant doc` shows a library function before you call it. Without `ant` at hand, read [Ant in one file](https://ant-lang.org/llms-small.txt) first: the tour of the language and the guide to idiomatic Ant (<!-- small -->).

The `ant` binary answers faster than these pages:

- `ant doc Array.map` prints the signature and doc comment of a library function, and `ant doc Array` lists a whole namespace. It documents the version that is installed.
- `ant check` type-checks the files and directories you name, or the current directory, and reports every error in one run, some with a `help:` line and a `fix:` line. `ant check -json` prints one JSON object per diagnostic, and `ant check -explain <code>` explains the code an error ends with.
- `ant run main.ant` runs a program without checking its types: a program with a type error still starts, and panics when it reaches the wrong value. Run `ant check` first, every time.
- `ant test` checks and runs the tests in the `_test.ant` files under the paths you name, or under the current directory.
- `ant fmt .` rewrites every file into the one layout Ant code has. `ant fmt --check .` lists the files it would change, and changes nothing.
- `ant code def`, `refs`, `type`, `symbols`, and `rename` find declarations, uses, and types from the shell, each with `-json`.

`ant version` prints `ant v` and a version number. Anything else means the `ant` on the `PATH` is Apache Ant, the Java build tool. Install Ant with `curl -fsSL https://ant-lang.org/install.sh | sh`, with `irm https://ant-lang.org/install.ps1 | iex` in PowerShell, or with `go install github.com/ant-src/ant/cmd/ant@latest`.

Where Ant is not what its looks suggest:

- A file of statements is a program, run from top to bottom. There is no `main`. `Os.args()` gives its arguments, and `Os.exit(n)` ends it with a status.
- `let` binds a name that keeps its value, and `var` one that can be assigned again. There is no `const`.
- Types are `int`, `float64`, `string`, and `bool`, with type arguments in square brackets: `Array[int]`, `Map[string, int]`, `Result[int, Error]`. There is no `number`, no `int[]`, and no `Array<int>`. A call takes no type arguments: annotate the binding, as in `let names: Array[string] = []`.
- A function gives the value of its last expression: `func add(a: int, b: int): int { a + b }`. `return` is for leaving early.
- A lambda is a bare block, and its one parameter is named `x`: `xs.map({ x * 2 })`. There is no `=>`. For two or more parameters, or inside another lambda, where the inner `x` hides the outer one, write `func(a: int, b: int): int { a + b }`.
- A library function takes its subject first, so `Array.map(xs, f)`, `xs.map(f)`, and `xs | Array.map(f)` are one call. `.` reaches only the namespace of the value's own type: `String.join` takes an array, so write `String.join(xs, ", ")` or `xs | String.join(", ")`, never `xs.join(", ")`.
- `|` is the pipe, and bitwise operations are functions of `Bits`. `|` binds looser than `==` and `??`, so a pipeline inside a larger expression takes parentheses: `(xs | Array.sum()) ?? 0`.
- Sizes are functions, not properties: `xs.length()` for an array or a string, `m.size()` for a map or a set, and `len(x)` for any of them. Never `xs.length`.
- A record literal names its type, `Point{ x: 1, y: 2 }`, and so does a map literal, `Map{ a: 1 }`. A bare `{ ... }` is a block or a lambda. There is no set literal: write `Set.of([1, 2, 3])`.
- There are no classes: `func Point.norm(p: Point): float64 { ... }` declares a function on a type, and `p.norm()` calls it.
- The names of the standard library are taken. A type or a function of yours cannot be called `Entry`, `Error`, `Record`, `Context`, `File`, `Path`, `Time`, `Set`, or any other name under Standard library below.
- Nothing converts on its own. A condition is a `bool`, an `int` meets a `float64` only through a conversion such as `float64(n)`, and `+` does not join a string and a number: write `"n = ${n}"`.
- Double quotes write a string, and `${...}` interpolates inside them. Backticks write a raw string, with no interpolation. Single quotes write nothing. `println` takes one value, so print several as one string: `println("${a} ${b}")`.
- `if` is an expression, so there is no `? :`: `let sign = if n < 0 { "-" } else { "+" }`. There is no `switch` and no `match`: chain `if s is Circle { ... } else if s is Rect { ... }`, and the checker narrows `s` in each branch.
- Loops are `for x in xs { ... }` and `while n > 0 { ... }`. Count with `for i in Iter.range(0, n) { ... }`. There is no three-part `for` and no `++`.
- `null` goes only where a type allows it, as in `string | null`. Check with `== null`, or use `??` and `?.`. A library function returns `null` where it has no answer to give: `"4x".toInt()`, `xs.find(f)`, `xs.first()`. A map read, `m[key]`, is `null` for a missing key. An array read, `xs[i]`, panics out of range, and `xs.get(i)` is `null` there.
- A function that can fail returns a `Result[T, E]`, and so does a library call that reaches a file, the network, or another process, such as `File.read(path)`. `Result.ok(value)` succeeds. `Result.fail("message")` fails with an `Error`, whose text is `e.message`, and `Result.err(e)` fails with an error of a type of your own. `try f()` gives the value, or returns the error from the enclosing function; at the top level of a script it prints the error and exits with status 1. `if r is Ok { r.value } else { r.error }` takes a result apart. There is no `throw` and no `catch`, and `panic` is for bugs.
- Any function can wait, so there is no `async` and no `await`. `go { ... }` starts a goroutine. `let ch: Channel[int] = Channel.new()` makes a channel, `ch.send(v)` sends, and `ch.receive()` gives the next value, or `null` once the channel is closed.
- `import "./geo.ant" { distance, Point }` imports from another file, which marks what it offers with `export`, as in `export func distance(a: Point, b: Point): float64`. A file with an `export` is a library, and has no statements at its top level. There are no packages to install: a program is its files and the standard library.
- Tests go in a file named like `geo_test.ant`: `test "adds" { assert(add(1, 2) == 3) }`.

A complete program and what it prints, from the first page of the docs:

<!-- program -->

Every page under https://ant-lang.org/docs/ is served as Markdown too, at its address with `.md` added, or with `index.md` added after a final `/`. The library reference has a page for each function, such as [Array.map](https://ant-lang.org/docs/lib/Array/map.md): `lib/<Namespace>/<function>.md`, with a namespace's types under `lib/<Namespace>/types/` and names that stand alone, such as `println`, under `lib/prelude/`. The language reference has a page for each keyword, operator, literal, and built-in type, such as [try](https://ant-lang.org/docs/language/keywords/try.md). The links to the docs below lead to Markdown.

[llms-full.txt](https://ant-lang.org/llms-full.txt) holds every page of the docs in one file (<!-- full -->). It is there for a tool that indexes the docs, and it is too large to read whole.
