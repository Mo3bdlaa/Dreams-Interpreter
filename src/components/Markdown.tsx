"use client";

import React from "react";

// Lightweight, safe inline markdown renderer for chat content. Supports
// **bold**, [text](url) links, horizontal rules (---) and line breaks.
// Builds React nodes directly (no dangerouslySetInnerHTML).

const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      nodes.push(
        <strong key={`${keyPrefix}-b${i}`} className="font-bold">
          {m[1]}
        </strong>,
      );
    } else if (m[2] !== undefined && m[3] !== undefined) {
      const href = m[3].startsWith("http") ? m[3] : `https://${m[3]}`;
      nodes.push(
        <a
          key={`${keyPrefix}-a${i}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-dotted underline-offset-2 hover:text-night-200"
        >
          {m[2]}
        </a>,
      );
    }
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Markdown({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <>
      {lines.map((line, idx) => {
        if (line.trim() === "---") {
          return <hr key={idx} className="my-2 border-white/15" />;
        }
        return (
          <React.Fragment key={idx}>
            {renderInline(line, String(idx))}
            {idx < lines.length - 1 && <br />}
          </React.Fragment>
        );
      })}
    </>
  );
}
