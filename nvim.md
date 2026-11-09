---
layout: page
title: Ant for Neovim
sidebar: false
aside: false
darkOnly: true
---

<div class="landing">

<header class="hero">

# The Ant plugin gives Neovim completion, diagnostics, navigation, formatting, and debugging with nvim-dap.

<p class="actions"><a class="button" href="https://github.com/ant-src/nvim-ant">Get it on GitHub</a></p>

</header>

<section class="feature">
<div class="text">

## Completion, with documentation.

Names in scope on CTRL-X CTRL-O, the fields of a record, and the functions a pipe can continue with, each with its documentation.

</div>
<div class="shot">
<Preview src="/ide/nvim/completion.mp4" />
</div>
</section>

<section class="feature">
<div class="text">

## Errors beside the line.

An error shows on leaving insert mode, as a sign and a message beside the line, and CTRL-W d opens it in full.

</div>
<div class="shot">
<Preview src="/ide/nvim/diagnostics.mp4" />
</div>
</section>

<section class="feature">
<div class="text">

## Fixes from the checker.

`gra` offers the server's fix for a missing field.

</div>
<div class="shot">
<Preview src="/ide/nvim/quick-fix.mp4" />
</div>
</section>

<section class="feature">
<div class="text">

## The declaration on K.

`K` shows the declaration and its doc comment, for the standard library and your own code.

</div>
<div class="shot">
<Preview src="/ide/nvim/hover.mp4" />
</div>
</section>

<section class="feature">
<div class="text">

## Signature help as you call.

CTRL-S shows the signature of the call being typed, with the current parameter marked.

</div>
<div class="shot">
<Preview src="/ide/nvim/signature.mp4" />
</div>
</section>

<section class="feature">
<div class="text">

## Inferred types, shown inline.

Once `vim.lsp.inlay_hint.enable(true)` turns them on, inlay hints show the type of every `var` and the name of every argument.

</div>
<div class="shot">
<Preview src="/ide/nvim/inlay-hints.mp4" />
</div>
</section>

<section class="feature">
<div class="text">

## Formatted by ant fmt.

`vim.lsp.buf.format()` runs `ant fmt`, and the `BufWritePre` autocommand from the README makes it format on save.

</div>
<div class="shot">
<Preview src="/ide/nvim/formatting.mp4" />
</div>
</section>

<section class="feature">
<div class="text">

## Indentation as ant fmt lays it out.

Indentation follows `ant fmt` as you type, and `gcc` comments a line with `//`.

</div>
<div class="shot">
<Preview src="/ide/nvim/editing.mp4" />
</div>
</section>

<section class="feature">
<div class="text">

## Go to definition, across files.

`CTRL-]` opens the declaration, in another file too, and `CTRL-O` goes back.

</div>
<div class="shot">
<Preview src="/ide/nvim/definition.mp4" />
</div>
</section>

<section class="feature">
<div class="text">

## Every reference, in the quickfix list.

`grr` lists the references of a name in the quickfix list.

</div>
<div class="shot">
<Preview src="/ide/nvim/references.mp4" />
</div>
</section>

<section class="feature">
<div class="text">

## Rename, everywhere.

`grn` renames a variable and every use of it.

</div>
<div class="shot">
<Preview src="/ide/nvim/rename.mp4" />
</div>
</section>

<section class="feature">
<div class="text">

## The symbols of a file.

`gO` lists the file's symbols in the location list.

</div>
<div class="shot">
<Preview src="/ide/nvim/symbols.mp4" />
</div>
</section>

<section class="feature">
<div class="text">

## Run in a terminal.

`:Ant run` runs the current file with `ant run` in a terminal, and `:make` runs `ant check` into the quickfix list.

</div>
<div class="shot">
<Preview src="/ide/nvim/run.mp4" />
</div>
</section>

<section class="feature">
<div class="text">

## Run one test from the code.

The code lens above a test runs it alone, and `:Ant test-nearest` runs the test the cursor is in.

</div>
<div class="shot">
<Preview src="/ide/nvim/tests.mp4" />
</div>
</section>

<section class="feature">
<div class="text">

## Debug with nvim-dap.

`:Ant debug` runs the current file under `ant dap`: breakpoints, stopping, values on hover, scopes, stepping, and the program's output.

</div>
<div class="shot">
<Preview src="/ide/nvim/debugging.mp4" />
</div>
</section>

<section class="closing">

<p class="actions"><a class="button" href="https://github.com/ant-src/nvim-ant">Get it on GitHub</a></p>

The plugin needs Neovim 0.11 or later, and nvim-dap for debugging. [Install](/docs/start/install) shows how to add it with lazy.nvim or as a package, and where `ant` comes from.

</section>

</div>
