# Ant for Neovim

The plugin brings highlighting, indentation as `ant fmt` lays code out, the language features of
`ant lsp`, and debugging through `ant dap` with nvim-dap to Neovim 0.11 or later. Every preview
below is one short loop, recorded from a real Neovim; click it to pause.

## Install

The plugin does not bundle `ant`, so [install it](/docs/install) first. With
[lazy.nvim](https://github.com/folke/lazy.nvim):

```lua
{ "ant-src/nvim-ant" }
```

With Neovim's packages:

```sh
git clone https://github.com/ant-src/nvim-ant ~/.local/share/nvim/site/pack/ant/start/nvim-ant
```

The plugin needs no `setup()`. The language server starts for every `.ant` file, and
`:checkhealth ant` says what it found. The usual mappings reach its features: `K` for hover,
`CTRL-]` for definition, `grn` to rename, `grr` for references, `gra` for code actions, and
`vim.lsp.buf.format()` to format.

## Code

### Completion

Names in scope on CTRL-X CTRL-O, the fields of a record and the functions a pipe can continue with
after `.`, each with its documentation.

<Preview src="/ide/nvim/completion.mp4" label="Completion in Neovim" />

### Diagnostics

An error shows on leaving insert mode, as a sign and a message beside the line, and CTRL-W d opens
it in full.

<Preview src="/ide/nvim/diagnostics.mp4" label="Diagnostics in Neovim" />

### Quick fixes

`gra` offers the server's fix for a missing field.

<Preview src="/ide/nvim/quick-fix.mp4" label="A quick fix in Neovim" />

### Hover

`K` shows the declaration and its doc comment.

<Preview src="/ide/nvim/hover.mp4" label="Hover in Neovim" />

### Signature help

CTRL-S shows the signature of the call being typed, with the current parameter marked.

<Preview src="/ide/nvim/signature.mp4" label="Signature help in Neovim" />

### Inlay hints

Inferred types and parameter names, shown inline.

<Preview src="/ide/nvim/inlay-hints.mp4" label="Inlay hints in Neovim" />

### Formatting

`vim.lsp.buf.format()` runs `ant fmt`; an autocommand on `BufWritePre` formats on save.

<Preview src="/ide/nvim/formatting.mp4" label="Formatting in Neovim" />

### Editing

Indentation follows `ant fmt` as you type, and `gcc` comments a line with `//`.

<Preview src="/ide/nvim/editing.mp4" label="Editing in Neovim" />

## Navigation

### Go to definition

`CTRL-]` opens the declaration, in another file too, and `CTRL-O` goes back.

<Preview src="/ide/nvim/definition.mp4" label="Go to definition in Neovim" />

### References

`grr` lists the references in the quickfix list.

<Preview src="/ide/nvim/references.mp4" label="References in Neovim" />

### Rename

`grn` renames a variable everywhere.

<Preview src="/ide/nvim/rename.mp4" label="Rename in Neovim" />

### Symbols

`gO` lists the file's symbols in the location list.

<Preview src="/ide/nvim/symbols.mp4" label="Symbols in Neovim" />

## Run and debug

### Run

`:Ant run` runs the current file with `ant run` in a terminal, and `:make` runs `ant check` into
the quickfix list.

<Preview src="/ide/nvim/run.mp4" label="Run in Neovim" />

### Tests

The code lens above a test runs it alone, and `:Ant test-nearest` runs the test the cursor is in.

<Preview src="/ide/nvim/tests.mp4" label="Tests in Neovim" />

### Debugging

With nvim-dap installed, `:Ant debug` debugs the current file under `ant dap`: breakpoints,
stopping, values on hover, scopes, stepping, and the program's output.

<Preview src="/ide/nvim/debugging.mp4" label="Debugging in Neovim" />
