---
layout: home

hero:
  name: Ant
  text: Static types, goroutines, and nothing left undefined.
  tagline: A small, strict language with Go's concurrency and errors as values.
  image:
    src: /logo.png
    alt: Ant
  actions:
    - theme: brand
      text: Try it in the playground
      link: /playground
    - theme: alt
      text: Read the specification
      link: https://github.com/ant-src/spec
    - theme: alt
      text: GitHub
      link: https://github.com/ant-src/ant

features:
  - icon: 🧭
    title: Types that are checked
    details: Records, unions narrowed with is, generics, and inference. A program that checks has no undefined and no surprise null.
  - icon: 🧵
    title: Goroutines and channels
    details: go starts a goroutine, channels carry values between them, and select waits for whichever is ready first.
  - icon: 🧯
    title: Errors are values
    details: A function that can fail returns a Result. try passes the error up, and the checker makes you look at it.
  - icon: 🔗
    title: Pipes
    details: Data flows left to right through Array.filter, Array.map and your own functions, with short lambdas.
  - icon: 🌐
    title: Text and time done right
    details: Strings count what a reader sees, and dates know calendars and time zones.
  - icon: 🛠️
    title: Tools included
    details: A formatter, a language server for VS Code and IntelliJ, a debugger, and a REPL.
---

## Install

```sh
curl -fsSL https://ant-lang.org/install.sh | sh
```

The script downloads the latest release's `ant` for your OS and architecture into `/usr/local/bin`.
`ANT_VERSION=vX.Y.Z` installs that release, and `ANT_INSTALL_DIR` picks another directory. With Go
installed, `go install github.com/ant-src/ant/cmd/ant@latest` builds it instead.
