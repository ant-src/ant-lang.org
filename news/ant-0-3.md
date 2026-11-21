---
title: Every error in one run
date: 2026-11-20
summary: ant check reports every error in a project at once, ant code navigates from the shell, and ant test checks before it runs.
version: 0.3.0
---

Ant 0.3 changes the tools, not the language. Before this release I had coding agents write five
programs in Ant and report what got in their way. Most of what they found was about the tools around
the language, and most of this release answers it.

## ant check

`ant check` took one file. Checking a project meant one run per program, and `ant test` ran test
files without checking them at all.

Now [`ant check`](/docs/tools/check) takes files and directories, with the current directory as the
default, and reports every error in one run. Each diagnostic ends with a code, and many come with
help and a fix:

```txt
main.ant:2:16: Array[string] has no field or function join [no-member]
   │
 2 │ let line = tags.join(", ")
   │            ^^^^^^^^^
   = help: join is String.join, which takes the array first; call it through its namespace
   = fix: String.join(tags, ...)
```

`ant check -explain no-member` tells more about a code. `-json` prints one object per diagnostic,
fixes included, for tools to read. The checker also warns now, about a `Result` nobody looks at or an
import nobody uses. A warning does not fail the check unless you pass `-strict`.

## ant code

An editor answers where a name is declared, where it is used, and what type it has. Someone working
in a terminal, a coding agent most of all, had no way to ask.

[`ant code`](/docs/tools/code) asks from the command line. It runs the same analysis as the language
server, on the files as they are on disk:

```sh
ant code refs Money.add
```

```txt
main.ant:4:19: let total = price.add(Money{ cents: 100 })
1 reference in 1 file
```

`def`, `type`, and `symbols` answer the other questions, and `rename` renames a declaration and every
use of it, across modules. `rename -diff` shows the change first.

## ant test

`ant test` now checks the test files before it runs them, so a test file with a type error reports
it as `ant check` does, before any test runs. `-list` prints the tests without running
them, and `-parallel` defaults to the number of CPUs.

## Also new

- The language server follows imports across modules for references and rename, offers quick fixes,
  and fades unused names.
- `File.chown`, `File.sync`, `uid` and `gid` on `File.Info`, `Os.gid`, and `Os.cpus`.
- `ant doc` suggests names when a lookup finds nothing.
- Long values in a failed `assert` are trimmed.
- The REPL loads modules that import others.

## Breaking changes

- `ant test` runs no tests when the checker reports an error. Pass `-nocheck` to skip the check.
- Diagnostics end with their code, `path:line:col: message [code]`. Update anything that parses
  them, or read `ant check -json` instead.

See the [full changelog](https://github.com/ant-src/ant/compare/v0.2.0...v0.3.0).
