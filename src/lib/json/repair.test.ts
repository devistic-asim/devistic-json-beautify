import { describe, expect, it } from "vitest";
import { repairJsonish } from "./repair";

function codes(input: string): string[] {
  return repairJsonish(input).notes.map((note) => note.code);
}

describe("repairJsonish", () => {
  it("removes trailing commas without touching commas in strings", () => {
    const repaired = repairJsonish('{"a":",","b":[1,]}');
    expect(JSON.parse(repaired.text)).toEqual({ a: ",", b: [1] });
    expect(codes('{"a":",","b":[1,]}')).toContain("trailing-commas");
  });

  it("strips comments but keeps comment-like text inside strings", () => {
    const input = `{
      /* block */
      "url": "http://example.com/a",
      "note": "not a // comment"
    }`;
    const repaired = repairJsonish(input);
    expect(JSON.parse(repaired.text)).toEqual({
      url: "http://example.com/a",
      note: "not a // comment",
    });
    expect(repaired.notes.map((note) => note.code)).toContain("comments");
  });

  it("converts single quotes, including quotes inside the string", () => {
    const repaired = repairJsonish(`{'say': 'he said "hi"\\nnext'}`);
    expect(JSON.parse(repaired.text)).toEqual({ say: 'he said "hi"\nnext' });
    expect(codes(`{'a': 1}`)).toContain("single-quotes");
  });

  it("quotes unquoted keys and leaves a bare value for the validator", () => {
    expect(JSON.parse(repairJsonish("{a: 1, b_c: 'x'}").text)).toEqual({ a: 1, b_c: "x" });
    const bare = repairJsonish("{ok: yes}");
    expect(() => JSON.parse(bare.text)).toThrow();
    expect(bare.text).toContain("yes");
  });

  it("inserts a missing comma", () => {
    expect(JSON.parse(repairJsonish('{"a": 1 "b": 2}').text)).toEqual({ a: 1, b: 2 });
    expect(codes('{"a": 1 "b": 2}')).toContain("missing-commas");
  });

  it("converts Python and JavaScript literals, hex, and a leading plus", () => {
    expect(JSON.parse(repairJsonish("{a: True, b: False, c: None, d: undefined}").text)).toEqual({
      a: true,
      b: false,
      c: null,
      d: null,
    });
    expect(JSON.parse(repairJsonish("[+12, 0x10, -Infinity, NaN]").text)).toEqual([12, 16, null, null]);
  });

  it("replaces curly quotes", () => {
    const repaired = repairJsonish("{\u201Ca\u201D: \u2018x\u2019}");
    expect(JSON.parse(repaired.text)).toEqual({ a: "x" });
    expect(repaired.notes.map((note) => note.code)).toContain("smart-quotes");
  });

  it("escapes a raw newline inside a double-quoted string", () => {
    const repaired = repairJsonish('{"a":"line1\nline2"}');
    expect(JSON.parse(repaired.text)).toEqual({ a: "line1\nline2" });
    expect(repaired.notes.map((note) => note.code)).toContain("raw-controls");
  });
});
