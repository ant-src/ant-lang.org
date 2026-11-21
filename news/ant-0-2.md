---
title: Duration literals and mutable Bytes
date: 2026-11-14
summary: Durations get literals like 500ms and 1h30m, and Bytes becomes a buffer you can write into.
version: 0.2.0
---

Ant 0.2 brings two changes to everyday code.

## Duration literals

A duration is written as a number with its unit, and units combine:

```ant
let timeout = 1h30m
println(timeout)
Time.sleep(500ms)
```

```txt
PT1H30M
```

## Mutable Bytes

`Bytes` is now mutable and growable, and shared by reference as an array is. Helpers read and
write numbers in a chosen byte order:

```ant
let header = Bytes.new(4)
Bytes.write(header, type(uint16), 0, uint16(0x1234), Bytes.BigEndian{})
println(header)
```

```txt
Bytes(12 34 00 00)
```

The release also adds `Result.fail`, improves type inference, makes diagnostics clearer, and fixes
bugs in the runtime.

## Breaking changes

- `Bytes` shares mutations by reference. Use `Bytes.clone` for a copy.
- The `.body` of an HTTP request or response is replaced by `Http.text(r)`.
- `Cmd.Output` drops `stdoutBytes` and `stderrBytes`. Use `Cmd.captureBytes` for binary output.

See the [full changelog](https://github.com/ant-src/ant/compare/v0.1.0...v0.2.0).
