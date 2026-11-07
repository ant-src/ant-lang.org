# Install

```sh
curl -fsSL https://ant-lang.org/install.sh | sh
```

The script downloads the latest release's `ant` for your OS and architecture into `/usr/local/bin`,
or `~/bin` in Git Bash on Windows. `ANT_VERSION=vX.Y.Z` installs that release, and `ANT_INSTALL_DIR`
picks another directory.

With Go installed, `go install` builds it from source instead:

```sh
go install github.com/ant-src/ant/cmd/ant@latest
```

## Run a program

`ant check` type-checks a file with its imports, and `ant run` runs it:

```sh
ant check main.ant
ant run main.ant
```

Without a file, `ant` opens the REPL. `ant fmt` formats sources, `ant test` runs the test files
beside them, and `ant doc` prints the documentation of a name:

```sh
ant fmt .
ant test .
ant doc Array.map
```

## Editors

The language server and the debugger come with the binary, and a plugin brings them to the editor.
Each plugin finds `ant` on `PATH` or in your Go bin directory.

### VS Code

Install [Ant from the Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=ant-lang.ant-lang),
or download `ant.vsix` from a [release](https://github.com/ant-src/vscode-ant/releases) and run
**Extensions: Install from VSIX…** from the Command Palette. `ant.path` in the settings names
another `ant`. [What the extension does](/vscode).

### IntelliJ IDEA

Install [Ant from the JetBrains Marketplace](https://plugins.jetbrains.com/plugin/35684-ant-language),
or search for Ant under **Settings | Plugins | Marketplace**. It needs IntelliJ IDEA 2025.3 or
later. **Settings | Languages & Frameworks | Ant** names another `ant`.
[What the plugin does](/intellij).

### Neovim

With [lazy.nvim](https://github.com/folke/lazy.nvim):

```lua
{ "ant-src/nvim-ant" }
```

With Neovim's packages:

```sh
git clone https://github.com/ant-src/nvim-ant ~/.local/share/nvim/site/pack/ant/start/nvim-ant
```

It needs Neovim 0.11 or later, and [nvim-dap](https://github.com/mfussenegger/nvim-dap) for
debugging. The plugin needs no `setup()`, and `:checkhealth ant` says what it found.
`vim.g.ant = { path = "..." }` names another `ant`. [What the plugin does](/nvim).
