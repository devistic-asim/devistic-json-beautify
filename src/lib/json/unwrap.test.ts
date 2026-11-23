import { describe, expect, it } from "vitest";
import { deepUnescape } from "./deep";
import { manualUnescape, unwrapStringified } from "./unwrap";

describe("unwrapStringified", () => {
  it("unwraps one and several JSON.stringify layers", () => {
    const once = JSON.stringify(JSON.stringify({ a: 1 }));
    expect(unwrapStringified(once)).toMatchObject({ text: '{"a":1}', levels: 1 });

    const twice = JSON.stringify(once);
    const peeled = unwrapStringified(twice);
    expect(peeled.levels).toBeGreaterThanOrEqual(2);
    expect(JSON.parse(peeled.text)).toEqual({ a: 1 });
  });

  it("peels an escaped body that was copied without surrounding quotes", () => {
    const body = JSON.stringify('{"a":1}').slice(1, -1);
    expect(body).toBe('{\\"a\\":1}');
    const peeled = unwrapStringified(body);
    expect(JSON.parse(peeled.text)).toEqual({ a: 1 });
    expect(peeled.levels).toBeGreaterThanOrEqual(1);

    const doubleBody = JSON.stringify(body).slice(1, -1);
    const again = unwrapStringified(doubleBody);
    expect(JSON.parse(again.text)).toEqual({ a: 1 });
    expect(again.levels).toBeGreaterThanOrEqual(2);
  });

  it("does not unwrap a plain string or a real object", () => {
    expect(unwrapStringified('"hello"')).toEqual({ text: '"hello"', levels: 0 });
    expect(unwrapStringified('{"a":1}')).toEqual({ text: '{"a":1}', levels: 0 });
  });

  it("rejects an invalid escape instead of corrupting the text", () => {
    expect(manualUnescape("\\q")).toBeNull();
    expect(manualUnescape("\\u12")).toBeNull();
    expect(manualUnescape('\\"a\\"')).toBe('"a"');
  });
});

describe("deepUnescape", () => {
  it("parses nested stringified objects and arrays when asked", () => {
    const value = {
      payload: JSON.stringify({ user: { id: 1 } }),
      list: JSON.stringify([1, { n: 2 }]),
      note: "leave me",
    };
    const applied = deepUnescape(value, true);
    expect(applied.count).toBe(2);
    expect(applied.value).toEqual({
      payload: { user: { id: 1 } },
      list: [1, { n: 2 }],
      note: "leave me",
    });
  });

  it("counts nested JSON without changing the tree when apply is off", () => {
    const value = { payload: JSON.stringify({ a: 1 }), note: "x" };
    const counted = deepUnescape(value, false);
    expect(counted.count).toBe(1);
    expect(counted.value).toEqual(value);
  });

  it("walks through more than one level of nesting", () => {
    const inner = JSON.stringify({ a: 1 });
    const value = { payload: JSON.stringify({ inner }) };
    const applied = deepUnescape(value, true);
    expect(applied.value).toEqual({ payload: { inner: { a: 1 } } });
    expect(applied.count).toBe(2);
  });

  it("repairs a JSON5-style string value", () => {
    const applied = deepUnescape({ payload: "{a: 1,}" }, true);
    expect(applied.value).toEqual({ payload: { a: 1 } });
  });
});
