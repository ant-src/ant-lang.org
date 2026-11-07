---
layout: page
title: Ant
sidebar: false
aside: false
---

<div class="home">

<header class="feature hero">
<div class="text">

# Ant is a statically typed language with JavaScript-like syntax, goroutines, and errors as values.

</div>
<div class="shot">

```ant
type Account = { owner: string, balance: int }
type Insufficient = { needed: int }

func withdraw(account: Account, amount: int): Result[void, Insufficient] {
  if account.balance < amount {
    return Result.err(Insufficient{ needed: amount - account.balance })
  }
  account.balance -= amount
  Result.ok(void)
}

var ada = Account{ owner: "Ada", balance: 100 }
var result = withdraw(ada, 150)
if result is Err { println("short by ${result.error.needed}") }
```

```txt
short by 50
```

</div>
</header>

<section class="feature">
<div class="text">

## Nothing is left undefined.

A value that can be missing has `null` in its type. `?.` stops at null, `??` gives a fallback, and the checker refuses a null nobody handled.

</div>
<div class="shot">

```ant
type Address = { city: string }
type User = { name: string, address: Address | null }

func city(user: User): string {
  user.address?.city ?? "unknown"
}

println(city(User{ name: "Alan", address: null }))
```

```txt
unknown
```

</div>
</section>

<section class="feature">
<div class="text">

## Errors are values.

A function that can fail returns a `Result`. `try` hands the error up to the caller, and nothing is thrown.

</div>
<div class="shot">

```ant
type Invalid = { text: string }

func parse(text: string): Result[int, Invalid] {
  var n = String.toInt(text) ??
    return Result.err(Invalid{ text: text })
  Result.ok(n)
}

func total(lines: Array[string]): Result[int, Invalid] {
  var sum = 0
  for line in lines { sum += try parse(line) }
  Result.ok(sum)
}
```

</div>
</section>

<section class="feature">
<div class="text">

## Goroutines and channels.

`go` starts a goroutine. Channels carry values between them, and `select` waits for whichever is ready first.

</div>
<div class="shot">

```ant
var replies: Channel[string] = Channel.new()
go {
  Time.sleep(Time.duration(seconds: 2))
  Channel.send(replies, "hello")
}

select {
  var reply = Channel.receive(replies) { println(reply) }
  Time.sleep(Time.duration(seconds: 1)) { println("no reply") }
}
```

```txt
no reply
```

</div>
</section>

<section class="feature">
<div class="text">

## Unions narrow with is.

A union lists the records a value can be. Test it with `is`, and inside the branch the checker knows which record you hold.

</div>
<div class="shot">

```ant
type Circle = { radius: float64 }
type Rect = { width: float64, height: float64 }
type Shape = Circle | Rect

func area(s: Shape): float64 {
  if s is Circle { 3.14159 * s.radius * s.radius }
  else { s.width * s.height }
}

println(area(Circle{ radius: 1.0 }))
println(area(Rect{ width: 2.0, height: 3.0 }))
```

```txt
3.14159
6.0
```

</div>
</section>

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

## Text and time, done right.

Strings count what a reader sees. Dates know calendars, so a month after August 31 is September 30.

</div>
<div class="shot">

```ant
println(len(String.graphemes("👨‍👩‍👧")))
println(String.toUpper("straße"))

var date = Time.plainDate(2024, 8, 31)
println(Time.add(date, Time.duration(months: 1)))
```

```txt
1
STRASSE
2024-09-30
```

</div>
</section>

<section class="feature">
<div class="text">

## Tests that explain themselves.

A failed `assert` shows the condition and the values it saw. The same binary formats, documents, and debugs your code.

</div>
<div class="shot">

```ant
import "./parse.ant" { parse }

type Case = { input: string, want: int }

test "parse" {
  var cases = [
    Case{ input: "1", want: 1 },
    Case{ input: "0x10", want: 16 },
  ]
  for c in cases {
    test "${c.input}" { assert(parse(c.input) == c.want) }
  }
}
```

```txt
--- FAIL: parse_test.ant: parse/0x10 (0.00s)
    assertion failed: parse(c.input) == c.want (0 == 16)
      c.input = "0x10"
      at test "0x10" (parse_test.ant:11:31)
FAIL  1 failed, 1 passed (0.00s)
```

</div>
</section>

</div>
