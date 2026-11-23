import { describe, expect, it } from "vitest";
import { errorSnippet, positionAt } from "./locate";
import { validateStrict } from "./validate";

describe("validateStrict", () => {
  it("accepts the JSON values the spec allows", () => {
    for (const sample of [
      "0",
      "-12",
      "3.5",
      "1e-2",
      "true",
      "false",
      "null",
      '"hi"',
      '{"a":1,"b":[true,null]}',
      " [ 1 , 2 ] ",
    ]) {
      expect(validateStrict(sample).ok, sample).toBe(true);
      expect(() => JSON.parse(sample)).not.toThrow();
    }
  });

  it("rejects the same documents JSON.parse rejects", () => {
    for (const sample of ["", "{", "[1,2,]", "{'a':1}", "{a:1}", '{"a":1,}', "{/*c*/}", "undefined", "01", '"unterminated']) {
      expect(validateStrict(sample).ok, sample).toBe(false);
      expect(() => JSON.parse(sample), sample).toThrow();
    }
  });

  it("points at a trailing comma", () => {
    const input = '{\n  "a": 1,\n}\n';
    const result = validateStrict(input);
    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({
      line: 2,
      column: 9,
      message: "Trailing comma in an object.",
    });
  });

  it("points at a single quote and an unquoted key", () => {
    expect(validateStrict("{'a': 1}").error).toMatchObject({
      line: 1,
      column: 2,
      message: "Object keys must use double quotes.",
    });
    expect(validateStrict("{a: 1}").error).toMatchObject({
      line: 1,
      column: 2,
      message: "Object keys must be double-quoted strings.",
    });
  });

  it("points at a comment", () => {
    const result = validateStrict('{/*c*/"a":1}');
    expect(result.error).toMatchObject({
      line: 1,
      column: 2,
      message: "Comments are not allowed in JSON.",
    });
  });

  it("reports extra NDJSON as trailing content", () => {
    const result = validateStrict('{"a":1}\n{"b":2}\n');
    expect(result.error?.message).toMatch(/Extra content/);
    expect(result.error?.line).toBe(2);
  });

  it("warns on duplicate keys and long numbers without failing", () => {
    const duplicate = validateStrict('{"a":1,"a":2}');
    expect(duplicate.ok).toBe(true);
    expect(duplicate.warnings.map((note) => note.code)).toContain("duplicate-key");
    const long = validateStrict("1234567890123456");
    expect(long.ok).toBe(true);
    expect(long.warnings.map((note) => note.code)).toContain("precision");
  });

  it("explains a bad escape and a raw newline in a string", () => {
    expect(validateStrict('"\\q"').error?.message).toMatch(/Invalid escape/);
    expect(validateStrict('"line\nbreak"').error?.message).toMatch(/control character/);
  });
});

describe("locate", () => {
  it("counts lines and columns, including CRLF", () => {
    expect(positionAt("ab\ncd", 3)).toEqual({ line: 2, column: 1 });
    expect(positionAt("ab\r\ncd", 4)).toEqual({ line: 2, column: 1 });
  });

  it("draws a caret under the column", () => {
    const snippet = errorSnippet('{\n  "a": 1,\n}\n', 2, 9);
    expect(snippet).toContain('> 2 |   "a": 1,');
    expect(snippet.trimEnd().endsWith("^")).toBe(true);
  });
});
