# Ant for IntelliJ IDEA

The plugin brings highlighting, run configurations, tests with `ant test`, debugging through
`ant dap`, and the language features of `ant lsp` through the IDE's own LSP client to IntelliJ IDEA.
It needs IntelliJ IDEA 2025.3 or later. Every preview below is one short loop; click it to pause.

## Install

The plugin does not bundle `ant`, so [install it](/docs/install) first. Build the plugin from
[ant-src/intellij-ant](https://github.com/ant-src/intellij-ant) with `./gradlew buildPlugin`, which
leaves a zip under `build/distributions`, and install it with **Settings | Plugins | ⚙ | Install
Plugin from Disk…**. The plugin finds `ant` on `PATH` or in your Go bin directory;
**Settings | Languages & Frameworks | Ant** names another one.

## Code

### Completion

Names in scope, the fields of a record after `.`, and the functions a pipe can continue with after
`|`, each with its signature and documentation.

<Preview src="/ide/intellij/completion.mp4" label="Completion in IntelliJ IDEA" />

### Diagnostics

An error appears as you type: the wave, the mark in the scrollbar, the inspection widget, and the
message in a tooltip.

<Preview src="/ide/intellij/diagnostics.mp4" label="Diagnostics in IntelliJ IDEA" />

### Quick fixes

The server's fix, from the tooltip or from ⌥⏎.

<Preview src="/ide/intellij/quick-fix.mp4" label="A quick fix in IntelliJ IDEA" />

### Documentation

The declaration and its doc comment on hover.

<Preview src="/ide/intellij/documentation.mp4" label="Documentation on hover in IntelliJ IDEA" />

### Parameter info

The signature of the call being typed, with the current parameter in bold.

<Preview src="/ide/intellij/parameter-info.mp4" label="Parameter info in IntelliJ IDEA" />

### Formatting

**Reformat Code** (⌥⌘L) runs `ant fmt`.

<Preview src="/ide/intellij/formatting.mp4" label="Formatting in IntelliJ IDEA" />

### Editing

Brackets and quotes close themselves, Enter between braces indents, and ⌘/ comments a line.

<Preview src="/ide/intellij/editing.mp4" label="Editing in IntelliJ IDEA" />

## Navigation

### Go to declaration

⌘-hover shows the link, and ⌘-click opens the declaration, in another file too.

<Preview src="/ide/intellij/navigation.mp4" label="Go to declaration in IntelliJ IDEA" />

### Usages

⌘-click on a declaration lists its usages.

<Preview src="/ide/intellij/usages.mp4" label="Usages in IntelliJ IDEA" />

### Rename

⇧F6 renames a name inline, with every use of it.

<Preview src="/ide/intellij/rename.mp4" label="Rename in IntelliJ IDEA" />

### File structure

⌘F12 shows the file's symbols, filtered as you type.

<Preview src="/ide/intellij/structure.mp4" label="File structure in IntelliJ IDEA" />

## Run and debug

### Run

The run icon in the gutter runs `ant run` with the file in the Run tool window. Only a script, a
file with a statement at its top level, has the icon.

<Preview src="/ide/intellij/run.mp4" label="Run in IntelliJ IDEA" />

### Tests

In a test file, the gutter shows a run icon on each test, and on each row of a table. Run there
runs that test alone into the test tree, and the icon remembers how it last went.

<Preview src="/ide/intellij/tests.mp4" label="Tests in IntelliJ IDEA" />

### Debugging

Debug a run configuration to run it under `ant dap`: breakpoints with conditions and logged
expressions, frames and variables, values on hover, stepping, and the console. **Ant Panics** in the
Breakpoints dialog stops at a panic nothing catches.

<Preview src="/ide/intellij/debugging.mp4" label="Debugging in IntelliJ IDEA" />
