"use client";

import { useRef, useState } from "react";
import { ImageIcon, Loader2, X } from "lucide-react";
import { toast } from "sonner";

interface ImageUploadProps {
  bucket: string;
  value?: string;           // current image URL
  onChange: (url: string) => void;
  label?: string;
  className?: string;
}

export function ImageUpload({ bucket, value, onChange, label = "Photo", className = "" }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string>(value ?? "");

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }

    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bucket", bucket);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        toast.error("Upload failed: " + (data.error ?? res.statusText));
        setPreview(value ?? "");
      } else {
        onChange(data.url);
        setPreview(data.url);
        toast.success("Image uploaded");
      }
    } catch (err) {
      toast.error("Upload failed: " + String(err));
      setPreview(value ?? "");
    }

    setUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreview("");
    onChange("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const current = preview || value;

  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>}
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="relative w-full h-36 rounded-xl border-2 border-dashed border-gray-200 hover:border-orange-400 cursor-pointer transition-colors overflow-hidden group bg-gray-50 flex items-center justify-center"
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <Loader2 size={24} className="animate-spin text-orange-500" />
            <p className="text-xs">Uploading…</p>
          </div>
        ) : current ? (
          <>
            <img src={current} alt="preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <p className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">Click to change</p>
            </div>
            <button
              type="button"
              onClick={clear}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={12} />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center">
              <ImageIcon size={18} className="text-gray-400" />
            </div>
            <p className="text-xs text-center">
              <span className="text-orange-500 font-medium">Click to upload</span> or drag & drop<br />
              <span className="text-gray-300">PNG, JPG, WEBP up to 5MB</span>
            </p>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
    </div>
  );
}
