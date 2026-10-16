import { randomUUID } from 'node:crypto';
import { getDatabasePool } from '@agent-place/db';

export type NotificationLevel = 'INFORMATIONAL' | 'IMPORTANT' | 'NEEDS_USER' | 'CRITICAL';
export type NotificationTargetType = 'routine' | 'job' | 'action' | 'worker' | 'wallet' | 'system';
export type NotificationPreviewDetail = 'full' | 'hide-amounts' | 'private';

export interface DurableNotification {
  id: string;
  level: NotificationLevel;
  title: string;
  summary: string;
  why: string;
  createdAt: string;
  readAt?: string;
  dismissedAt?: string;
  groupKey?: string;
  dedupeKey?: string;
  target?: { type: NotificationTargetType; id: string };
}

export interface NotificationPreferences {
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  timeZone: string;
  criticalBypassQuietHours: boolean;
  previewDetail: NotificationPreviewDetail;
}

type NotificationRow = {
  id: string;
  level: NotificationLevel;
  title: string;
  summary: string;
  why: string;
  target_type: NotificationTargetType | null;
  target_id: string | null;
  group_key: string | null;
  dedupe_key: string | null;
  created_at: Date;
  read_at: Date | null;
  dismissed_at: Date | null;
};

type PreferenceRow = {
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  time_zone: string;
  critical_bypass_quiet_hours: boolean;
  preview_detail: NotificationPreviewDetail;
};

function mapNotification(row: NotificationRow): DurableNotification {
  const out: DurableNotification = {
    id: row.id,
    level: row.level,
    title: row.title,
    summary: row.summary,
    why: row.why,
    createdAt: row.created_at.toISOString(),
  };
  if (row.read_at) out.readAt = row.read_at.toISOString();
  if (row.dismissed_at) out.dismissedAt = row.dismissed_at.toISOString();
  if (row.group_key) out.groupKey = row.group_key;
  if (row.dedupe_key) out.dedupeKey = row.dedupe_key;
  if (row.target_type && row.target_id) out.target = { type: row.target_type, id: row.target_id };
  return out;
}

function hhmm(value: string): string {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!match) throw new Error('INVALID_QUIET_HOURS_TIME');
  const hour = Number.parseInt(match[1] ?? '', 10);
  const minute = Number.parseInt(match[2] ?? '', 10);
  if (hour > 23 || minute > 59) throw new Error('INVALID_QUIET_HOURS_TIME');
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function validateTimeZone(value: string): string {
  const timeZone = value.trim();
  if (!timeZone || timeZone.length > 100) throw new Error('INVALID_TIME_ZONE');
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
  } catch {
    throw new Error('INVALID_TIME_ZONE');
  }
  return timeZone;
}

export async function listNotifications(ownerUserId: string, limit = 200): Promise<DurableNotification[]> {
  const bounded = Math.min(500, Math.max(1, limit));
  const result = await getDatabasePool().query<NotificationRow>(
    `SELECT id,level,title,summary,why,target_type,target_id,group_key,dedupe_key,created_at,read_at,dismissed_at
     FROM notification
     WHERE owner_user_id=$1 AND dismissed_at IS NULL
     ORDER BY created_at DESC,id DESC
     LIMIT $2`,
    [ownerUserId, bounded],
  );
  return result.rows.map(mapNotification);
}

