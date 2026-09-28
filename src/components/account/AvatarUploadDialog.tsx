"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { toast } from "react-toastify";
import { GRADIENT } from "./ui";

/**
 * Profile Details → "Change Photo" (Figma "Upload Photo").
 *
 *   title "Upload Photo" + round close button
 *   cream drop area — click to choose, or drag a photo onto it; once a
 *   photo is chosen it shows a round preview there
 *   Cancel (outline) | Save Change (gradient)
 *
 * Checks type and size here for a quick message; the server checks again
 * from the file's own bytes (/api/account/avatar). "Remove current photo"
 * only shows when the customer uploaded one.
 */

const ACCEPT = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

const BUTTON =
  "inline-flex h-[46px] flex-1 items-center justify-center gap-2 rounded-full px-5 font-sora text-[15px] font-semibold leading-[1.3] transition focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] disabled:cursor-not-allowed disabled:opacity-50 md:text-[16px]";

export default function AvatarUploadDialog({
  open,
  onClose,
  currentImage,
  canRemove,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  currentImage: string | null;
  canRemove: boolean;
  /** Called with the new URL (or null after removing), before closing. */
  onSaved: (image: string | null) => Promise<void> | void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);

  const clear = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setError(null);
    setDragging(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const close = () => {
    if (busy) return;
    clear();
    onClose();
  };

  // Escape closes; the page behind doesn't scroll while it's open.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        if (preview) URL.revokeObjectURL(preview);
        setFile(null);
        setPreview(null);
        setError(null);
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, busy, preview, onClose]);

  const pick = (picked: File | undefined | null) => {
    if (!picked) return;
    if (!ACCEPT.includes(picked.type)) {
      setError("Please choose a PNG, JPG or WEBP image.");
      return;
    }
    if (picked.size > MAX_BYTES) {
      setError("That photo is bigger than 2MB. Please choose a smaller one.");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
    setError(null);
  };

  const save = async () => {
    if (!file) {
      setError("Please choose a photo first.");
      return;
    }
    setBusy("save");
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/account/avatar", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data?.image !== "string") {
        setError(data?.error ?? "Couldn't upload your photo. Please try again.");
        return;
      }
      await onSaved(data.image);
      toast.success("Your photo is updated");
      clear();
      onClose();
    } catch {
      setError("No connection. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy("remove");
    setError(null);
    try {
      const res = await fetch("/api/account/avatar", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Couldn't remove your photo. Please try again.");
        return;
      }
      await onSaved(null);
      toast.success("Your photo is removed");
      clear();
      onClose();
    } catch {
      setError("No connection. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-photo-title"
    >
      <div className="flex w-full max-w-[603px] flex-col gap-5 rounded-[24px] bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)] md:rounded-[30px] md:p-[30px]">
        <div className="flex items-center justify-between gap-4">
          <h2
            id="upload-photo-title"
            className="font-frank-ruhl text-[24px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[28px]"
          >
            Upload Photo
          </h2>
          <button
            type="button"
            onClick={close}
            disabled={Boolean(busy)}
            aria-label="Close"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F9F6F3] text-black transition-colors hover:bg-black hover:text-white disabled:opacity-50"
          >
            <X className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>

        {/* Drop area — a real button, so it works with the keyboard too */}
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
          disabled={Boolean(busy)}
          className={`flex min-h-[189px] w-full flex-col items-center justify-center gap-5 rounded-[20px] bg-[#F9F6F3] px-4 py-[18px] text-center transition-shadow focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px] ${
            dragging ? "shadow-[inset_0_0_0_2px_#FF9540]" : ""
          }`}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob preview
            <img src={preview} alt="Chosen photo" className="h-[90px] w-[90px] rounded-full object-cover" />
          ) : (
            <span className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-white">
              <Camera className="h-6 w-6 text-black" strokeWidth={1.5} aria-hidden="true" />
            </span>
          )}
          <span className="flex flex-col items-center gap-3">
            <span className="font-frank-ruhl text-[16px] font-medium leading-[1.2] text-black">
              {file ? file.name : "Drop images here or click to upload"}
            </span>
            <span className="font-sora text-[12px] leading-[1.2] text-black/70">
              {file ? "Click to choose a different photo" : "PNG, JPG, WEBP up to 2MB · Recommended 400×400px"}
            </span>
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT.join(",")}
          className="hidden"
          onChange={(event) => pick(event.target.files?.[0])}
        />

        {error && (
          <p role="alert" className="rounded-[12px] bg-[#FAE7EC] px-4 py-3 font-sora text-[12px] text-[#D72A37]">
            {error}
          </p>
        )}

        {canRemove && currentImage && !file && (
          <button
            type="button"
            onClick={remove}
            disabled={Boolean(busy)}
            className="self-start font-sora text-[13px] font-semibold text-[#D72A37] hover:underline disabled:opacity-50"
          >
            {busy === "remove" ? "Removing…" : "Remove current photo"}
          </button>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={close}
            disabled={Boolean(busy)}
            className={`${BUTTON} border border-black text-black hover:bg-black hover:text-white`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={Boolean(busy) || !file}
            className={`${BUTTON} ${GRADIENT} text-white hover:opacity-90`}
          >
            {busy === "save" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {busy === "save" ? "Uploading…" : "Save Change"}
          </button>
        </div>
      </div>
    </div>
  );
}
