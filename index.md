---
layout: page
title: Ant
sidebar: false
aside: false
darkOnly: true
---

<div class="landing">

<header class="hero">

<img class="logo" src="/logo.svg" alt="" width="176" height="176">

# Ant is a typed language with errors as values, pipes for data, and goroutines.

</header>

<section class="feature">
<div class="text">

## Data flows left to right.

A pipe passes the value on its left as the first argument on its right. A block with `x` is a lambda.

</div>
<div class="shot">

```ant
let result = [5, 2, 8, 1]
  | Array.filter({ x > 2 })
  | Array.map({ x * 10 })
  | Array.sort()
println(result)
```

```txt
[50, 80]
```

</div>
</section>

<section class="feature">
<div class="text">

## Errors are values.

A function that can fail returns a `Result`. `try` hands an error up to the caller. Nothing is thrown.

</div>
<div class="shot">

```ant
func load(path: string): Result[Json.Value, Error] {
  let text = try File.read(path)
  Json.parse(text)
}

let config = load("config.json")
if config is Err { println(config.error.message) }
```

```txt
open config.json: no such file or directory
```

</div>
</section>

<section class="feature">
<div class="text">

## Fan out on goroutines.

Goroutines are cheap, and any function can start one. `Parallel.map` runs a function over a list on goroutines, at most `limit` at once, and returns when all of them are done.

</div>
<div class="shot">

```ant
func slowSquare(n: int, ctx: Context): int {
  Time.sleep(100ms, ctx)
  n * n
}

let squares = Parallel.map([1, 2, 3, 4], slowSquare, limit: 3)
println(squares)
```

```txt
[1, 4, 9, 16]
```

</div>
</section>

<section class="feature">
<div class="text">

## HTML is an expression.

Markup is a value of type `Html`, checked like any other expression. Text interpolated into it is escaped, so a page is safe by default.

</div>
<div class="shot">

```ant
type Post = { title: string, url: string }

func link(post: Post): Html {
  <a href={post.url}>{post.title}</a>
}

let post = Post{ title: "Hello <world>", url: "/hello" }
println(<p>{link(post)}</p>)
```

```txt
<p><a href="/hello">Hello &lt;world&gt;</a></p>
```

</div>
</section>

<AntTrail />

</div>

<Underground>

<header class="opening">

## The tools come with the language.

One binary checks, formats, tests, and documents Ant, and teaches your editor all of it.

</header>

<div class="chambers">

<div class="solo left" style="--width: 600px">
<div class="chamber">

<p class="tool">ant check</p>

### Type checker

Every program is checked before it runs. An error points at the exact characters and suggests a fix.

<div class="shot">

```term
$ ant check greet.ant
greet.ant:4:17: User has no field nam [no-member]
   │
 4 │   "Hello, ${user.nam}"
   │             ^^^^^^^^
   = help: did you mean name?

1 error
```

</div>
</div>
</div>

<div class="solo right" style="--width: 840px">
<div class="chamber">

<p class="tool">ant check</p>

### Warnings

Code that runs but looks like a slip gets a warning with a name, and `ant check -explain` tells you why it matters.

<div class="shot">

```term
$ ant check total.ant
total.ant:2:7: warning: tax is declared with let but never used [unused-variable]
   │
 2 │   let tax = 20
   │       ^^^
   = help: remove it, or bind _ to keep what its initializer does

1 warning
```

</div>
</div>
</div>

<div class="pair">
<div class="chamber">

<p class="tool">ant fmt</p>

### Formatter

One style, with no options. Every editor formats on save.

<div class="shot">
<div class="before">

```ant
func  area(w:int,h :int):int{
w*h }
```

</div>

```ant
func area(w: int, h: int): int {
  w * h
}
```

</div>
</div>
<div class="chamber">

<p class="tool">ant test</p>

### Tests

Tests sit beside the code they test. A failed assert prints both sides.

<div class="shot">

```term
$ ant test
--- FAIL: area_test.ant: area of a strip (0.00s)
    assertion failed: area(1, 4) == 5 (4 == 5)
      at test "area of a strip" (area_test.ant:10:9)
FAIL  1 failed, 1 passed (0.00s)
```

</div>
</div>
</div>

<div class="solo middle" style="--width: 800px">
<div class="chamber">

<p class="tool">ant lsp · ant dap</p>

### Your editor already knows Ant.

The language server brings completion, hover, go to definition, rename, and diagnostics to VS Code, IntelliJ, and Neovim. The debugger sets breakpoints and shows values.

<EditorShots />

</div>
</div>

<div class="pair">
<div class="chamber">

<p class="tool">ant code</p>

### Code queries

What the checker knows, on the command line: types, definitions, and references, for scripts and agents.

<div class="shot">

```term
$ ant code type geo.ant:7:5
let origin: Point
$ ant code def geo.ant:8:9
geo.ant:3:6: func norm(p: Point): int
$ ant code refs geo.ant:3:6
geo.ant:8:9: println(norm(origin))
1 reference in 1 file
```

</div>
</div>
<div class="chamber">

<p class="tool">ant</p>

### REPL

Run `ant` on its own to try an idea, with highlighting, completion, and history.

<div class="shot">

```term
$ ant
> let a = [3, 1, 2] | Array.sort()
> a
[1, 2, 3]
> "total: ${Array.sum(a)}"
total: 6
```

</div>
</div>
</div>

<div class="solo middle" style="--width: 880px">
<div class="chamber">

<p class="tool">ant doc</p>

### Documentation

Docs for any name, in the terminal, from the standard library or your own code.

<div class="shot">

```term
$ ant doc String.split
func String.split(s: string, sep: string): Array[string]

    String.split returns the pieces of s between each occurrence of sep. It panics if sep is empty.

        String.split("a,b,,c", ",")   // ["a", "b", "", "c"]
        String.split("", ",")         // [""]
```

</div>
</div>
</div>

</div>

</Underground>