export async function createNotification(args: {
  ownerUserId: string;
  level: NotificationLevel;
  title: string;
  summary: string;
  why: string;
  target?: { type: NotificationTargetType; id: string };
  groupKey?: string;
  dedupeKey?: string;
  id?: string;
}): Promise<DurableNotification> {
  const id = args.id ?? `ntf_${randomUUID()}`;
  const result = await getDatabasePool().query<NotificationRow>(
    `INSERT INTO notification(id,owner_user_id,level,title,summary,why,target_type,target_id,group_key,dedupe_key)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT(owner_user_id,dedupe_key) WHERE dedupe_key IS NOT NULL
     DO UPDATE SET title=EXCLUDED.title,summary=EXCLUDED.summary,why=EXCLUDED.why,level=EXCLUDED.level,
       target_type=EXCLUDED.target_type,target_id=EXCLUDED.target_id,group_key=EXCLUDED.group_key
     RETURNING id,level,title,summary,why,target_type,target_id,group_key,dedupe_key,created_at,read_at,dismissed_at`,
    [
      id,
      args.ownerUserId,
      args.level,
      args.title.slice(0, 240),
      args.summary.slice(0, 1000),
      args.why.slice(0, 1000),
      args.target?.type ?? null,
      args.target?.id ?? null,
      args.groupKey?.slice(0, 200) ?? null,
      args.dedupeKey?.slice(0, 240) ?? null,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error('NOTIFICATION_CREATE_FAILED');
  return mapNotification(row);
}

export async function markNotificationRead(ownerUserId: string, notificationId: string): Promise<DurableNotification | null> {
  const result = await getDatabasePool().query<NotificationRow>(
    `UPDATE notification SET read_at=COALESCE(read_at,now())
     WHERE owner_user_id=$1 AND id=$2 AND dismissed_at IS NULL
     RETURNING id,level,title,summary,why,target_type,target_id,group_key,dedupe_key,created_at,read_at,dismissed_at`,
    [ownerUserId, notificationId],
  );
  return result.rows[0] ? mapNotification(result.rows[0]) : null;
}

export async function markAllNotificationsRead(ownerUserId: string): Promise<number> {
  const result = await getDatabasePool().query(
    `UPDATE notification SET read_at=COALESCE(read_at,now()) WHERE owner_user_id=$1 AND dismissed_at IS NULL AND read_at IS NULL`,
    [ownerUserId],
  );
  return result.rowCount ?? 0;
}

export async function getNotificationPreferences(ownerUserId: string): Promise<NotificationPreferences> {
  const result = await getDatabasePool().query<PreferenceRow>(
    `SELECT quiet_hours_enabled,quiet_hours_start::text,quiet_hours_end::text,time_zone,critical_bypass_quiet_hours,preview_detail
     FROM notification_preference WHERE owner_user_id=$1`,
    [ownerUserId],
  );
  const row = result.rows[0];
  if (!row) {
    return {
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      timeZone: 'UTC',
      criticalBypassQuietHours: true,
      previewDetail: 'private',
    };
  }
  return {
    quietHoursEnabled: row.quiet_hours_enabled,
    quietHoursStart: row.quiet_hours_start.slice(0, 5),
    quietHoursEnd: row.quiet_hours_end.slice(0, 5),
    timeZone: row.time_zone,
    criticalBypassQuietHours: row.critical_bypass_quiet_hours,
    previewDetail: row.preview_detail,
  };
}

export async function updateNotificationPreferences(ownerUserId: string, patch: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
  const current = await getNotificationPreferences(ownerUserId);
  const next: NotificationPreferences = {
    quietHoursEnabled: patch.quietHoursEnabled ?? current.quietHoursEnabled,
    quietHoursStart: hhmm(patch.quietHoursStart ?? current.quietHoursStart),
    quietHoursEnd: hhmm(patch.quietHoursEnd ?? current.quietHoursEnd),
    timeZone: validateTimeZone(patch.timeZone ?? current.timeZone),
    criticalBypassQuietHours: patch.criticalBypassQuietHours ?? current.criticalBypassQuietHours,
    previewDetail: patch.previewDetail ?? current.previewDetail,
  };
  if (!['full', 'hide-amounts', 'private'].includes(next.previewDetail)) throw new Error('INVALID_NOTIFICATION_PREVIEW');
  await getDatabasePool().query(
    `INSERT INTO notification_preference(owner_user_id,quiet_hours_enabled,quiet_hours_start,quiet_hours_end,time_zone,critical_bypass_quiet_hours,preview_detail)
     VALUES($1,$2,$3::time,$4::time,$5,$6,$7)
     ON CONFLICT(owner_user_id) DO UPDATE SET quiet_hours_enabled=EXCLUDED.quiet_hours_enabled,
       quiet_hours_start=EXCLUDED.quiet_hours_start,quiet_hours_end=EXCLUDED.quiet_hours_end,time_zone=EXCLUDED.time_zone,
       critical_bypass_quiet_hours=EXCLUDED.critical_bypass_quiet_hours,preview_detail=EXCLUDED.preview_detail,updated_at=now()`,
    [ownerUserId, next.quietHoursEnabled, next.quietHoursStart, next.quietHoursEnd, next.timeZone, next.criticalBypassQuietHours, next.previewDetail],
  );
  return next;
}

export const moduleManifest = {
  name: 'notifications',
  layer: 'controlled-runtime',
  milestone: 11,
  status: 'durable-in-app-notifications-and-preferences',
} as const;
