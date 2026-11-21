import { PIDS, PROVIDERS } from "../providers";
import { dec, describe, enc, modelsFor } from "../storage/settings";
import type { Keys } from "../storage/vault";

interface Props {
  id: string;
  className?: string;
  ariaLabel?: string;
  value: string;
  onChange: (value: string) => void;
  keys: Keys;
  // Seat menus offer "Default model (…)" as their first option, stored as "".
  defaultChoice?: string;
}

export function ModelSelect({ id, className, ariaLabel, value, onChange, keys, defaultChoice }: Props) {
  return (
    <select id={id} className={className} aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)}>
      {defaultChoice !== undefined && <option value="">Default model ({describe(dec(defaultChoice))})</option>}
      {PIDS.map((pid) => {
        const list = modelsFor(pid);
        if (value && value.startsWith(pid + "|") && !list.includes(dec(value).model)) list.unshift(dec(value).model);
        return (
          <optgroup key={pid} label={PROVIDERS[pid].label + (keys[pid].trim() ? "" : " (add a key to use)")}>
            {list.map((m) => <option key={m} value={enc(pid, m)}>{m}</option>)}
          </optgroup>
        );
      })}
    </select>
  );
}
