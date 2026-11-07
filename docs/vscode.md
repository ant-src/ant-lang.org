# Ant for VS Code

The extension brings highlighting, formatting, the language features of `ant lsp`, and debugging
through `ant dap` to Visual Studio Code. Every preview below is one short loop; click it to pause.

## Install

The extension does not bundle `ant`, so [install it](/docs/install) first. Then install
[Ant from the Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=ant-lang.ant-lang),
or download `ant.vsix` from a [release of ant-src/vscode-ant](https://github.com/ant-src/vscode-ant/releases)
and run **Extensions: Install from VSIX…** from the Command Palette. The extension finds `ant` on
`PATH` or in your Go bin directory; `ant.path` in the settings names another one.

## Code

### Completion

Names in scope, the fields of a record after `.`, and the functions a pipe can continue with after
`|`, each with its signature.

<Preview src="/ide/vscode/completion.mp4" label="Completion in VS Code" />

### Diagnostics

An error appears as you type, with its message on hover and in the Problems panel, and goes away
with the fix.

<Preview src="/ide/vscode/diagnostics.mp4" label="Diagnostics in VS Code" />

### Quick fixes

The code action adds a record field the checker found missing.

<Preview src="/ide/vscode/quick-fix.mp4" label="A quick fix in VS Code" />

### Hover

Signatures, types, and doc comments, for the standard library and your own code.

<Preview src="/ide/vscode/hover.mp4" label="Hover in VS Code" />

### Signature help

The signature of the call being typed, with the active parameter marked.

<Preview src="/ide/vscode/signature.mp4" label="Signature help in VS Code" />

### Inlay hints

Inferred `var` types and parameter names, shown inline.

<Preview src="/ide/vscode/inlay-hints.mp4" label="Inlay hints in VS Code" />

### Formatting

**Format Document** runs `ant fmt`.

<Preview src="/ide/vscode/formatting.mp4" label="Formatting in VS Code" />

## Navigation

### Go to definition

⌘-click a name to open its declaration, in an imported module too, and **Go Back** returns.

<Preview src="/ide/vscode/definition.mp4" label="Go to definition in VS Code" />

### References

The uses of a name are highlighted in the document, and **Peek References** lists them all.

<Preview src="/ide/vscode/references.mp4" label="References in VS Code" />

### Rename

F2 renames a variable and every use of it.

<Preview src="/ide/vscode/rename.mp4" label="Rename in VS Code" />

### Symbols

⌘T searches the workspace's symbols, and ⌘⇧O outlines the file.

<Preview src="/ide/vscode/symbols.mp4" label="Symbols in VS Code" />

## Run and debug

### Run

**Ant: Run File** runs the current file with `ant run`. A task of type `ant` in `tasks.json` does
the same, so it can be the default build task.

<Preview src="/ide/vscode/run.mp4" label="Run File in VS Code" />

### Tests

In a test file, **run test** and **debug test** code lenses stand above each test and each subtest
with a plain string name, and the output shows what failed.

<Preview src="/ide/vscode/tests.mp4" label="Tests in VS Code" />

### Debugging

Press F5 in an Ant file to debug it with no `launch.json`: breakpoints, stepping, every goroutine's
stack and variables, values on hover, and the debug console.

<Preview src="/ide/vscode/debugging.mp4" label="Debugging in VS Code" />

A launch configuration takes the program and, optionally, its arguments, working directory,
environment, a file for its standard input, and whether to stop on entry:

```json
{
  "type": "ant",
  "request": "launch",
  "name": "Debug main",
  "program": "${workspaceFolder}/main.ant",
  "args": ["-v"]
}
```
