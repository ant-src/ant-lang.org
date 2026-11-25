---
title: Ant inside a Go program
date: 2026-11-25
summary: The Go module moves to ant-lang.org, the tools check a host's script with no host running, and File.readDir lists a directory with each entry's kind.
version: 0.4.0
---

Ant runs as a command, and it also runs inside a Go program that gives scripts functions of its own.
Before this release I ported a terminal file manager to Ant as such a host, and most of what this
release changes comes from what the port ran into.

## The module is ant-lang.org

The Go module of Ant was `github.com/ant-src/ant`. It is `ant-lang.org` now, the address of the
site. Install the command with Go, or run it without installing:

```sh
go install ant-lang.org/cmd/ant@latest
go run ant-lang.org/cmd/ant@v0.4.0 version
```

```txt
ant v0.4.0
```

A host imports `"ant-lang.org"`, and the package is still named `ant`. Versions up to 0.3.3 stay at
the old path, which cannot install anything newer.

## Declaration files beside a script

A host describes its namespace in a declaration file, a `.d.ant` file of types and function
signatures with no bodies. Nothing tied the script to that file, so `ant check` and the editor
reported every use of the namespace as unknown:

```txt
main.ant:1:9: App is not defined [undefined]
   │
 1 │ println(App.greet("Ada"))
   │         ^^^

1 error
```

Only the host binary could check the script, and it gave an editor no hover, completion, or
diagnostics.

Now a declaration file in the directory of a script is part of that program, for every tool. With
this `app.d.ant` beside it:

```ant [app.d.ant]
// App.greet returns a greeting for name.
func App.greet(name: string): string
```

`ant check main.ant` passes, and a wrong call is a type error, as it is for the standard library:

```txt
main.ant:1:19: cannot use int where string is expected [type-mismatch]
   │
 1 │ println(App.greet(42))
   │                   ^^
```

The language server completes `App` and jumps to its declarations, and `ant code` answers questions
about it. Running the script with the plain `ant` command, where no host provides `App`, is a load
error that names the file:

```txt
main.ant:1:9: App is declared in app.d.ant, which does not implement it: the program runs only in a host that provides App [undefined]
```

The [embedding guide](/docs/guide/embedding) is new, and walks through a host from its declaration
file to the Go code that runs the script.

## Records the host builds

A host function that returns a record of a type its namespace declares needs that type's tag. Tags
compare by identity, so a tag the host made itself, with the right name and fields, still failed
`is`, and the script took the wrong branch with no error at the call. The port worked around it by
passing one sample record of each type to the host.

`Runtime.Tag` and `Program.Tag` now return the tag of a declared type by its name, such as
`"App.Event"`. `value.NewInstant`, `value.NewDuration`, `value.GoTime`, and `value.GoDuration`
convert `Time.Instant` and `Time.Duration` to and from Go's types.

## File.readDir

Telling the directories in a listing from the files took one `File.stat` per entry.
[`File.readDir`](/docs/lib/File/) returns each entry with its kind, which comes with the listing:

```ant
for entry in File.readDir(".").unwrap() {
  let kind = if entry.isDir { "dir" } else if entry.isSymlink { "link" } else { "file" }
  println("${kind}\t${entry.name}")
}
```

```txt
file	README.md
dir	docs
link	link
file	list.ant
dir	src
```

A symbolic link is reported as the link. `File.stat` of its path tells what it points to.

## Also new

- Install on Windows with `irm https://ant-lang.org/install.ps1 | iex`.
- WebAssembly: `ant.wasm` runs the debugger as `debugAdapter` and tests as `test`, and output
  written in small pieces shows on time.
- The language server completes the `Result` functions after a `Result`.
- `ant test` prints a program that fails to load as `ant run` does.
- The pages for programmers coming from other languages are rewritten as short articles.

## Breaking changes

- The Go module is `ant-lang.org`. Install with `go install ant-lang.org/cmd/ant@latest`, and import
  `"ant-lang.org"` and `"ant-lang.org/value"` in a host.
- `Json.parse` is `Err` for an object that repeats a name, and for an escaped surrogate outside a
  pair, as Go's `encoding/json/v2` is. It used to keep the last value of a repeated name.

See the [full changelog](https://github.com/ant-src/ant/compare/v0.3.0...v0.4.0).
