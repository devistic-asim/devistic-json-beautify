export interface Sample {
  id: string;
  label: string;
  title: string;
  text: string;
}

export const JSON_SAMPLES: Sample[] = [
  {
    id: "stringified",
    label: "Stringified",
    title: "JSON that was stringified twice, the way some APIs embed a payload",
    text: JSON.stringify(JSON.stringify({ user: { id: 7, name: "Ada" }, ok: true })),
  },
  {
    id: "nested",
    label: "Nested strings",
    title: "A valid document with stringified JSON inside a value. Turn on Deep unescape.",
    text: JSON.stringify(
      {
        meta: { source: "api" },
        payload: JSON.stringify({ items: [{ id: 1, sku: "A-1" }, { id: 2, sku: "B-2" }] }),
      },
      null,
      2,
    ),
  },
  {
    id: "json5",
    label: "JSON5-style",
    title: "Comments, single quotes, unquoted keys, a trailing comma, and a Python literal",
    text: `{
  // hand-edited config
  name: 'Ada Lovelace',
  "url": "http://example.com/docs",
  "roles": ["admin", "editor",],
  active: True,
  note: "keep // this"
}`,
  },
  {
    id: "ndjson",
    label: "NDJSON",
    title: "One JSON value per line. Beautify combines the records into an array.",
    text: `{"ts":"2026-11-23T10:00:00Z","level":"info","msg":"started"}
{"ts":"2026-11-23T10:00:02Z","level":"error","msg":"retry","code":503}
{"ts":"2026-11-23T10:00:03Z","level":"info","msg":"recovered"}
`,
  },
  {
    id: "jsonp",
    label: "JSONP guard",
    title: "A while(1); guard plus a JSONP callback, common on older web responses",
    text: `while(1);callback({
  "ok": true,
  "count": 2
});`,
  },
];

export const TEXT_SAMPLE = `  HELLO   world.

this is a   Second line.\t


already-mixed_Case
`;
