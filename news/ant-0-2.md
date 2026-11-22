---
title: Duration literals and mutable Bytes
date: 2026-11-14
summary: Durations get literals like 500ms and 1h30m, and Bytes becomes a buffer you can write into.
version: 0.2.0
---

Ant 0.2 makes two kinds of everyday code shorter: waiting for a while, and working with binary
data.

## Duration literals

A `Time.Duration` was built with `Time.duration`. That is precise, but long for the spans a program
writes most, the timeouts, sleeps, and intervals:

```ant
Time.sleep(Time.duration(milliseconds: 500))
```

Now a duration is a number with its unit, and units combine, as in Go. A literal has the type
`Time.Duration` and the same value as the call it replaces:

```ant lead
Time.sleep(500ms)

let timeout = 1h30m
println(timeout)
println(Time.duration(milliseconds: 500) == 500ms)
```

```txt
PT1H30M
true
```

A literal is a constant span. A computed one, such as `Time.duration(seconds: n)`, is still a call,
so there is one way to write each.

## Mutable Bytes

`Bytes` was immutable. A program that computed bytes built an `Array[byte]` and converted it at the
end, and an array holds a whole value for every element. When I measured it, encoding 4 MB a byte
at a time peaked at about 250 MB of memory, and changing one byte of a megabyte copied all of it
twice.

So [`Bytes`](/docs/lib/Bytes/) is now mutable and growable, and shared by reference as an array is.
`b[i] = x` writes in place, `push` and `extend` grow it, and `Bytes.read`, `Bytes.write`, and
`Bytes.append` handle numbers in the byte order you name:

```ant
// A frame: a big-endian length, then the payload.
func frame(payload: Bytes): Bytes {
  let b = Bytes.new()
  b.append(type(uint32), uint32(len(payload)), Bytes.BigEndian{})
  b.extend(payload)
  b
}

println(frame(String.toBytes("hi")))
```

```txt
Bytes(00 00 00 02 68 69)
```

Building those 4 MB now peaks under 30 MB and takes about a quarter less time. The cost is the one
arrays already have: a function that changes `Bytes` changes it for everyone who holds it, so
`Bytes.clone` is there for a copy.

## Also new

- `Result.fail`.
- Better type inference and clearer diagnostics.
- Fixes in the runtime.

## Breaking changes

- `Bytes` shares changes by reference. Call `Bytes.clone` where a copy is meant.
- The `.body` of an HTTP request or response is gone. Call `Http.text(r)` for the text, or read
  `r.bytes`.
- `Cmd.Output` drops `stdoutBytes` and `stderrBytes`. Call `Cmd.captureBytes` for binary output.

See the [full changelog](https://github.com/ant-src/ant/compare/v0.1.0...v0.2.0).
