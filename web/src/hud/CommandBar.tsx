import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";

export function CommandBar({
  onSend,
  onStop,
  onToggleMic,
  listening,
  busy,
  disabled,
  micDisabled,
}: {
  onSend: (text: string) => void;
  onStop: () => void;
  onToggleMic: () => void;
  listening: boolean;
  busy: boolean;
  disabled: boolean;
  micDisabled: boolean;
}) {
  const [value, setValue] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    if (textarea.current) textarea.current.style.height = "auto";
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    } else if (event.key === "Escape" && busy) {
      event.preventDefault();
      onStop();
    }
  };

  return (
    <form onSubmit={submit} className="flex w-full items-end gap-2.5">
      <button
        type="button"
        onClick={onToggleMic}
        disabled={micDisabled}
        aria-pressed={listening}
        aria-label={listening ? "Berhenti mendengarkan" : "Mulai mendengarkan"}
        title={listening ? "Berhenti mendengarkan" : "Mulai mendengarkan"}
        className={`glass grid size-11 shrink-0 place-items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-35 ${
          listening
            ? "border-live/60! text-live shadow-[0_0_20px_-4px_var(--color-live)]"
            : "text-ink-3 hover:border-accent/50! hover:text-accent"
        }`}
      >
        {listening ? (
          <span className="size-2.5 rounded-[3px] bg-current" />
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="9" y="2.5" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.6" />
            <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        )}
      </button>

      <div className="glass flex flex-1 items-end gap-2 rounded-2xl px-4 py-2.5 transition focus-within:border-accent/45!">
        <textarea
          ref={textarea}
          rows={1}
          value={value}
          disabled={disabled}
          placeholder={disabled ? "Menyambung ulang…" : "Ketik perintah, atau bicara lewat mikrofon…"}
          onChange={(event) => {
            setValue(event.target.value);
            const el = event.target;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
          }}
          onKeyDown={onKeyDown}
          className="max-h-32 flex-1 resize-none bg-transparent py-0.5 text-[13px] leading-relaxed text-ink placeholder:text-ink-4 focus:outline-none"
        />

        {busy ? (
          <button
            type="button"
            onClick={onStop}
            title="Hentikan (Esc)"
            className="grid size-7 shrink-0 place-items-center rounded-lg border border-line text-ink-3 transition hover:border-live/60 hover:text-live"
          >
            <span className="size-2.5 rounded-[2px] bg-current" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!value.trim() || disabled}
            title="Kirim (Enter)"
            className="grid size-7 shrink-0 place-items-center rounded-lg border border-line text-ink-3 transition hover:border-accent/50 hover:text-accent disabled:opacity-30 disabled:hover:border-line disabled:hover:text-ink-3"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 19V5M6 11l6-6 6 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </form>
  );
}
