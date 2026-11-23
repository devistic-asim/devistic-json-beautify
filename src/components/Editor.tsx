import { useMemo, useRef } from "react";
import { highlightJson } from "../lib/json/highlight";
import { cx } from "../lib/cx";

interface EditorProps {
  id: string;
  label: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  errorLine?: number | null;
  wrap?: boolean;
  highlighted?: boolean;
  onSubmit?: () => void;
  emptyText?: string;
}

export function Editor({
  id,
  label,
  value,
  onChange,
  readOnly = false,
  placeholder,
  errorLine,
  wrap = false,
  highlighted = false,
  onSubmit,
  emptyText,
}: EditorProps) {
  const gutterRef = useRef<HTMLDivElement>(null);
  const lines = value.length === 0 ? [""] : value.split("\n");
  const showGutter = lines.length <= 4000;
  const tokens = useMemo(
    () => (highlighted && value.length > 0 && value.length < 150_000 ? highlightJson(value) : null),
    [highlighted, value],
  );

  function syncScroll(scrollTop: number) {
    if (gutterRef.current) gutterRef.current.scrollTop = scrollTop;
  }

  if (readOnly && value.length === 0) {
    return (
      <div className="editor-shell is-empty">
        <p className="editor-empty" id={id}>
          {emptyText}
        </p>
      </div>
    );
  }

  return (
    <div className={cx("editor-shell", wrap && "is-wrap")}>
      {showGutter ? (
        <div className="gutter" ref={gutterRef} aria-hidden="true">
          {lines.map((_, index) => (
            <span key={index} className={errorLine === index + 1 ? "gutter-line is-error" : "gutter-line"}>
              {index + 1}
            </span>
          ))}
        </div>
      ) : (
        <div className="gutter gutter-note" aria-hidden="true">
          {lines.length} lines
        </div>
      )}
      {readOnly ? (
        <pre
          id={id}
          className={cx("editor", wrap && "wrap")}
          tabIndex={0}
          aria-label={label}
          onScroll={(event) => syncScroll(event.currentTarget.scrollTop)}
        >
          {tokens
            ? tokens.map((token, index) =>
                token.type === "ws" ? (
                  <span key={index}>{token.text}</span>
                ) : (
                  <span key={index} className={`tok-${token.type}`}>
                    {token.text}
                  </span>
                ),
              )
            : value}
        </pre>
      ) : (
        <textarea
          id={id}
          className={cx("editor", wrap && "wrap")}
          value={value}
          placeholder={placeholder}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          wrap={wrap ? "soft" : "off"}
          aria-label={label}
          aria-invalid={errorLine ? true : undefined}
          onChange={(event) => onChange?.(event.currentTarget.value)}
          onScroll={(event) => syncScroll(event.currentTarget.scrollTop)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
              event.preventDefault();
              onSubmit?.();
            }
          }}
        />
      )}
    </div>
  );
}
