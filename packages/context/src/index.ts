import { getDatabasePool, withTransaction, type SqlExecutor } from '@agent-place/db';

export type ConversationScope = 'manager' | 'worker' | 'job';
export type ConversationTitleSource = 'auto' | 'user';
export type ConversationRole = 'user' | 'manager' | 'specialist';

export interface DurableConversationMessage {
  id: string;
  role: ConversationRole;
  specialist?: { name: string; role: string };
  content: string;
  uiCard?: string;
  jobId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DurableConversation {
  id: string;
  scope: ConversationScope;
  workerId?: string;
  jobId?: string;
  title: string;
  titleSource: ConversationTitleSource;
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  messages: DurableConversationMessage[];
}

export interface ConversationDraft extends Omit<DurableConversation, 'updatedAt' | 'lastActivityAt'> {
  updatedAt?: string;
  lastActivityAt?: string;
}

export interface ConversationPatch {
  title?: string;
  titleSource?: ConversationTitleSource;
  pinned?: boolean;
  archived?: boolean;
}

type ConversationRow = {
  id: string;
  scope: ConversationScope;
  worker_id: string | null;
  job_id: string | null;
  title: string;
  title_source: ConversationTitleSource;
  pinned: boolean;
  archived: boolean;
  created_at: Date;
  updated_at: Date;
  last_activity_at: Date;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  role: ConversationRole;
  specialist_name: string | null;
  specialist_role: string | null;
  content: string;
  ui_card: string | null;
  job_id: string | null;
  created_at: Date;
  updated_at: Date;
};

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapMessage(row: MessageRow): DurableConversationMessage {
  const message: DurableConversationMessage = {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
  if (row.specialist_name && row.specialist_role) message.specialist = { name: row.specialist_name, role: row.specialist_role };
  if (row.ui_card) message.uiCard = row.ui_card;
  if (row.job_id) message.jobId = row.job_id;
  return message;
}

function mapConversation(row: ConversationRow, messages: DurableConversationMessage[]): DurableConversation {
  const conversation: DurableConversation = {
    id: row.id,
    scope: row.scope,
    title: row.title,
    titleSource: row.title_source,
    pinned: row.pinned,
    archived: row.archived,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    lastActivityAt: iso(row.last_activity_at),
    messages,
  };
  if (row.worker_id) conversation.workerId = row.worker_id;
  if (row.job_id) conversation.jobId = row.job_id;
  return conversation;
}

async function loadMessages(db: SqlExecutor, conversationIds: readonly string[]): Promise<Map<string, DurableConversationMessage[]>> {
  if (conversationIds.length === 0) return new Map();
  const result = await db.query<MessageRow>(
    `SELECT id, conversation_id, role, specialist_name, specialist_role, content, ui_card, job_id, created_at, updated_at
     FROM conversation_message
     WHERE conversation_id = ANY($1::text[])
     ORDER BY created_at ASC, id ASC`,
    [conversationIds],
  );
  const byConversation = new Map<string, DurableConversationMessage[]>();
  for (const row of result.rows) {
    const list = byConversation.get(row.conversation_id) ?? [];
    list.push(mapMessage(row));
    byConversation.set(row.conversation_id, list);
  }
  return byConversation;
}

export async function listConversations(ownerUserId: string, query?: string): Promise<DurableConversation[]> {
  const q = query?.trim() || null;
  const result = await getDatabasePool().query<ConversationRow>(
    `SELECT c.id, c.scope, c.worker_id, c.job_id, c.title, c.title_source, c.pinned, c.archived,
            c.created_at, c.updated_at, c.last_activity_at
     FROM conversation c
     WHERE c.owner_user_id = $1
       AND (
         $2::text IS NULL
         OR c.title ILIKE '%' || $2 || '%'
         OR similarity(c.title, $2) >= 0.22
         OR EXISTS (
           SELECT 1 FROM conversation_message m
           WHERE m.conversation_id = c.id
             AND (m.content ILIKE '%' || $2 || '%' OR similarity(m.content, $2) >= 0.18)
         )
       )
     ORDER BY c.pinned DESC, c.last_activity_at DESC`,
    [ownerUserId, q],
  );
  const messages = await loadMessages(getDatabasePool(), result.rows.map((row) => row.id));
  return result.rows.map((row) => mapConversation(row, messages.get(row.id) ?? []));
}

export async function getConversation(ownerUserId: string, id: string): Promise<DurableConversation | null> {
  const result = await getDatabasePool().query<ConversationRow>(
    `SELECT id, scope, worker_id, job_id, title, title_source, pinned, archived, created_at, updated_at, last_activity_at
     FROM conversation WHERE id = $1 AND owner_user_id = $2`,
    [id, ownerUserId],
  );
  const row = result.rows[0];
  if (!row) return null;
  const messages = await loadMessages(getDatabasePool(), [id]);
  return mapConversation(row, messages.get(id) ?? []);
}

async function insertConversation(db: SqlExecutor, ownerUserId: string, draft: ConversationDraft): Promise<void> {
  await db.query(
    `INSERT INTO conversation (
       id, owner_user_id, scope, worker_id, job_id, title, title_source, pinned, archived, created_at, updated_at, last_activity_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)
     ON CONFLICT (id) DO NOTHING`,
    [
      draft.id,
      ownerUserId,
      draft.scope,
      draft.workerId ?? null,
      draft.jobId ?? null,
      draft.title,
      draft.titleSource,
      draft.pinned,
      draft.archived,
      draft.createdAt,
      draft.updatedAt ?? draft.createdAt,
    ],
  );
  const ownerCheck = await db.query<{ owner_user_id: string }>('SELECT owner_user_id FROM conversation WHERE id = $1', [draft.id]);
  if (ownerCheck.rows[0]?.owner_user_id !== ownerUserId) throw new Error('CONVERSATION_ID_CONFLICT');
}

async function upsertMessage(db: SqlExecutor, conversationId: string, message: DurableConversationMessage): Promise<void> {
  await db.query(
    `INSERT INTO conversation_message (
       id, conversation_id, role, specialist_name, specialist_role, content, ui_card, job_id, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (id) DO UPDATE SET
       content = EXCLUDED.content,
       specialist_name = EXCLUDED.specialist_name,
       specialist_role = EXCLUDED.specialist_role,
       ui_card = EXCLUDED.ui_card,
       job_id = EXCLUDED.job_id,
       updated_at = EXCLUDED.updated_at
     WHERE conversation_message.conversation_id = EXCLUDED.conversation_id`,
    [
      message.id,
      conversationId,
      message.role,
      message.specialist?.name ?? null,
      message.specialist?.role ?? null,
      message.content,
      message.uiCard ?? null,
      message.jobId ?? null,
      message.createdAt,
      message.updatedAt,
    ],
  );
  await db.query('UPDATE conversation SET last_activity_at = GREATEST(last_activity_at, $2), updated_at = now() WHERE id = $1', [conversationId, message.updatedAt]);
}


async function ensureConversationMetadata(db: SqlExecutor, ownerUserId: string, draft: ConversationDraft): Promise<void> {
  await db.query(
    `INSERT INTO conversation_participant (conversation_id, participant_type, participant_id)
     VALUES ($1, 'user', $2), ($1, 'agentplace', 'manager')
     ON CONFLICT DO NOTHING`,
    [draft.id, ownerUserId],
  );
  if (draft.workerId) {
    await db.query(
      `INSERT INTO conversation_participant (conversation_id, participant_type, participant_id)
       VALUES ($1, 'worker', $2) ON CONFLICT DO NOTHING`,
      [draft.id, draft.workerId],
    );
    await db.query(
      `INSERT INTO conversation_object_link (conversation_id, object_type, object_id, relation)
       SELECT $1, 'worker', $2, 'scope'
       WHERE NOT EXISTS (
         SELECT 1 FROM conversation_object_link
         WHERE conversation_id=$1 AND object_type='worker' AND object_id=$2 AND relation='scope'
       )`,
      [draft.id, draft.workerId],
    );
  }
  if (draft.jobId) {
    await db.query(
      `INSERT INTO conversation_object_link (conversation_id, object_type, object_id, relation)
       SELECT $1, 'job', $2, 'scope'
       WHERE NOT EXISTS (
         SELECT 1 FROM conversation_object_link
         WHERE conversation_id=$1 AND object_type='job' AND object_id=$2 AND relation='scope'
       )`,
      [draft.id, draft.jobId],
    );
  }
}

export async function createConversation(ownerUserId: string, draft: ConversationDraft): Promise<DurableConversation> {
  await withTransaction(async (client) => {
    await insertConversation(client, ownerUserId, draft);
    for (const message of draft.messages) await upsertMessage(client, draft.id, message);
    await ensureConversationMetadata(client, ownerUserId, draft);
  });
  const created = await getConversation(ownerUserId, draft.id);
  if (!created) throw new Error('CONVERSATION_CREATE_FAILED');
  return created;
}

export async function importConversations(ownerUserId: string, drafts: readonly ConversationDraft[]): Promise<DurableConversation[]> {
  await withTransaction(async (client) => {
    for (const draft of drafts) {
      await insertConversation(client, ownerUserId, draft);
      await client.query(
        `UPDATE conversation SET
           title = CASE WHEN title_source = 'user' THEN title ELSE $3 END,
           title_source = CASE WHEN title_source = 'user' THEN title_source ELSE $4 END,
           pinned = $5,
           archived = $6,
           updated_at = GREATEST(updated_at, $7::timestamptz),
           last_activity_at = GREATEST(last_activity_at, $7::timestamptz)
         WHERE id = $1 AND owner_user_id = $2`,
        [draft.id, ownerUserId, draft.title, draft.titleSource, draft.pinned, draft.archived, draft.updatedAt ?? draft.createdAt],
      );
      for (const message of draft.messages) await upsertMessage(client, draft.id, message);
      await ensureConversationMetadata(client, ownerUserId, draft);
    }
  });
  return listConversations(ownerUserId);
}

export async function patchConversation(ownerUserId: string, id: string, patch: ConversationPatch): Promise<DurableConversation | null> {
  const current = await getConversation(ownerUserId, id);
  if (!current) return null;
  const title = patch.title ?? current.title;
  const requestedSource = patch.titleSource ?? current.titleSource;
  const titleSource = current.titleSource === 'user' && requestedSource === 'auto' ? 'user' : requestedSource;
  const effectiveTitle = current.titleSource === 'user' && requestedSource === 'auto' ? current.title : title;
  await getDatabasePool().query(
    `UPDATE conversation SET title=$3, title_source=$4, pinned=$5, archived=$6, updated_at=now()
     WHERE id=$1 AND owner_user_id=$2`,
    [id, ownerUserId, effectiveTitle, titleSource, patch.pinned ?? current.pinned, patch.archived ?? current.archived],
  );
  return getConversation(ownerUserId, id);
}

export async function addMessage(ownerUserId: string, conversationId: string, message: DurableConversationMessage): Promise<DurableConversationMessage | null> {
  const conversation = await getConversation(ownerUserId, conversationId);
  if (!conversation) return null;
  await upsertMessage(getDatabasePool(), conversationId, message);
  const refreshed = await getConversation(ownerUserId, conversationId);
  return refreshed?.messages.find((item) => item.id === message.id) ?? null;
}

export async function patchMessage(
  ownerUserId: string,
  conversationId: string,
  messageId: string,
  updates: Pick<DurableConversationMessage, 'content' | 'updatedAt'>,
): Promise<boolean> {
  const result = await getDatabasePool().query(
    `UPDATE conversation_message m SET content=$4, updated_at=$5
     FROM conversation c
     WHERE m.id=$1 AND m.conversation_id=$2 AND c.id=m.conversation_id AND c.owner_user_id=$3`,
    [messageId, conversationId, ownerUserId, updates.content, updates.updatedAt],
  );
  if (!result.rowCount) return false;
  await getDatabasePool().query('UPDATE conversation SET last_activity_at=$2, updated_at=now() WHERE id=$1 AND owner_user_id=$3', [conversationId, updates.updatedAt, ownerUserId]);
  return true;
}
