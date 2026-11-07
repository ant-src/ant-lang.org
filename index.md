---
layout: page
title: Ant
sidebar: false
aside: false
---

<div class="home">

<Feature hero>
<div class="text">

# Static types, goroutines, and nothing left undefined.

A small, strict language with Go's concurrency and errors as values.

<p class="actions"><a class="button" data-play href="/playground">Try it in the playground</a><a href="#install">Install</a></p>

</div>
<div class="shot">

```ant
type Account = { owner: string, balance: int }
type NotFound = { owner: string }
type Insufficient = { needed: int }
type Failure = NotFound | Insufficient

var accounts = Map{
  ada: Account{ owner: "Ada", balance: 100 },
  linus: Account{ owner: "Linus", balance: 20 },
}

func transfer(from: string, to: string, amount: int): Result[void, Failure] {
  var source = accounts[from] ?? return Result.err(NotFound{ owner: from })
  var target = accounts[to] ?? return Result.err(NotFound{ owner: to })
  if source.balance < amount {
    return Result.err(Insufficient{ needed: amount - source.balance })
  }
  source.balance -= amount
  target.balance += amount
  Result.ok(void)
}

var result = transfer("ada", "linus", 150)
if result is Err {
  var error = result.error
  if error is NotFound { println("no account ${error.owner}") }
  else { println("short by ${error.needed}") }
}

var report = Map.values(accounts)
  | Array.sortBy({ -x.balance })
  | Array.map({ "${x.owner}: ${x.balance}" })
  | String.join("\n")
println(report)
```

```txt
short by 50
Ada: 100
Linus: 20
```

</div>
</Feature>

<Feature>
<div class="text">

## Nothing is left undefined.

A value that can be missing has `null` in its type, and the checker makes every use handle it. `?.` stops at null, and `??` gives a fallback. Drop the fallback, and the program does not compile.

<a data-play href="/playground">Run it in the playground</a>

</div>
<div class="shot">

```ant
type Address = { city: string }
type User = { name: string, address: Address | null }

var users = Map{
  ada: User{ name: "Ada", address: Address{ city: "London" } },
  alan: User{ name: "Alan", address: null },
}

func city(id: string): string {
  users[id]?.address?.city ?? "unknown"
}

println(city("ada"))
println(city("alan"))
println(city("grace"))
```

```txt
London
unknown
unknown
```

</div>
</Feature>

<Feature>
<div class="text">

## Errors are values.

A function that can fail returns a `Result`. `try` hands an error up to the caller, and `?? return` does the same for a missing value. Nothing is thrown, so every way a call can fail is in its type.

<a data-play href="/playground">Run it in the playground</a>

</div>
<div class="shot">

```ant
type Order = { item: string, quantity: int }

func parseOrder(line: string): Result[Order, Error] {
  var parts = String.split(line, ":")
  if len(parts) != 2 {
    return Result.err(Error{ message: "expected item: quantity" })
  }
  var item = String.trim(parts[0])
  var quantity = String.toInt(String.trim(parts[1])) ??
    return Result.err(Error{ message: "bad quantity in ${line}" })
  Result.ok(Order{ item: item, quantity: quantity })
}

func total(lines: Array[string]): Result[int, Error] {
  var sum = 0
  for line in lines {
    var order = try parseOrder(line)
    sum += order.quantity
  }
  Result.ok(sum)
}

for lines in [["apples: 3", "pears: 5"], ["apples: 3", "pears: five"]] {
  var result = total(lines)
  if result is Ok { println("total: ${result.value}") }
  else { println("error: ${result.error.message}") }
}
```

```txt
total: 8
error: bad quantity in pears: five
```

</div>
</Feature>

<Feature>
<div class="text">

## Goroutines and channels.

`go` starts a goroutine. Channels carry values between them, and `select` waits for whichever is ready first. Any function can start a goroutine or block inside one: there are no async functions.

<a data-play href="/playground">Run it in the playground</a>

</div>
<div class="shot">

```ant
func isPrime(n: int): bool {
  if n < 2 { return false }
  for d in Iter.range(2, n) {
    if d * d > n { return true }
    if n % d == 0 { return false }
  }
  true
}

// Four goroutines each count the primes in a slice of the range.
var counts: Channel[int] = Channel.new()
for w in Iter.range(0, 4) {
  go {
    var count = 0
    for n in Iter.range(w * 5000, (w + 1) * 5000) {
      if isPrime(n) { count += 1 }
    }
    Channel.send(counts, count)
  }
}

var total = 0
for _ in Iter.range(0, 4) { total += Channel.receive(counts) ?? 0 }
println("primes below 20000: ${total}")

// Nobody sends on quiet, so the timer wins.
var quiet: Channel[string] = Channel.new()
select {
  var message = Channel.receive(quiet) { println(message) }
  Time.sleep(Time.duration(milliseconds: 100)) { println("timed out") }
}
```

