export function describeValue(value: unknown): string {
  if (Array.isArray(value)) {
    return `Array of ${value.length} item${value.length === 1 ? "" : "s"}`;
  }
  if (value && typeof value === "object") {
    const count = Object.keys(value as Record<string, unknown>).length;
    return `Object with ${count} key${count === 1 ? "" : "s"}`;
  }
  if (typeof value === "string") return "String";
  if (typeof value === "number") return "Number";
  if (typeof value === "boolean") return "Boolean";
  if (value === null) return "null";
  return "Empty";
}
