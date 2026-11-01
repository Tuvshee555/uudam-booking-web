"use client";

/**
 * A field people never see, for form-filling bots to fill. The server drops
 * any submission that has it (server/spam.ts). Off-screen rather than
 * display:none, which some bots skip; hidden from screen readers and Tab.
 */
export default function Honeypot({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute -left-[9999px] top-auto h-px w-px overflow-hidden opacity-0">
      <label>
        Вэбсайт
        <input type="text" name="website" tabIndex={-1} autoComplete="off" value={value} onChange={(event) => onChange(event.target.value)} />
      </label>
    </div>
  );
}
