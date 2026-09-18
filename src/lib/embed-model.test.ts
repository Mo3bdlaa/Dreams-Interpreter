import { describe, it, expect } from "vitest";
import { resolveEmbedModel, OPENROUTER_FREE_EMBED } from "./embed-model";

const OR = "https://openrouter.ai/api/v1";

describe("resolveEmbedModel", () => {
  it("defaults to the free model on OpenRouter so semantic retrieval is on", () => {
    expect(resolveEmbedModel(undefined, OR)).toBe(OPENROUTER_FREE_EMBED);
    expect(resolveEmbedModel("", OR)).toBe(OPENROUTER_FREE_EMBED);
  });

  it("does not guess a model id on other providers", () => {
    expect(resolveEmbedModel(undefined, "https://api.openai.com/v1")).toBeNull();
    expect(resolveEmbedModel(undefined, undefined)).toBeNull();
  });

  it("honours an explicit model", () => {
    expect(resolveEmbedModel("text-embedding-3-small", OR)).toBe(
      "text-embedding-3-small",
    );
  });

  it("can be switched off without a code change", () => {
    // Semantic retrieval sends dream text off-box, so opting out must be easy.
    for (const off of ["off", "OFF", "none", "false", "0", "disabled"]) {
      expect(resolveEmbedModel(off, OR)).toBeNull();
    }
  });

  it("ignores surrounding whitespace", () => {
    expect(resolveEmbedModel("  off  ", OR)).toBeNull();
    expect(resolveEmbedModel("  my-model  ", OR)).toBe("my-model");
  });
});
