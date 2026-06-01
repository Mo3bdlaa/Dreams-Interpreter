"use client";

import { useEffect, useRef } from "react";
import { useSpeech } from "./useSpeech";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  onSubmit?: () => void;
}

/** Textarea with an integrated Web-Speech mic button (Arabic). */
export function VoiceTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  onSubmit,
}: Props) {
  const { supported, listening, transcript, start, stop } = useSpeech("ar-SA");
  const baseRef = useRef("");

  // While listening, append live transcript to the text captured at start.
  useEffect(() => {
    if (listening) {
      onChange((baseRef.current ? baseRef.current + " " : "") + transcript);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, listening]);

  const toggleMic = () => {
    if (listening) {
      stop();
    } else {
      baseRef.current = value;
      start();
    }
  };

  return (
    <div className="relative">
      <textarea
        className="input pe-14 resize-none"
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && onSubmit) {
            e.preventDefault();
            onSubmit();
          }
        }}
      />
      {supported && (
        <button
          type="button"
          onClick={toggleMic}
          title={listening ? "إيقاف التسجيل" : "تحدّث بدل الكتابة"}
          className={`absolute bottom-3 start-3 grid h-9 w-9 place-items-center rounded-full transition ${
            listening
              ? "bg-red-500 text-white animate-pulse-glow"
              : "bg-night-400 text-night-950 hover:bg-night-300"
          }`}
        >
          {listening ? <StopIcon /> : <MicIcon />}
        </button>
      )}
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" stroke="none" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}