```txt
primes below 20000: 2262
timed out
```

</div>
</Feature>

<Feature>
<div class="text">

## Unions narrow with is.

A union lists the records a value can be. Test it with `is`, and inside the branch the checker knows which record you hold, fields and all. The `else` branch knows the rest.

<a data-play href="/playground">Run it in the playground</a>

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

func describe(s: Shape): string {
  if s is Circle { "a circle of radius ${s.radius}" }
  else { "a ${s.width} by ${s.height} rectangle" }
}

var shapes: Array[Shape] = [
  Circle{ radius: 1.5 },
  Rect{ width: 2.0, height: 3.0 },
]

var largest = Array.sortBy(shapes, { -area(x) })[0]
println("the largest is ${describe(largest)}")
```

```txt
the largest is a circle of radius 1.5
```

</div>
</Feature>

<Feature>
<div class="text">

## Data flows left to right.

A pipe passes the value on its left as the first argument of the call on its right, through the standard library or your own functions. A block with `x` is a one-parameter lambda.

<a data-play href="/playground">Run it in the playground</a>

</div>
<div class="shot">

```ant
type Person = { name: string, age: int }

var people = [
  Person{ name: "Ada", age: 36 },
  Person{ name: "Linus", age: 28 },
  Person{ name: "Grace", age: 45 },
  Person{ name: "Alan", age: 41 },
]

var seniors = people
  | Array.filter({ x.age >= 40 })
  | Array.sortBy({ x.name })
  | Array.map({ "${x.name} (${x.age})" })

println(seniors)
```

```txt
["Alan (41)", "Grace (45)"]
```

</div>
</Feature>

<Feature>
<div class="text">

## Text and time, done right.

Strings count what a reader sees, not bytes or code units. Dates know calendars and time zones, so a month after August 31 is September 30, and a clock time that never happened says so.

<a data-play href="/playground">Run it in the playground</a>

</div>
<div class="shot">

```ant
var family = "👨‍👩‍👧"
println("${family} is ${len(String.graphemes(family))} character")
println(String.toUpper("straße"))

// A month after August 31 is September 30.
var date = Time.plainDate(2024, 8, 31)
println(Time.add(date, Time.duration(months: 1)))

// 2:30 does not exist that night in Stockholm.
var zone = Result.unwrap(Time.zone("Europe/Stockholm"))
var day = Time.plainDate(2026, 3, 29)
var clock = Time.plainTime(hour: 2, minute: 30)
println(Time.toZoned(Time.plainDateTime(day, clock), zone))
```

```txt
👨‍👩‍👧 is 1 character
STRASSE
2024-09-30
2026-03-29T03:30:00+02:00[Europe/Stockholm]
```

</div>
</Feature>

<Feature>
<div class="text">

## Tests that explain themselves.

`ant test` runs the test files beside your code. A failed `assert` shows the condition and the values it saw. The same binary formats, documents, and debugs your code, and runs a language server for VS Code, IntelliJ, and Neovim.

</div>
<div class="shot">

```ant
import "./stack.ant" { Stack, parse }

test "push then pop returns the value" {
  var s = Stack.new()
  Stack.push(s, 1)
  assert(Stack.pop(s) == 1)
}

type Case = { input: string, want: int }

test "parse" {
  var cases = [
    Case{ input: "1", want: 1 },
    Case{ input: "-7", want: -7 },
    Case{ input: "0x10", want: 16 },
  ]
  for c in cases {
    test "${c.input}" {
      assert(parse(c.input) == c.want)
    }
  }
}
```

```txt
--- FAIL: stack_test.ant: parse/0x10 (0.00s)
    assertion failed: parse(c.input) == c.want (0 == 16)
      c.input = "0x10"
      at test "0x10" (stack_test.ant:19:13)
FAIL  1 failed, 3 passed (0.00s)
```

</div>
</Feature>

<section class="install" id="install">

## Install Ant.

One binary, with nothing else to install. The script downloads the latest release for your OS and architecture. With Go installed, [go install](https://github.com/ant-src/ant#install) builds it from source instead.

<div class="shot">

```sh
curl -fsSL https://ant-lang.org/install.sh | sh
```

</div>

<p class="links"><a href="https://github.com/ant-src/spec">Read the specification</a><a href="https://github.com/ant-src/ant">Source on GitHub</a></p>

</section>

</div>
