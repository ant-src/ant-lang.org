---
title: Every error in one run
date: 2026-11-20
summary: ant check reports every error at once, ant code navigates from the shell, and ant test checks before it runs.
version: 0.3.0
---

Ant 0.3 is about the tools around the language.

## ant check

`ant check` takes files and directories and reports every error in one run. Each diagnostic ends
with its code, and many come with help and a fix:

```txt
main.ant:2:16: Array[string] has no field or function join [no-member]
   │
 2 │ let line = tags.join(", ")
   │            ^^^^^^^^^
   = help: join is String.join, which takes the array first; call it through its namespace
   = fix: String.join(tags, ...)
```

`ant check -explain no-member` tells more about a code. `-json` prints one object per diagnostic,
and `-strict` fails on warnings as well as errors. See [ant check](/docs/tools/check).

## ant code

[`ant code`](/docs/tools/code) answers from a terminal what an editor answers on hover: `def`,
`refs`, `type`, `symbols`, and `rename`. It runs the same analysis as the language server, which is
handy in scripts and for coding agents.

## ant test

`ant test` checks the test files before it runs them, lists tests with `-list`, and runs up to
`Os.cpus()` tests at once by default.

## Also new

- The language server follows imports across modules for references and rename, offers quick
  fixes, and fades unused names.
- `File.chown`, `File.sync`, `uid` and `gid` on `File.Info`, `Os.gid`, and `Os.cpus`.
- `ant doc` suggests names when a lookup finds nothing, long `assert` values are trimmed, and the
  REPL loads modules that import others.

## Breaking changes

- `ant test` runs no tests when the checker reports an error. `-nocheck` skips the check.
- Diagnostics end with their code: `path:line:col: message [code]`.

See the [full changelog](https://github.com/ant-src/ant/compare/v0.2.0...v0.3.0).
