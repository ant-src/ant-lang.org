# ant-lang.org

The website of the [Ant](https://github.com/ant-src/ant) language, built with
[VitePress](https://vitepress.dev). Its playground edits and runs Ant in the browser with
[@ant-lang/monaco](https://github.com/ant-src/ant-web/tree/master/packages/monaco) and
[@ant-lang/wasm](https://github.com/ant-src/ant-web/tree/master/packages/wasm).

```sh
npm install
npm run dev         # http://localhost:5173
npm run build       # .vitepress/dist
npm run typecheck   # vue-tsc
npm run fmt         # oxfmt
npm run lint        # oxlint
```

The documentation under `/docs` is written and tested in [ant-src/ant](https://github.com/ant-src/ant/tree/master/docs),
not here. Every build copies it into `docs/` (ignored by git) from `../ant/docs`, or from the
directory `ANT_DOCS` names; `.vitepress/docs.ts` leaves out unwritten pages and builds the
sidebar. CI builds with ant's master.

Local search indexes only `docs/lib/` and `docs/language/` by default, including their subdirectories.
To include any other page, add a comment near the top of its Markdown source, after its status comment if present:

```html
<!-- search: true -->
```

Use `<!-- search: false -->` to exclude a page, even within those two directories. For documentation pages,
edit the source in `ant/docs/`; the copied `docs/` directory is replaced on every build.

The playground's examples live in `playground/examples/`, one directory each: `main.ant`, the
modules it imports, and `stdin.txt` for its input. Add one to the list in
`playground/examples.ts`.

Pushes to master deploy to GitHub Pages.
