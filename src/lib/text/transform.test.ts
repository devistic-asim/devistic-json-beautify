import { describe, expect, it } from "vitest";
import { applyTextAction, countPhrase, inputPreview, textStats, toCamel, toKebab, toSnake, wordsOf } from "./transform";

describe("text transforms", () => {
  it("cleans whitespace, blank lines, and line endings", () => {
    const messy = "  a   b  \r\n\r\n  c \t d  \n";
    expect(applyTextAction(messy, "clean")).toBe("a b\nc d");
    expect(applyTextAction("  a  \n  b  ", "trim")).toBe("a\nb");
    expect(applyTextAction("a   b\tc", "collapse")).toBe("a b c");
    expect(applyTextAction("a\n\nb\n", "blank")).toBe("a\nb");
    expect(applyTextAction("a\r\nb\rc", "newlines")).toBe("a\nb\nc");
  });

  it("changes case without dropping punctuation", () => {
    expect(applyTextAction("Hello WORLD", "upper")).toBe("HELLO WORLD");
    expect(applyTextAction("Hello WORLD", "lower")).toBe("hello world");
    expect(applyTextAction("hello WORLD", "title")).toBe("Hello World");
    expect(applyTextAction("hello. WORLD! yes", "sentence")).toBe("Hello. World! Yes");
  });

  it("converts identifiers per line", () => {
    expect(wordsOf("parseURLValue")).toEqual(["parse", "URL", "Value"]);
    expect(toCamel("Hello World")).toBe("helloWorld");
    expect(toSnake("helloWorld")).toBe("hello_world");
    expect(toKebab("Hello World")).toBe("hello-world");
    expect(applyTextAction("Hello World\n\nfoo_bar", "camel")).toBe("helloWorld\n\nfooBar");
    expect(applyTextAction("helloWorld", "snake")).toBe("hello_world");
    expect(applyTextAction("hello_world", "kebab")).toBe("hello-world");
  });

  it("labels a single line and previews past a lone brace", () => {
    expect(countPhrase(1, "line", "lines")).toBe("1 line");
    expect(countPhrase(2, "line", "lines")).toBe("2 lines");
    expect(inputPreview("{\n  // hand-edited config\n  name: 'Ada',\n}")).toBe("// hand-edited config");
  });

  it("counts characters, lines, and words", () => {
    expect(textStats("a\nb c")).toEqual({ characters: 5, lines: 2, words: 3 });
    expect(textStats("")).toEqual({ characters: 0, lines: 0, words: 0 });
    expect(textStats("é")).toEqual({ characters: 1, lines: 1, words: 1 });
  });
});
