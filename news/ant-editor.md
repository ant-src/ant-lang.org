---
title: Meet the Ant Editor
date: 2026-11-21
summary: Edit, run, test, and debug Ant programs in the browser, with nothing installed.
---

The [Ant Editor](https://editor.ant-lang.org) is an editor for Ant that runs in a browser tab. Open
it and start writing: there is nothing to install and no account to make.

It is built on the same pieces as the command line. The checker, the language server, the test
runner, and the debugger all run in WebAssembly, in a worker, so completion, hover, rename, and
errors work as they do in VS Code, IntelliJ, and Neovim.

## Projects

Work starts in a project that the browser keeps for the page. The project menu makes new projects,
renames them, and switches between them. Any browser can download a project as a .zip. In Chrome
and Edge on a desktop, _Save to folder_ moves it to a folder on disk, _Open folder_ opens one that
exists, and the folders opened lately are on the menu to open again with a click.

In the file tree, a right click makes, renames, and deletes files, and a drag moves them.

## Run and test

Run starts a program in WebAssembly, and Stop ends it. The checker's errors and warnings are listed
under _Problems_ as you type.

Run on a test file, one whose name ends in `_test.ant`, runs its tests and reports them as
`ant test -v` does. _run test_ and _debug test_ above each test run that one alone.

## Debug

Click the gutter to set a breakpoint. A paused program shows its line, its call stack, and its
variables, and F10, F11, and ⇧F11 step over, into, and out. A test that fails pauses at the
assertion.

## Try it

Open [editor.ant-lang.org](https://editor.ant-lang.org). For a quick experiment with one file, the
[playground](/playground) is still the fastest way in.

The editor is open source at [ant-src/editor](https://github.com/ant-src/editor), and built on
[@ant-lang/wasm](https://www.npmjs.com/package/@ant-lang/wasm) and
[@ant-lang/monaco](https://www.npmjs.com/package/@ant-lang/monaco), which can put Ant in your own
pages too.
