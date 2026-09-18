"use client";

import {
  cancelEmailChange,
  removeUserAvatarAction,
  resendEmailChange,
  updateAccountProfile,
  uploadUserAvatarAction,
} from "@/app/actions";
import { CompanyAvatar } from "@/components/brand/company-avatar";
import { Button } from "@/components/ui/button";
import { FileChooseField } from "@/components/ui/file-choose-field";
import { Input } from "@/components/ui/input";
import type { Dictionary } from "@/i18n/dictionaries";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type SettingsCopy = Dictionary["app"]["settings"];

export function AccountProfileForm({
  initialName,
  initialEmail,
  initialAvatarUrl,
  pendingEmail,
  pendingExpiresAt,
  copy,
}: {
  initialName: string;
  initialEmail: string;
  initialAvatarUrl: string | null;
  pendingEmail: string | null;
  pendingExpiresAt: string | null;
  copy: SettingsCopy;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [currentPassword, setCurrentPassword] = useState("");
  const [preview, setPreview] = useState<string | null>(initialAvatarUrl);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [pendingChange, setPendingChange] = useState(pendingEmail);
  const [expiresAt, setExpiresAt] = useState(pendingExpiresAt);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const emailDirty = email.trim().toLowerCase() !== initialEmail.trim().toLowerCase();
  const dirty =
    name.trim() !== initialName.trim() ||
    emailDirty ||
    pendingFile !== null ||
    removeAvatar;

  const expiryLabel = useMemo(() => {
    if (!expiresAt) return null;
    const d = new Date(expiresAt);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString();
  }, [expiresAt]);

  function onPick(file: File | null) {
    if (!file) return;
    setError(null);
    setMessage(null);
    setPendingFile(file);
    setRemoveAvatar(false);
    setPreview(URL.createObjectURL(file));
  }

  function onRemoveAvatar() {
    setError(null);
    setMessage(null);
    setPendingFile(null);
    setRemoveAvatar(true);
    setPreview(null);
  }

  function onSave() {
    setError(null);
    setMessage(null);
    if (emailDirty && !currentPassword) {
      setError(copy.emailChangePasswordRequired);
      return;
    }
    startTransition(async () => {
      if (pendingFile) {
        const fd = new FormData();
        fd.set("file", pendingFile);
        const upload = await uploadUserAvatarAction(fd);
        if (!upload.ok) {
          setError(upload.error.message);
          return;
        }
        setPreview(upload.data.url);
        setPendingFile(null);
      } else if (removeAvatar) {
        const removed = await removeUserAvatarAction();
        if (!removed.ok) {
          setError(removed.error.message);
          return;
        }
        setRemoveAvatar(false);
        setPreview(null);
      }

      const result = await updateAccountProfile({
        name,
        email,
        currentPassword: emailDirty ? currentPassword : undefined,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      setCurrentPassword("");
      if (result.data.emailChange?.status === "pending") {
        setPendingChange(result.data.emailChange.newEmail);
        setExpiresAt(result.data.emailChange.expiresAt);
        setMessage(
          copy.emailChangeSent.replaceAll("{email}", result.data.emailChange.newEmail),
        );
        setEmail(initialEmail);
      } else {
        setMessage(copy.accountSaved);
      }
      router.refresh();
    });
  }

  function onCancelEmailChange() {
    setError(null);
    startTransition(async () => {
      const result = await cancelEmailChange();
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setPendingChange(null);
      setExpiresAt(null);
      setMessage(copy.emailChangeCancelled);
      router.refresh();
    });
  }

  function onResendEmailChange() {
    setError(null);
    startTransition(async () => {
      const result = await resendEmailChange();
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setPendingChange(result.data.newEmail);
      setExpiresAt(result.data.expiresAt);
      setMessage(
        copy.emailChangeResent.replaceAll("{email}", result.data.newEmail),
      );
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 sm:col-span-2">
      <div className="flex flex-col gap-3 sm:col-span-2">
        <div className="flex flex-wrap items-center gap-4">
          <CompanyAvatar
            size={56}
            className="rounded-xl"
            src={preview}
            alt={name}
          />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-medium text-foreground">{copy.avatarLabel}</p>
            <p className="text-xs text-muted">{copy.avatarHint}</p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <FileChooseField
                accept="image/jpeg,image/png,image/webp,image/gif"
                variant="compact"
                disabled={pending}
                chooseLabel={copy.avatarUpload}
                onFilesChange={(files) => onPick(files[0] ?? null)}
              />
              {preview || initialAvatarUrl ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={onRemoveAvatar}
                >
                  {copy.avatarRemove}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <Input
        label={copy.name}
        name="name"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setMessage(null);
        }}
        autoComplete="name"
        disabled={pending}
      />
      <Input
        label={copy.email}
        name="email"
        type="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setMessage(null);
        }}
        autoComplete="email"
        disabled={pending}
        hint={
          pendingChange
            ? [
                copy.emailChangePending.replaceAll("{email}", pendingChange),
                expiryLabel
                  ? copy.emailChangeExpires.replaceAll("{when}", expiryLabel)
                  : null,
              ]
                .filter(Boolean)
                .join(" ")
            : copy.emailChangeHint
        }
      />

      {emailDirty ? (
        <div className="sm:col-span-2">
          <Input
            label={copy.emailChangePasswordLabel}
            name="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            disabled={pending}
            hint={copy.emailChangePasswordHint}
          />
        </div>
      ) : null}

      {pendingChange ? (
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onResendEmailChange}
          >
            {copy.emailChangeResend}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onCancelEmailChange}
          >
            {copy.emailChangeCancel}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="button" disabled={pending || !dirty} onClick={onSave}>
          {pending ? copy.accountSaving : copy.accountSave}
        </Button>
        {message ? (
          <p className="text-sm text-muted" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
