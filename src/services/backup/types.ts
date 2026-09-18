export type BackupStatus = "SUCCESS" | "FAILED";
export type BackupTrigger = "manual" | "scheduled" | "deploy";
export type BackupMethod = "pg_dump" | "prisma_logical" | "pg_dump+logical";
export type BackupIntegrity = "verified" | "unverified" | "failed";

export type BackupManifest = {
  id: string;
  formatVersion: number;
  status: BackupStatus;
  method: BackupMethod | null;
  fileName: string | null;
  byteLength: number | null;
  checksumSha256: string | null;
  startedAt: string;
  completedAt: string | null;
  triggeredBy: BackupTrigger;
  integrity: BackupIntegrity;
  errorSafe: string | null;
  tableCounts: Record<string, number>;
  fileCount: number;
  landingFileCount: number;
  restoreTest: {
    at: string;
    ok: boolean;
    method: string;
    errorSafe: string | null;
  } | null;
};

export type PublicBackupRow = {
  id: string;
  status: BackupStatus;
  method: BackupMethod | null;
  byteLength: number | null;
  checksumSha256: string | null;
  startedAt: string;
  completedAt: string | null;
  ageHours: number | null;
  triggeredBy: BackupTrigger;
  integrity: BackupIntegrity;
  errorSafe: string | null;
  tableCount: number;
  fileCount: number;
  restoreTestOk: boolean | null;
  restoreTestAt: string | null;
};

export type BackupStorageStatus =
  | "READY"
  | "NOT_WRITABLE"
  | "EPHEMERAL_DEFAULT"
  | "COLOCATED_WITH_UPLOADS";

export type RecoveryStatus =
  | "READY"
  | "NO_VALID_BACKUP"
  | "BACKUP_STALE"
  | "DISABLED"
  | "STORAGE_UNAVAILABLE"
  | "INTEGRITY_FAILED";

export type BackupDashboard = {
  enabled: boolean;
  systemStatus: "ENABLED" | "DISABLED";
  storage: {
    kind: "local_directory";
    status: BackupStorageStatus;
    label: string;
    rootConfigured: boolean;
  };
  lastSuccess: PublicBackupRow | null;
  lastFailure: PublicBackupRow | null;
  retentionDays: number;
  intervalHours: number;
  rpoHours: number;
  rtoHours: number;
  rpoMet: boolean | null;
  lastRestoreTest: {
    at: string;
    backupId: string;
    ok: boolean;
    method: string;
    errorSafe?: string | null;
  } | null;
  recoveryStatus: RecoveryStatus;
  history: PublicBackupRow[];
  failures: PublicBackupRow[];
};
