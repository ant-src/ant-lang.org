---
layout: page
title: Ant
sidebar: false
aside: false
---

<div class="home">

<header class="hero">

# Ant is a statically typed language with goroutines and errors as values.

</header>

<section class="feature">
<div class="text">

## Data flows left to right.

A pipe passes the value on its left as the first argument on its right. A block with `x` is a lambda.

</div>
<div class="shot">

```ant
var result = [5, 2, 8, 1]
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
  var text = try File.read(path)
  Json.parse(text)
}

var config = load("config.json")
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
  Time.sleep(Time.duration(milliseconds: 100), ctx)
  n * n
}

var squares = Parallel.map([1, 2, 3, 4], slowSquare, limit: 3)
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

var post = Post{ title: "Hello <world>", url: "/hello" }
println(<p>{link(post)}</p>)
```

```txt
<p><a href="/hello">Hello &lt;world&gt;</a></p>
```

</div>
</section>

<section class="feature">
<div class="text">

## Your editor already knows Ant.

The language server brings completion, hover, go to definition, rename, and diagnostics to VS Code, IntelliJ, and Neovim. The debugger sets breakpoints and shows values, and `ant fmt` formats on save.

</div>
<EditorShots />
</section>

</div>
