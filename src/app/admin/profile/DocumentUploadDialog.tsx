"use client";

import { useRef, useState } from "react";
import { Camera, FileText, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import { DateField, ModalError, ModalShell, OUTLINE_BUTTON, PRIMARY_BUTTON } from "@/components/admin/modal-ui";
import { DOCUMENT_MAX_BYTES, DOCUMENT_MIME_TYPES, type RiderDocumentView } from "@/lib/rider-documents";

/**
 * Figma "Documents" dialog (735 wide, radius 30, padding 30, gap 40):
 * a cream drop area — "Drop images here or click to upload" — and
 * Cancel / Save Change. The licence and insurance also ask for the expiry
 * date printed on them, so "Renew Soon" can warn 30 days ahead.
 *
 * POST /api/rider/documents (multipart). The server checks the real file
 * type (not the name) and the size again.
 */
export default function DocumentUploadDialog({
  document,
  needsExpiry,
  today,
  onClose,
  onSaved,
}: {
  /** The row being uploaded; null = closed. */
  document: RiderDocumentView | null;
  needsExpiry: boolean;
  today: string;
  onClose: () => void;
  onSaved: (saved: RiderDocumentView) => void;
}) {
  if (!document) return null;
  // Keyed so every open starts empty.
  return (
    <UploadForm key={document.type} document={document} needsExpiry={needsExpiry} today={today} onClose={onClose} onSaved={onSaved} />
  );
}

function UploadForm({
  document,
  needsExpiry,
  today,
  onClose,
  onSaved,
}: {
  document: RiderDocumentView;
  needsExpiry: boolean;
  today: string;
  onClose: () => void;
  onSaved: (saved: RiderDocumentView) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  // Renewing: the old date is past or close, so start empty.
  const [expiresAt, setExpiresAt] = useState(document.state === "VERIFIED" || document.state === "PENDING" ? (document.expiresAt ?? "") : "");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [ty, tm, td] = today.split("-").map(Number);
  const todayDate = new Date(ty, tm - 1, td);

  const close = () => {
    if (busy) return;
    if (preview) URL.revokeObjectURL(preview);
    onClose();
  };

  const pick = (picked: File | undefined | null) => {
    if (!picked) return;
    if (!DOCUMENT_MIME_TYPES[picked.type]) {
      setError("Please choose a PNG, JPG, WEBP or PDF file.");
      return;
    }
    if (picked.size > DOCUMENT_MAX_BYTES) {
      setError("That file is bigger than 2MB. Please choose a smaller one.");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(picked);
    setPreview(picked.type.startsWith("image/") ? URL.createObjectURL(picked) : null);
    setError("");
  };

  const save = async () => {
    if (!file) {
      setError("Please choose a file first.");
      return;
    }
    if (needsExpiry && !expiresAt) {
      setError("Please enter the expiry date printed on the document.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("type", document.type);
      body.append("file", file);
      if (expiresAt) body.append("expiresAt", expiresAt);
      const res = await fetch("/api/rider/documents", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Upload failed. Please try again.");
        return;
      }
      if (preview) URL.revokeObjectURL(preview);
      toast.success(`${document.label} uploaded — the restaurant will check it`);
      onSaved(data as RiderDocumentView);
    } catch {
      setError("No connection. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      open
      onClose={close}
      title={document.label}
      titleId="document-upload-title"
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={close} disabled={busy} className={OUTLINE_BUTTON}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={busy || !file} className={PRIMARY_BUTTON}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {busy ? "Uploading…" : "Save Change"}
          </button>
        </div>
      }
    >
      {/* Drop area — a real button, so the keyboard works too */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          pick(event.dataTransfer.files?.[0]);
        }}
        disabled={busy}
        className={`flex min-h-[189px] w-full flex-col items-center justify-center gap-5 rounded-[20px] bg-[#F9F6F3] px-4 py-[18px] text-center transition-shadow focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px] ${
          dragging ? "shadow-[inset_0_0_0_2px_#FF9540]" : ""
        }`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob preview
          <img src={preview} alt="Chosen file" className="h-[90px] max-w-[160px] rounded-[10px] object-cover" />
        ) : (
          <span className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-white">
            {file ? (
              <FileText className="h-6 w-6 text-black" strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <Camera className="h-6 w-6 text-black" strokeWidth={1.5} aria-hidden="true" />
            )}
          </span>
        )}
        <span className="flex flex-col items-center gap-3">
          <span className="break-all font-frank-ruhl text-[16px] font-medium leading-[1.2] text-black">
            {file ? file.name : "Drop images here or click to upload"}
          </span>
          <span className="font-sora text-[12px] leading-[1.4] text-black/70">
            {file ? "Click to choose a different file" : "PNG, JPG, WEBP or PDF up to 2MB · a clear photo of the whole document"}
          </span>
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={Object.keys(DOCUMENT_MIME_TYPES).join(",")}
        className="hidden"
        onChange={(event) => pick(event.target.files?.[0])}
      />

      {needsExpiry && (
        <DateField
          id="document-expiry"
          label="Expiry Date"
          required
          value={expiresAt}
          onChange={(value) => {
            setExpiresAt(value);
            setError("");
          }}
          minDate={todayDate}
          maxDate={new Date(ty + 20, 11, 31)}
          yearPicker
          showToday={false}
          placeholder="mm/dd/yyyy"
        />
      )}

      {document.state !== "MISSING" && (
        <p className="font-sora text-[12px] leading-[1.6] text-black/60">
          The new file replaces the one on file and goes back to the restaurant for checking.
        </p>
      )}

      {error && <ModalError message={error} />}
    </ModalShell>
  );
}
