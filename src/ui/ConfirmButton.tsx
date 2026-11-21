import { useEffect, useRef, useState } from "react";

interface Props {
  id?: string;
  label: string;
  question: string;
  confirmLabel: string;
  disabled?: boolean;
  onConfirm: () => Promise<void> | void;
}

// A button for something that can't be undone. Pressing it asks on the page itself, with "Cancel"
// focused, rather than in a browser pop-up.
export function ConfirmButton({ id, label, question, confirmLabel, disabled, onConfirm }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const reopen = useRef(false);

  useEffect(() => {
    if (open) cancel.current?.focus();
    else if (reopen.current) { reopen.current = false; trigger.current?.focus(); }
  }, [open]);

  if (!open) return <button ref={trigger} id={id} className="small danger" type="button" disabled={disabled} onClick={() => setOpen(true)}>{label}</button>;
  return (
    <div className="confirm" role="group" aria-label={label}>
      <p>{question}</p>
      <div className="row">
        <button className="small danger solid" type="button" disabled={busy} onClick={async () => {
          setBusy(true);
          try { await onConfirm(); } finally { setBusy(false); setOpen(false); }
        }}>{confirmLabel}</button>
        <button ref={cancel} className="small" type="button" onClick={() => { reopen.current = true; setOpen(false); }}>Cancel</button>
      </div>
    </div>
  );
}
