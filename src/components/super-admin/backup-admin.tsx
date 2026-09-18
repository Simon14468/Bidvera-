"use client";

import {
  saRestoreTestBackup,
  saRunBackupNow,
  saSaveBackupSettings,
  saVerifyBackup,
} from "@/app/actions/super-admin";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { BackupDashboard } from "@/services/backup/types";

type Snapshot = BackupDashboard;
type Row = Snapshot["history"][number];

function tone(status: string) {
  if (status === "ENABLED" || status === "READY" || status === "SUCCESS" || status === "verified") {
    return "text-emerald-400";
  }
  if (status === "FAILED" || status === "NOT_WRITABLE" || status === "COLOCATED_WITH_UPLOADS" || status === "INTEGRITY_FAILED") {
    return "text-rose-400";
  }
  if (status === "DISABLED" || status === "unverified" || status === "EPHEMERAL_DEFAULT" || status === "BACKUP_STALE" || status === "NO_VALID_BACKUP") {
    return "text-amber-400";
  }
  return "text-slate-300";
}

function formatBytes(n: number | null) {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatWhen(iso: string | null | undefined) {
  if (!iso) return "Never";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function BackupAdminPanel({ initial }: { initial: Snapshot }) {
  const router = useRouter();
  const [snap, setSnap] = useState(initial);
  const [password, setPassword] = useState("");
  const [acknowledge, setAcknowledge] = useState(false);
  const [selectedId, setSelectedId] = useState(initial.history[0]?.id ?? "");
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [intervalHours, setIntervalHours] = useState(String(initial.intervalHours));
  const [retentionDays, setRetentionDays] = useState(String(initial.retentionDays));
  const [rpoHours, setRpoHours] = useState(String(initial.rpoHours));
  const [rtoHours, setRtoHours] = useState(String(initial.rtoHours));
  const [detail, setDetail] = useState<Row | null>(null);

  const selected = useMemo(
    () => snap.history.find((row) => row.id === selectedId) ?? snap.history[0] ?? null,
    [snap.history, selectedId],
  );

  function apply(next: Snapshot) {
    setSnap(next);
    setEnabled(next.enabled);
    setIntervalHours(String(next.intervalHours));
    setRetentionDays(String(next.retentionDays));
    setRpoHours(String(next.rpoHours));
    setRtoHours(String(next.rtoHours));
    if (next.history[0]) setSelectedId(next.history[0].id);
    router.refresh();
  }

  async function refreshFromServer() {
    const { saGetBackupDashboard } = await import("@/app/actions/super-admin");
    const r = await saGetBackupDashboard();
    if (r.ok) apply(r.data);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatusCard label="Backup system" value={snap.systemStatus} className={tone(snap.systemStatus)} />
        <StatusCard
          label="Recovery status"
          value={snap.recoveryStatus.replace(/_/g, " ")}
          className={tone(snap.recoveryStatus)}
        />
        <StatusCard
          label="Storage"
          value={snap.storage.status.replace(/_/g, " ")}
          hint={snap.storage.label}
          className={tone(snap.storage.status)}
        />
        <StatusCard
          label="RPO / RTO"
          value={`${snap.rpoHours}h / ${snap.rtoHours}h`}
          hint={
            snap.rpoMet == null
              ? "No successful backup yet"
              : snap.rpoMet
                ? "Last backup is within RPO"
                : "Last backup is older than RPO"
          }
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatusCard
          label="Last successful backup"
          value={formatWhen(snap.lastSuccess?.completedAt)}
          hint={
            snap.lastSuccess
              ? `${formatBytes(snap.lastSuccess.byteLength)} · integrity ${snap.lastSuccess.integrity} · age ${snap.lastSuccess.ageHours ?? "—"}h`
              : "No verified success recorded"
          }
        />
        <StatusCard
          label="Last failed backup"
          value={formatWhen(snap.lastFailure?.completedAt)}
          hint={snap.lastFailure?.errorSafe ?? "No failures recorded"}
          className={snap.lastFailure ? "text-rose-300" : undefined}
        />
        <StatusCard
          label="Last restore test"
          value={
            snap.lastRestoreTest
              ? `${snap.lastRestoreTest.ok ? "Passed" : "Failed"} · ${formatWhen(snap.lastRestoreTest.at)}`
              : "Never"
          }
          hint={snap.lastRestoreTest?.errorSafe ?? snap.lastRestoreTest?.method ?? "No restore test recorded"}
          className={
            snap.lastRestoreTest == null
              ? undefined
              : snap.lastRestoreTest.ok
                ? "text-emerald-400"
                : "text-rose-400"
          }
        />
      </div>

      <p className="text-sm text-slate-400">
        Retention: {snap.retentionDays} days · Schedule: every {snap.intervalHours} hours ·
        Provider: local encrypted directory (not the production database).
      </p>

      <div className="rounded-xl border border-slate-800 p-4 space-y-3">
        <p className="font-medium text-white">Operator confirmation</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Confirm Super Admin password"
          className="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending || !password}
            className="rounded-lg bg-emerald-700 px-3 py-2 text-sm disabled:opacity-50"
            onClick={() =>
              start(async () => {
                setError(null);
                setMessage(null);
                const r = await saRunBackupNow(password);
                if (!r.ok) {
                  setError(r.error.message);
                  return;
                }
                if (r.data.status !== "SUCCESS") {
                  setError(r.data.errorSafe ?? "Backup failed.");
                } else {
                  setMessage(`Backup ${r.data.id} completed and verified.`);
                }
                await refreshFromServer();
              })
            }
          >
            Run backup now
          </button>
          <button
            type="button"
            disabled={pending || !password || !selected}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm disabled:opacity-50"
            onClick={() =>
              start(async () => {
                if (!selected) return;
                setError(null);
                setMessage(null);
                const r = await saVerifyBackup(password, selected.id);
                if (!r.ok) {
                  setError(r.error.message);
                  return;
                }
                if (r.data.integrity !== "verified") {
                  setError(r.data.errorSafe ?? "Integrity verification failed.");
                } else {
                  setMessage(`Backup ${r.data.id} integrity verified.`);
                }
                await refreshFromServer();
              })
            }
          >
            Verify backup
          </button>
        </div>
        <label className="flex items-start gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={acknowledge}
            onChange={(e) => setAcknowledge(e.target.checked)}
            className="mt-1"
          />
          Restore test decrypts the archive into an isolated temp directory, checks recovery
          metadata, and — when BACKUP_RESTORE_DATABASE_URL is set — runs pg_restore into that
          isolated database only. It never restores into the production DATABASE_URL.
        </label>
        <button
          type="button"
          disabled={pending || !password || !acknowledge || !selected}
          className="rounded-lg border border-amber-700 px-3 py-2 text-sm text-amber-200 disabled:opacity-50"
          onClick={() =>
            start(async () => {
              if (!selected) return;
              setError(null);
              setMessage(null);
              const r = await saRestoreTestBackup({
                password,
                backupId: selected.id,
                acknowledge,
              });
              if (!r.ok) {
                setError(r.error.message);
                return;
              }
              if (!r.data.restoreTestOk) {
                setError("Restore test did not pass.");
              } else {
                setMessage(`Restore test passed for ${r.data.id}.`);
              }
              await refreshFromServer();
            })
          }
        >
          Run restore test
        </button>
      </div>

      <form
        className="rounded-xl border border-slate-800 p-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            setError(null);
            setMessage(null);
            const r = await saSaveBackupSettings(password, {
              enabled,
              intervalHours: Number(intervalHours),
              retentionDays: Number(retentionDays),
              rpoHours: Number(rpoHours),
              rtoHours: Number(rtoHours),
            });
            if (!r.ok) {
              setError(r.error.message);
              return;
            }
            setMessage("Backup settings saved.");
            await refreshFromServer();
          });
        }}
      >
        <p className="font-medium text-white">Retention and recovery targets</p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enable scheduled backups
        </label>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Interval (hours)" value={intervalHours} onChange={setIntervalHours} />
          <Field label="Retention (days)" value={retentionDays} onChange={setRetentionDays} />
          <Field label="RPO (hours)" value={rpoHours} onChange={setRpoHours} />
          <Field label="RTO (hours)" value={rtoHours} onChange={setRtoHours} />
        </div>
        <button
          type="submit"
          disabled={pending || !password}
          className="rounded-lg bg-emerald-700 px-3 py-2 text-sm disabled:opacity-50"
        >
          Save settings
        </button>
      </form>

      <section className="space-y-2">
        <h2 className="text-lg font-medium text-white">Recent backup history</h2>
        <BackupTable
          rows={snap.history}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onDetail={setDetail}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium text-white">Recent failures</h2>
        {snap.failures.length === 0 ? (
          <p className="text-sm text-slate-500">No failed backups recorded on this host.</p>
        ) : (
          <BackupTable
            rows={snap.failures}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDetail={setDetail}
          />
        )}
      </section>

      {detail ? (
        <div className="rounded-xl border border-slate-800 p-4 text-sm text-slate-300 space-y-1">
          <p className="font-medium text-white">Backup {detail.id}</p>
          <p>Status: {detail.status}</p>
          <p>Method: {detail.method ?? "—"}</p>
          <p>Integrity: {detail.integrity}</p>
          <p>Size: {formatBytes(detail.byteLength)}</p>
          <p>Checksum: {detail.checksumSha256 ?? "—"}</p>
          <p>Tables: {detail.tableCount} · Files: {detail.fileCount}</p>
          <p>Trigger: {detail.triggeredBy}</p>
          <p>Error: {detail.errorSafe ?? "—"}</p>
          <button type="button" className="text-emerald-400" onClick={() => setDetail(null)}>
            Close
          </button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-400">{message}</p> : null}
    </div>
  );
}

function StatusCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-medium ${className ?? "text-white"}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm text-slate-300">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
      />
    </label>
  );
}

function BackupTable({
  rows,
  selectedId,
  onSelect,
  onDetail,
}: {
  rows: Row[];
  selectedId: string;
  onSelect: (id: string) => void;
  onDetail: (row: Row) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No backup records yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-900 text-slate-400">
          <tr>
            <th className="px-3 py-2">When</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Integrity</th>
            <th className="px-3 py-2">Size</th>
            <th className="px-3 py-2">Method</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={row.id === selectedId ? "bg-slate-900/80" : "border-t border-slate-800"}
            >
              <td className="px-3 py-2">
                <button type="button" onClick={() => onSelect(row.id)} className="text-left">
                  {formatWhen(row.completedAt ?? row.startedAt)}
                </button>
              </td>
              <td className={`px-3 py-2 ${tone(row.status)}`}>{row.status}</td>
              <td className={`px-3 py-2 ${tone(row.integrity)}`}>{row.integrity}</td>
              <td className="px-3 py-2">{formatBytes(row.byteLength)}</td>
              <td className="px-3 py-2 text-slate-400">{row.method ?? "—"}</td>
              <td className="px-3 py-2">
                <button type="button" className="text-emerald-400" onClick={() => onDetail(row)}>
                  Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
