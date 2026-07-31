import type {
  ChatsRow,
  MediaKind,
  MessageMediaRow,
  MessagesRow,
  UsersRow,
} from './database.types';

export type Member = UsersRow;

export interface ChatListItem {
  id: string;
  type: ChatsRow['type'];
  title: string;
  avatarMembers: Member[]; // 1 for dm, up to 3 for group stack
  lastMessagePreview: string;
  lastMessageAt: string | null;
  unreadCount: number;
  muted: boolean;
  archived: boolean;
}

export interface MessageWithMedia extends MessagesRow {
  media: MessageMediaRow[];
  sender?: Member;
  readByOthers?: boolean;
}

export interface AttachmentDraft {
  localUri: string;
  kind: MediaKind;
  width?: number;
  height?: number;
  durationSeconds?: number;
}
