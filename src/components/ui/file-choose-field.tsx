"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { FileUp, UploadCloud, X } from "lucide-react";
import { useId, useRef, useState } from "react";

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function assignInputFiles(input: HTMLInputElement, files: File[]) {
  const dt = new DataTransfer();
  for (const f of files) dt.items.add(f);
  input.files = dt.files;
}

export type FileChooseFieldProps = {
  name?: string;
  accept?: string;
  multiple?: boolean;
  required?: boolean;
  disabled?: boolean;
  /** Show indeterminate upload animation */
  uploading?: boolean;
  label?: string;
  title?: string;
  hint?: string;
  chooseLabel?: string;
  uploadingLabel?: string;
  /** full dashed dropzone (default) or compact button row */
  variant?: "dropzone" | "compact";
  /** App surfaces vs Super Admin dark panels */
  tone?: "app" | "admin";
  className?: string;
  id?: string;
  onFilesChange?: (files: File[]) => void;
};

/**
 * Professional file picker used across Bidvera upload surfaces.
 * Keeps a real named &lt;input type="file"&gt; so native FormData still works.
 */
export function FileChooseField({
  name,
  accept,
  multiple = false,
  required = false,
  disabled = false,
  uploading = false,
  label,
  title = "Drag & drop your file here",
  hint,
  chooseLabel = "Choose file",
  uploadingLabel = "Uploading…",
  variant = "dropzone",
  tone = "app",
  className,
  id: idProp,
  onFilesChange,
}: FileChooseFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const busy = disabled || uploading;
  const isAdmin = tone === "admin";

  function commit(list: FileList | File[] | null) {
    const next = list ? Array.from(list) : [];
    const picked = multiple ? next : next.slice(0, 1);
    setFiles(picked);
    if (inputRef.current) assignInputFiles(inputRef.current, picked);
    onFilesChange?.(picked);
  }

  function clear() {
    setFiles([]);
    if (inputRef.current) {
      inputRef.current.value = "";
      assignInputFiles(inputRef.current, []);
    }
    onFilesChange?.([]);
  }

  const borderIdle = isAdmin
    ? "border-slate-600 bg-slate-950/60"
    : "border-border bg-background";
  const borderActive = isAdmin
    ? "scale-[1.01] border-emerald-500 bg-emerald-500/10"
    : "scale-[1.01] border-primary bg-primary-muted";
  const titleCls = isAdmin ? "text-slate-100" : "text-foreground";
  const mutedCls = isAdmin ? "text-slate-400" : "text-muted";
  const cardCls = isAdmin
    ? "border-slate-700 bg-slate-900"
    : "border-border bg-card";
  const iconCls = isAdmin ? "text-emerald-400" : "text-primary";

  const chooseButton = (
    <Button
      type="button"
      variant={isAdmin ? "secondary" : "outline"}
      size={variant === "compact" ? "sm" : "md"}
      disabled={busy}
      className={cn(
        isAdmin &&
          "border border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700",
      )}
      onClick={() => inputRef.current?.click()}
    >
      <UploadCloud className="size-4" aria-hidden />
      {chooseLabel}
    </Button>
  );

  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <label htmlFor={id} className={cn("text-sm font-medium", titleCls)}>
          {label}
        </label>
      ) : null}

      <input
        ref={inputRef}
        id={id}
        type="file"
        {...(name ? { name } : {})}
        accept={accept}
        multiple={multiple}
        required={required && files.length === 0}
        disabled={busy}
        className="sr-only"
        onChange={(e) => commit(e.target.files)}
      />

      {variant === "compact" ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {chooseButton}
            {uploading ? (
              <span className={cn("text-xs", mutedCls)}>{uploadingLabel}</span>
            ) : null}
          </div>
          {files.length > 0 ? (
            <SelectedFiles
              files={files}
              uploading={uploading}
              uploadingLabel={uploadingLabel}
              cardCls={cardCls}
              iconCls={iconCls}
              mutedCls={mutedCls}
              titleCls={titleCls}
              onClear={busy ? undefined : clear}
            />
          ) : null}
        </div>
      ) : null}

      {variant === "dropzone" && files.length === 0 && !uploading ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (!busy) commit(e.dataTransfer.files);
          }}
          className={cn(
            "flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center transition-all duration-200",
            dragOver ? borderActive : borderIdle,
          )}
        >
          <UploadCloud
            className={cn(
              "size-8 transition-transform duration-300",
              iconCls,
              dragOver && "-translate-y-0.5",
            )}
            aria-hidden
          />
          <p className={cn("mt-3 text-sm font-medium", titleCls)}>{title}</p>
          {hint ? <p className={cn("mt-1 text-xs", mutedCls)}>{hint}</p> : null}
          <div className="mt-5">{chooseButton}</div>
        </div>
      ) : null}

      {variant === "dropzone" && (files.length > 0 || uploading) ? (
        <div className="animate-fade-in space-y-3">
          <SelectedFiles
            files={files}
            uploading={uploading}
            uploadingLabel={uploadingLabel}
            cardCls={cardCls}
            iconCls={iconCls}
            mutedCls={mutedCls}
            titleCls={titleCls}
            onClear={busy ? undefined : clear}
          />
          {uploading ? (
            <div className="space-y-1.5" aria-live="polite">
              <p className={cn("text-sm", mutedCls)}>{uploadingLabel}</p>
              <div
                className={cn(
                  "h-2 w-full overflow-hidden rounded-full",
                  isAdmin ? "bg-slate-700" : "bg-border/70",
                )}
                role="progressbar"
                aria-label="Upload progress"
              >
                <div
                  className={cn(
                    "h-full w-1/3 rounded-full animate-upload-indeterminate",
                    isAdmin ? "bg-emerald-500" : "bg-primary",
                  )}
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SelectedFiles({
  files,
  uploading,
  uploadingLabel,
  cardCls,
  iconCls,
  mutedCls,
  titleCls,
  onClear,
}: {
  files: File[];
  uploading: boolean;
  uploadingLabel: string;
  cardCls: string;
  iconCls: string;
  mutedCls: string;
  titleCls: string;
  onClear?: () => void;
}) {
  if (files.length === 0) return null;
  return (
    <ul className="space-y-2">
      {files.map((file) => (
        <li
          key={`${file.name}-${file.size}-${file.lastModified}`}
          className={cn(
            "flex items-center gap-3 rounded-xl border px-3 py-3 text-sm",
            cardCls,
          )}
        >
          <FileUp className={cn("size-4 shrink-0", iconCls)} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className={cn("truncate font-medium", titleCls)}>{file.name}</p>
            <p className={cn("text-xs", mutedCls)}>
              {formatBytes(file.size)}
              {uploading ? ` · ${uploadingLabel}` : ""}
            </p>
          </div>
          {onClear ? (
            <button
              type="button"
              className={cn(
                "rounded-lg p-1 transition hover:opacity-80",
                mutedCls,
              )}
              aria-label="Remove file"
              onClick={onClear}
            >
              <X className="size-4" />
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
