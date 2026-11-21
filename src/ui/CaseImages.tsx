import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { dataUrlOf, ImageError, processFile } from "../images/process";
import { MAX_IMAGES, type CaseImage } from "../images/types";
import { RedactionDialog } from "./RedactionDialog";

interface Props {
  images: CaseImage[];
  setImages: Dispatch<SetStateAction<CaseImage[]>>;
  showAll: boolean;
  onShowAll: (on: boolean) => void;
}

export function CaseImages({ images, setImages, showAll, onShowAll }: Props) {
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const update = (id: string, patch: Partial<CaseImage>) => setImages((list) => list.map((img) => img.id === id ? { ...img, ...patch } : img));

  async function add(files: File[]) {
    if (!files.length) return;
    const room = MAX_IMAGES - images.length;
    const errs: string[] = [];
    if (files.length > room) errs.push(`You can attach up to ${MAX_IMAGES} images. ` + (room > 0 ? `Only the first ${room} were added.` : "Remove one to add another."));
    setBusy(true);
    const added: CaseImage[] = [];
    for (const file of files.slice(0, Math.max(0, room))) {
      try {
        const img = await processFile(file);
        added.push({ ...img, id: crypto.randomUUID(), caption: "", dataUrl: dataUrlOf(img.base64), checked: false });
      } catch (e) {
        errs.push(e instanceof ImageError ? e.message : `"${file.name}" couldn't be added. Try again.`);
      }
    }
    setImages((list) => [...list, ...added].slice(0, MAX_IMAGES));
    setErrors(errs);
    setBusy(false);
  }

  const editingIndex = images.findIndex((img) => img.id === editing);

  return (
    <section className="panel images" aria-labelledby="images-h">
      <h2 id="images-h">Images <span className="tag">optional</span></h2>
      <div
        className={"drop" + (dragOver ? " over" : "")}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); void add([...e.dataTransfer.files]); }}
      >
        <span>{busy ? "Preparing images…" : "Drag PNG or JPEG images here, or"}</span>
        <button className="small" type="button" disabled={busy || images.length >= MAX_IMAGES} onClick={() => input.current?.click()}>Choose images</button>
        <input ref={input} id="imageInput" type="file" accept="image/png,image/jpeg" multiple hidden
          onChange={(e) => { const files = [...(e.target.files ?? [])]; e.target.value = ""; void add(files); }} />
      </div>
      <p className="hint">X-rays, CT or MRI key slices, or clinical photos, up to {MAX_IMAGES}. Each image is shrunk and redrawn so hidden details such as the date, location and file name are removed. Captions are sent too, so keep them anonymous: write "3 months ago" rather than a date.</p>
      {errors.length > 0 && <ul className="img-errors" role="alert">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
      {images.length > 0 && (
        <ul className="img-list">
          {images.map((img, i) => (
            <li className="img-item" key={img.id}>
              <img src={img.dataUrl} alt={`Image ${i + 1}${img.caption ? ": " + img.caption : ""}`} />
              <div className="img-fields">
                <label className="fld" htmlFor={"cap-" + img.id}>
                  <span>Image {i + 1} caption <span className="tag">optional</span></span>
                  <input type="text" id={"cap-" + img.id} placeholder="For example: AP pelvis, 3 months ago" value={img.caption}
                    onChange={(e) => update(img.id, { caption: e.target.value })} />
                </label>
                <label className="check" htmlFor={"chk-" + img.id}>
                  <input type="checkbox" id={"chk-" + img.id} checked={img.checked} onChange={(e) => update(img.id, { checked: e.target.checked })} />
                  <span>I have checked this image for names, hospital numbers, dates of birth and other identifiers, including text burned into the image.</span>
                </label>
                <div className="row">
                  <button className="small" type="button" onClick={() => setEditing(img.id)}>Black out areas</button>
                  <button className="small" type="button" onClick={() => setImages((list) => list.filter((x) => x.id !== img.id))}>Remove</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {images.length > 0 && (
        <label className="check" htmlFor="seeImages">
          <input type="checkbox" id="seeImages" checked={showAll} onChange={(e) => onShowAll(e.target.checked)} />
          <span>Let every consultant see the images. Otherwise only the radiologist sees them and the others read the radiologist's report, which costs less.</span>
        </label>
      )}
      {editingIndex >= 0 && (
        <RedactionDialog
          image={images[editingIndex]}
          label={`Image ${editingIndex + 1}`}
          onClose={() => setEditing(null)}
          // A changed image needs checking again.
          onSave={(base64) => { update(images[editingIndex].id, { base64, dataUrl: dataUrlOf(base64), checked: false }); setEditing(null); }}
        />
      )}
    </section>
  );
}
