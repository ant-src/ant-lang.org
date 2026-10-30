# ant-lang.org

The website of the [Ant](https://github.com/ant-src/ant) language, built with
[VitePress](https://vitepress.dev). Its playground edits and runs Ant in the browser with
[@ant-lang/monaco](https://github.com/ant-src/ant-web/tree/master/packages/monaco) and
[@ant-lang/wasm](https://github.com/ant-src/ant-web/tree/master/packages/wasm).

The packages come from a checkout of [ant-web](https://github.com/ant-src/ant-web) next to this
repository, built first:

```sh
(cd ../ant-web && npm install && npm run build)
npm install
npm run dev         # http://localhost:5173
npm run build       # .vitepress/dist
npm run typecheck   # vue-tsc
npm run fmt         # oxfmt
npm run lint        # oxlint
```

The playground's examples live in `playground/examples/`, one directory each: `main.ant`, the
modules it imports, and `stdin.txt` for its input. Add one to the list in
`playground/examples.ts`.

Pushes to master deploy to GitHub Pages.
