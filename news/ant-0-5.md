---
title: Errors a program can tell apart
date: 2026-11-26
summary: Library errors carry a kind a program can test, Array.countBy counts elements by key, and the interpreter evaluates expressions and sorts faster.
version: 0.5.0
---

Ant 0.5 is about the errors of the standard library. Until now an `Error` had a message and nothing
else, so a program that had to react to one failure and not another could only read text written for
people. Now an error says what failed, in a form a program can test.

## Error kinds

The cases that come up in every script are few: read a config if it is there and use defaults if it
is not, create a file only if nothing is at the path, tell the user to run as root when the OS said
no. None of them had a test at the call. The message names the path and differs between platforms,
and `File.exists` before the read races with a writer. It is also false when `File.stat` fails for
any reason, so a config in a directory the user may not read looked like no config at all.

An `Error` now has a second field, `kind`. It is [`Error.NotExist`](/docs/lib/Error/types/NotExist),
[`Error.Exist`](/docs/lib/Error/types/Exist), or [`Error.Permission`](/docs/lib/Error/types/Permission)
when the library can say what failed, and `null` otherwise. A program tests it with `is`, and a
misspelled kind is a compile error. [`Error.wrap`](/docs/lib/Error/wrap) and `Result.wrapErr` keep
the kind, so it survives the context added in front of the message:

```ant
func load(path: string): string {
  let r = File.read(path) | Result.wrapErr("load config")
  if r is Ok { return r.value }
  if r.error.kind is Error.NotExist { return "defaults" }
  if r.error.kind is Error.Permission { return "denied: ${r.error.message}" }
  return "failed: ${r.error.message}"
}

println(load("app.json"))
println(load("locked/app.json"))
```

```txt
defaults
denied: load config: open locked/app.json: permission denied
```

The three kinds are Go's `fs.ErrNotExist`, `fs.ErrExist`, and `fs.ErrPermission`, set where Go's
`errors.Is` matches them. So Ant promises no more than Go does about which failure is which, and the
kinds mean the same on Linux, macOS, and Windows. A parse error, a refused connection, or a call that
its context ended has no kind.

A kind travels as far as the error does. Test it on the result of the call it is about: if `load`
also read files that the config includes, a missing include would be `Error.NotExist` too.

## Array.countBy

Counting the elements of an array by key took two steps,
`xs.groupBy(key).map({ x.value.length() })`, and built an array for every group only to take its
length. [`Array.countBy`](/docs/lib/Array/countBy) counts in one pass, with one counter per key:

```ant
let log = [
  "203.0.113.9 GET /admin 401",
  "192.0.2.77 GET /login 401",
  "203.0.113.9 GET /admin 401",
  "198.51.100.4 GET / 200",
  "203.0.113.9 POST /login 401",
]
let failures = log
  | Array.filter({ x.endsWith(" 401") })
  | Array.countBy({ x.fields()[0] })
println(failures)
```

```txt
Map{ "203.0.113.9": 3, "192.0.2.77": 1 }
```

Keys come in the order they are first seen, as they do in `Array.groupBy`.

## A faster interpreter

Ant stays a tree-walking interpreter, kept simple on purpose. Within that, I removed a few calls Go
did not inline from the path every expression takes. Each expression was two calls, a wrapper and
the evaluation, and is now one, and each arithmetic operator called its operation through a function
value. Against 0.4 on the benchmarks I keep, the programs take 5 to 15% less time: `nbody` 15%,
`fib` 13%, `trees` 12%, `mandelbrot` 11%.

`Array.sort` and `Array.sortBy` used Go's reflection-based sort and compared each pair twice. They
now use Go's generic sort with one comparison per pair, and the sort benchmark takes 37% less time.

## Also new

- A failed `assert` names every value inside a `${...}` interpolation of its condition.
- The checker no longer suggests a function whose type parameter bound the receiver does not fit.

## Breaking changes

- Every printed `Error` shows its kind, `kind: null` when it has none, and `Json.stringify` writes
  `"kind"` too. Update tests that compare printed errors; print `e.message` for the message alone.
- Spreading an `Error` into a type of your own with only `message` no longer checks, since the
  spread copies `kind`. Name the field instead: `Mine{ message: e.message }`.
- Two errors with the same message and different kinds are no longer `==`.

See the [full changelog](https://github.com/ant-src/ant/compare/v0.4.0...v0.5.0).
