import type { ChatStatus } from "ai";
import { MicIcon, MicOffIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import type { NeonModelId } from "@/lib/neon-models";
import { cn } from "@/lib/utils";

import { ModelPicker } from "./model-picker";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w["SpeechRecognition"] ?? w["webkitSpeechRecognition"] ?? null) as (new () => SpeechRecognitionLike) | null;
}

export function NeonComposer({
  onSend,
  status = "ready",
  onStop,
  model,
  onModelChange,
  autoFocus = true,
  className,
}: {
  onSend: (text: string) => void;
  status?: ChatStatus;
  onStop?: (() => void) | undefined;
  model: NeonModelId;
  onModelChange: (id: NeonModelId) => void;
  autoFocus?: boolean;
  className?: string;
}) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    setSpeechSupported(Boolean(getSpeechRecognition()));
  }, []);

  useEffect(() => {
    if (autoFocus && !busy) textareaRef.current?.focus();
  }, [autoFocus, busy]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const toggleMic = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    const base = text ? `${text.trimEnd()} ` : "";
    rec.onresult = (e) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i]![0]!.transcript;
      setText(base + transcript);
    };
    rec.onend = () => {
      setListening(false);
      textareaRef.current?.focus();
    };
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  return (
    <PromptInput
      onSubmit={(message) => {
        const value = message.text.trim();
        if (!value || busy) return;
        onSend(value);
        setText("");
      }}
      className={cn(
        "composer-shell rounded-[28px] border-0 [&_[data-slot=input-group]]:rounded-[28px] [&_[data-slot=input-group]]:border-0 [&_[data-slot=input-group]]:bg-transparent [&_[data-slot=input-group]]:shadow-none",
        className,
      )}
    >
      <PromptInputTextarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.currentTarget.value)}
        placeholder="Ask Neon"
        aria-label="Message Neon"
        className="min-h-14 px-6 pt-5 text-[17px] text-composer-foreground placeholder:text-muted-foreground"
      />
      <PromptInputFooter className="px-4 pb-3">
        <PromptInputTools />
        <PromptInputTools className="gap-1.5">
          <ModelPicker value={model} onChange={onModelChange} />
          {speechSupported ? (
            <PromptInputButton
              type="button"
              onClick={toggleMic}
              aria-label={listening ? "Stop dictation" : "Dictate"}
              className={cn("size-9 rounded-full", listening && "bg-primary/15 text-primary")}
            >
              {listening ? <MicOffIcon className="size-5" /> : <MicIcon className="size-5" />}
            </PromptInputButton>
          ) : null}
          <PromptInputSubmit
            status={status}
            {...(onStop ? { onStop } : {})}
            disabled={!busy && !text.trim()}
            className="size-9 rounded-full"
          />
        </PromptInputTools>
      </PromptInputFooter>
    </PromptInput>
  );
}
