import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { burnBoxes, loadImage } from "../images/process";
import type { Box, CaseImage } from "../images/types";

interface Props {
  image: CaseImage;
  label: string;
  onSave: (base64: string) => void;
  onClose: () => void;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const normalise = (a: { x: number; y: number }, b: { x: number; y: number }): Box =>
  ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) });

// Draw boxes over anything identifying. Boxes are only burned into the pixels on Save.
// Keyboard: "Add box", then arrow keys move the selected box, Shift with arrows resizes it, Delete removes it.
export function RedactionDialog({ image, label, onSave, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  // The box being dragged out, kept apart from the finished ones until the pointer is released.
  const [draft, setDraft] = useState<Box | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { width: W, height: H } = image;
  const step = Math.max(1, Math.round(Math.max(W, H) / 100));

  useEffect(() => {
    dialog.current?.showModal();
    loadImage(image.dataUrl).then(setImg, (e: Error) => setError(e.message));
  }, [image.dataUrl]);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || !img) return;
    ctx.drawImage(img, 0, 0, W, H);
    ctx.fillStyle = "#000";
    boxes.concat(draft ? [draft] : []).forEach((b) => ctx.fillRect(b.x, b.y, b.w, b.h));
    if (selected !== null && boxes[selected]) {
      const b = boxes[selected];
      ctx.strokeStyle = "#ffb000";
      ctx.lineWidth = Math.max(2, Math.round(W / 400));
      ctx.setLineDash([ctx.lineWidth * 3, ctx.lineWidth * 2]);
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.setLineDash([]);
    }
  }, [img, boxes, draft, selected, W, H]);

  const toImage = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) * (W / r.width), 0, W), y: clamp((e.clientY - r.top) * (H / r.height), 0, H) };
  };

  function down(e: PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toImage(e);
    start.current = p;
    setDraft({ x: p.x, y: p.y, w: 0, h: 0 });
  }

  function move(e: PointerEvent<HTMLCanvasElement>) {
    if (!start.current) return;
    setDraft(normalise(start.current, toImage(e)));
  }

  function up(e: PointerEvent<HTMLCanvasElement>) {
    if (!start.current) return;
    const p = toImage(e);
    const box = normalise(start.current, p);
    start.current = null;
    setDraft(null);
    if (box.w < 4 && box.h < 4) {
      // A click rather than a drag: select the box under the pointer, if any.
      const hit = boxes.map((b, i) => [b, i] as const).reverse().find(([b]) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
      setSelected(hit ? hit[1] : null);
    } else {
      setBoxes((list) => [...list, box]);
      setSelected(boxes.length);
    }
  }

  function addBox() {
    const box = { x: W * 0.375, y: H * 0.45, w: W * 0.25, h: H * 0.1 };
    setBoxes((list) => [...list, box]);
    setSelected(boxes.length);
    canvas.current?.focus();
  }

  function key(e: KeyboardEvent<HTMLCanvasElement>) {
    if (selected === null) return;
    const dirs: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      setBoxes((list) => list.filter((_, i) => i !== selected));
      setSelected(null);
      return;
    }
    const d = dirs[e.key];
    if (!d) return;
    e.preventDefault();
    setBoxes((list) => list.map((b, i) => {
      if (i !== selected) return b;
      if (e.shiftKey) {
        const w = clamp(b.w + d[0] * step, step, W - b.x), h = clamp(b.h + d[1] * step, step, H - b.y);
        return { ...b, w, h };
      }
      return { ...b, x: clamp(b.x + d[0] * step, 0, W - b.w), y: clamp(b.y + d[1] * step, 0, H - b.h) };
    }));
  }

  async function save() {
    if (!boxes.length) { onClose(); return; }
    setSaving(true);
    try {
      onSave(await burnBoxes(image.dataUrl, W, H, boxes));
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <dialog ref={dialog} className="redact" aria-labelledby="redact-h" onCancel={(e) => { e.preventDefault(); onClose(); }}>
      <div className="redact-body">
        <h3 id="redact-h">Black out areas on {label}</h3>
        <p className="hint">Drag over anything that could identify the patient: names, hospital numbers, dates, and text in the corners of an X-ray. Click a box to select it. When you save, the boxes are burned into the image and can't be removed.</p>
        <canvas
          ref={canvas} width={W} height={H} tabIndex={0}
          aria-label={`${label}. Use "Add box", then the arrow keys to move the selected box, Shift and the arrow keys to resize it, and Delete to remove it.`}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onKeyDown={key}
        />
        <div className="row">
          <button className="small" type="button" onClick={addBox}>Add box</button>
          <button className="small" type="button" disabled={selected === null} onClick={() => { setBoxes((l) => l.filter((_, i) => i !== selected)); setSelected(null); }}>Remove selected box</button>
          <button className="small" type="button" disabled={!boxes.length} onClick={() => { setBoxes((l) => l.slice(0, -1)); setSelected(null); }}>Undo last box</button>
          <span className="hint" role="status">{boxes.length === 1 ? "1 box" : boxes.length + " boxes"}</span>
        </div>
        {error && <p className="err" role="alert">{error}</p>}
        <div className="row">
          <button className="primary" type="button" disabled={saving || !img} onClick={save}>{saving ? "Saving…" : "Save"}</button>
          <button type="button" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </dialog>
  );
}
