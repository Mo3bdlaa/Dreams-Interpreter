import { describe, it, expect } from "vitest";
import { buildParams, type ChatTurn } from "./anthropic";

/**
 * The request layout is what makes prompt caching pay off: anything that
 * changes per turn must come after every cache breakpoint, or it invalidates
 * the cached prefix behind it on every request.
 */
const FIXED = "تعليمات ثابتة";
const GROUNDING = "مقتطفات هذا الدور";

const turns: ChatTurn[] = [
  { role: "system", content: FIXED },
  { role: "system", content: GROUNDING },
  { role: "user", content: "حلمت بالبحر" },
  { role: "assistant", content: "التفسير الأول" },
  { role: "user", content: "وكمان كان فيه سمك" },
];

describe("buildParams (prompt-cache layout)", () => {
  const p = buildParams("claude-haiku-5-5", turns, 1500, "medium");

  it("puts only the fixed prompt in system, as a cache breakpoint", () => {
    expect(p.system).toHaveLength(1);
    expect(p.system[0].text).toBe(FIXED);
    expect(p.system[0].cache_control).toEqual({ type: "ephemeral" });
  });

  it("caches the conversation up to the last assistant reply", () => {
    const assistant = p.messages[1].content as { cache_control?: unknown }[];
    expect(assistant[0].cache_control).toEqual({ type: "ephemeral" });
  });

  it("appends this turn's grounding to the newest user turn, uncached", () => {
    const last = p.messages.at(-1)!;
    const blocks = last.content as { text: string; cache_control?: unknown }[];
    expect(last.role).toBe("user");
    expect(blocks.map((b) => b.text)).toEqual(["وكمان كان فيه سمك", GROUNDING]);
    expect(blocks.some((b) => b.cache_control)).toBe(false);
  });

  it("keeps earlier user turns byte-identical across turns (no grounding)", () => {
    const first = p.messages[0].content as { text: string }[];
    expect(first.map((b) => b.text)).toEqual(["حلمت بالبحر"]);
  });

  it("sends no sampling parameters and leaves room for thinking", () => {
    expect(p).not.toHaveProperty("temperature");
    expect(p.max_tokens).toBeGreaterThan(1500);
    expect(p.output_config).toEqual({ effort: "medium" });
  });
});
