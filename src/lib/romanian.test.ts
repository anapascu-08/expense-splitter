import { describe, it, expect } from "vitest";
import { toDative } from "@/lib/romanian";

describe("toDative", () => {
  it("inflects feminine names ending in -a", () => {
    expect(toDative("Ana")).toBe("Anei");
    expect(toDative("Dana")).toBe("Danei");
    expect(toDative("Maria")).toBe("Mariei");
    expect(toDative("Ioana")).toBe("Ioanei");
    expect(toDative("Elena")).toBe("Elenei");
  });

  it("handles the -ca / -ga endings", () => {
    expect(toDative("Anca")).toBe("Ancăi");
    expect(toDative("Bianca")).toBe("Biancăi");
    expect(toDative("Raluca")).toBe("Ralucăi");
    expect(toDative("Olga")).toBe("Olgăi");
  });

  it("keeps 'lui <name>' for masculine names", () => {
    expect(toDative("Bogdan")).toBe("lui Bogdan");
    expect(toDative("Cristi")).toBe("lui Cristi");
    expect(toDative("Andrei")).toBe("lui Andrei");
  });

  it("keeps 'lui <name>' for masculine names that end in -a", () => {
    expect(toDative("Luca")).toBe("lui Luca");
    expect(toDative("Toma")).toBe("lui Toma");
    expect(toDative("Mircea")).toBe("lui Mircea");
  });

  it("falls back to 'lui <name>' for consonant-ending and compound names", () => {
    expect(toDative("Carmen")).toBe("lui Carmen");
    expect(toDative("Ingrid")).toBe("lui Ingrid");
    expect(toDative("Alice")).toBe("lui Alice");
    expect(toDative("Ana-Maria")).toBe("lui Ana-Maria");
    expect(toDative("Ana Maria")).toBe("lui Ana Maria");
  });

  it("trims surrounding whitespace", () => {
    expect(toDative("  Ana  ")).toBe("Anei");
  });
});
