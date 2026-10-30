// A shared playground travels in the URL's fragment: its files and input as JSON, compressed
// with deflate and written in base64url, so the server never sees the code.

export interface Snapshot {
  files: Record<string, string>;
  stdin: string;
}

export async function encode(snapshot: Snapshot): Promise<string> {
  const stream = new Blob([JSON.stringify(snapshot)]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function decode(text: string): Promise<Snapshot | null> {
  try {
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    const snapshot = JSON.parse(await new Response(stream).text());
    if (typeof snapshot?.files !== "object" || snapshot.files === null) return null;
    const files: Record<string, string> = {};
    for (const [path, src] of Object.entries(snapshot.files)) {
      if (typeof src === "string" && validPath(path)) files[path] = src;
    }
    if (!files["main.ant"]) return null;
    return { files, stdin: typeof snapshot.stdin === "string" ? snapshot.stdin : "" };
  } catch {
    return null;
  }
}

/** validPath reports whether name can be a module of the playground: a .ant file name, with folders. */
export function validPath(name: string): boolean {
  return /^([A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.ant$/.test(name);
}
