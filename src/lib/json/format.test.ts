import { describe, expect, it } from "vitest";
import { formatJson } from "./format";
import type { FormatOptions } from "./types";

const pretty: FormatOptions = {
  indent: "2",
  sortKeys: false,
  deepUnescape: false,
  style: "beautify",
};

function notes(input: string, options: Partial<FormatOptions> = {}) {
  const result = formatJson(input, { ...pretty, ...options });
  return result.ok ? result.notes.map((note) => note.code) : result.notes.map((note) => note.code);
}

describe("formatJson", () => {
  it("pretty-prints and minifies strict JSON without claiming a repair", () => {
    const input = '{"b":1,"a":[2,3]}';
    const beautified = formatJson(input, pretty);
    expect(beautified.ok).toBe(true);
    if (!beautified.ok) return;
    expect(beautified.strict).toBe(true);
    expect(beautified.output).toBe('{\n  "b": 1,\n  "a": [\n    2,\n    3\n  ]\n}');
    expect(beautified.notes).toEqual([]);

    const minified = formatJson(beautified.output, { ...pretty, style: "minify" });
    expect(minified.ok && minified.output).toBe('{"b":1,"a":[2,3]}');
    const again = formatJson(beautified.output, pretty);
    expect(again.ok && again.output).toBe(beautified.output);
  });

  it("uses 4 spaces or a tab when asked", () => {
    const four = formatJson('{"a":1}', { ...pretty, indent: "4" });
    expect(four.ok && four.output).toBe('{\n    "a": 1\n}');
    const tab = formatJson('{"a":1}', { ...pretty, indent: "tab" });
    expect(tab.ok && tab.output).toBe('{\n\t"a": 1\n}');
  });

  it("sorts keys recursively and says so", () => {
    const result = formatJson('{"b":{"d":1,"c":2},"a":1}', { ...pretty, sortKeys: true, style: "minify" });
    expect(result.ok && result.output).toBe('{"a":1,"b":{"c":2,"d":1}}');
    expect(notes('{"b":1,"a":2}', { sortKeys: true })).toContain("sort-keys");
    expect(notes('{"a":1,"b":2}', { sortKeys: true })).not.toContain("sort-keys");
  });

  it("unwraps stringified JSON, including a multiply-escaped body", () => {
    const once = JSON.stringify(JSON.stringify({ a: 1 }));
    const result = formatJson(once, pretty);
    expect(result.ok && result.output).toBe('{\n  "a": 1\n}');
    expect(notes(once)).toContain("unwrap");

    const body = JSON.stringify(JSON.stringify('{"a":1}').slice(1, -1)).slice(1, -1);
    const peeled = formatJson(body, pretty);
    expect(peeled.ok && JSON.parse(peeled.ok ? peeled.output : "")).toEqual({ a: 1 });
  });

  it("deep-unescapes only when the option is on, and offers it when off", () => {
    const input = JSON.stringify({ payload: JSON.stringify({ user: { id: 1 } }) });
    const on = formatJson(input, { ...pretty, deepUnescape: true, style: "minify" });
    expect(on.ok && JSON.parse(on.ok ? on.output : "")).toEqual({ payload: { user: { id: 1 } } });
    expect(notes(input, { deepUnescape: true })).toContain("deep-unescape");

    const off = formatJson(input, { ...pretty, deepUnescape: false, style: "minify" });
    expect(off.ok && JSON.parse(off.ok ? off.output : "").payload).toBe('{"user":{"id":1}}');
    expect(notes(input, { deepUnescape: false })).toContain("deep-available");
  });

  it("repairs a JSON5-style document and reports each fix", () => {
    const input = `{
      // user
      name: 'Ada',
      "roles": ["admin",],
      active: True,
    }`;
    const result = formatJson(input, { ...pretty, style: "minify" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.parse(result.output)).toEqual({ name: "Ada", roles: ["admin"], active: true });
    expect(result.strict).toBe(false);
    expect(result.originalIssue).toMatchObject({ line: 2, message: "Comments are not allowed in JSON." });
    expect(result.notes.map((note) => note.code)).toEqual(
      expect.arrayContaining(["comments", "single-quotes", "trailing-commas", "unquoted-keys", "literals"]),
    );
  });

  it("combines NDJSON into an array", () => {
    const input = '{"a":1}\n{"b":2}\n\n{"c":3,}\n';
    const result = formatJson(input, { ...pretty, style: "minify" });
    expect(result.ok && JSON.parse(result.ok ? result.output : "")).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);
    expect(notes(input)).toContain("ndjson");
  });

  it("removes a JSONP wrapper and a while(1); guard", () => {
    const input = 'while(1);callback({"ok":true,"n":1});';
    const result = formatJson(input, { ...pretty, style: "minify" });
    expect(result.ok && result.output).toBe('{"ok":true,"n":1}');
    expect(notes(input)).toEqual(expect.arrayContaining(["while-1", "jsonp"]));
  });

  it("removes dotted JSONP names and other API guards", () => {
    expect(formatJson('angular.callbacks._0({"ok":true});', { ...pretty, style: "minify" }).ok).toBe(true);
    const xssi = formatJson(")]}',\n{\"ok\":true}", { ...pretty, style: "minify" });
    expect(xssi.ok && xssi.output).toBe('{"ok":true}');
    expect(notes("for(;;);{\"ok\":true}")).toContain("for-ever");
  });

  it("keeps strings intact while repairing the surrounding document", () => {
    const input = '{"url":"http://example.com","note":"not a // comment",}';
    const result = formatJson(input, { ...pretty, style: "minify" });
    expect(result.ok && JSON.parse(result.ok ? result.output : "")).toEqual({
      url: "http://example.com",
      note: "not a // comment",
    });
  });

  it("returns a line and column when the document cannot be repaired", () => {
    const result = formatJson('{"a": ', pretty);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.line).toBe(1);
    expect(result.error.column).toBeGreaterThan(1);
    expect(result.error.hint.length).toBeGreaterThan(10);
    expect(result.errorText).toBe('{"a": ');
  });

  it("warns when a duplicate key or a long number is formatted", () => {
    expect(notes('{"a":1,"a":2}')).toContain("duplicate-key");
    const result = formatJson("1234567890123456", { ...pretty, style: "minify" });
    expect(result.ok).toBe(true);
    expect(notes("1234567890123456")).toContain("precision");
  });
});
