// Hand-authored types mirroring supabase/migrations/0001_init.sql.
// Regenerate with `supabase gen types typescript` once the project is linked, if desired.

export type UserRole = 'admin' | 'member';
export type ChatType = 'dm' | 'group';
export type MediaKind = 'photo' | 'video' | 'document' | 'gif' | 'sticker';
export type StatusType = 'text' | 'photo' | 'video';

export type UsersRow = {
  id: string;
  phone: string | null;
  display_name: string;
  avatar_url: string | null;
  email: string | null;
  role: UserRole;
  is_online: boolean;
  last_seen_at: string | null;
  show_read_receipts: boolean;
  push_token: string | null;
  onboarding_completed: boolean;
  created_at: string;
  pin_hash: string | null;
  theme_accent: string | null;
  public_key: string | null;
  key_updated_at: string | null;
  deleted_at: string | null;
  notify_messages: boolean;
  notify_media: boolean;
  notify_reactions: boolean;
  media_autodownload: 'always' | 'never';
}

export type ChatsRow = {
  id: string;
  type: ChatType;
  name: string | null;
  avatar_url: string | null;
  created_by: string | null;
  created_at: string;
  pinned_message_id: string | null;
}

export type ChatMembersRow = {
  chat_id: string;
  user_id: string;
  joined_at: string;
  muted: boolean;
  archived: boolean;
  last_read_message_id: string | null;
  cleared_at: string | null;
  wallpaper_path: string | null;
  favorite: boolean;
}

export type MessagesRow = {
  id: string;
  chat_id: string;
  sender_id: string;
  body: string | null;
  created_at: string;
  deleted_at: string | null;
  location_share_id: string | null;
  reply_to_message_id: string | null;
  enc_v: number | null;
  key_id: string | null;
  ciphertext: string | null;
}

export type MessageMediaRow = {
  id: string;
  message_id: string;
  kind: MediaKind;
  storage_path: string;
  thumbnail_path: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
  wrapped_key: string | null;
}

export type ChatKeysRow = {
  id: string;
  chat_id: string;
  created_at: string;
  retired_at: string | null;
}

export type ChatKeyMembersRow = {
  key_id: string;
  user_id: string;
  wrapped_key: string;
  created_at: string;
}

export type HouseholdKeysRow = {
  id: string;
  created_at: string;
  retired_at: string | null;
}

export type HouseholdKeyMembersRow = {
  key_id: string;
  user_id: string;
  wrapped_key: string;
  created_at: string;
}

export type LiveLocationDuration = '15m' | '24h' | 'until_stopped';

export type LiveLocationsRow = {
  id: string;
  chat_id: string;
  user_id: string;
  lat: number;
  lng: number;
  started_at: string;
  expires_at: string | null;
  stopped_at: string | null;
  updated_at: string;
}

export type MessageReadsRow = {
  message_id: string;
  user_id: string;
  read_at: string;
}

export type MessageStarsRow = {
  message_id: string;
  user_id: string;
  starred_at: string;
}

export type BroadcastListsRow = {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
}

export type BroadcastListMembersRow = {
  list_id: string;
  member_id: string;
  added_at: string;
}

export type BroadcastSendsRow = {
  id: string;
  sender_id: string;
  list_id: string | null;
  created_at: string;
}

export type BroadcastSendTargetsRow = {
  send_id: string;
  recipient_id: string;
  chat_id: string;
  message_id: string;
}

export type MessageReactionsRow = {
  message_id: string;
  user_id: string;
  emoji: string;
  reacted_at: string;
}

export type StatusesRow = {
  id: string;
  user_id: string;
  type: StatusType;
  text_content: string | null;
  background_color: string | null;
  storage_path: string | null;
  thumbnail_path: string | null;
  created_at: string;
  expires_at: string;
}

export type StatusViewsRow = {
  status_id: string;
  viewer_id: string;
  viewed_at: string;
}

export type ChatListRow = {
  chat_id: string;
  type: ChatType;
  name: string | null;
  avatar_url: string | null;
  last_message_id: string | null;
  last_message_body: string | null;
  last_message_at: string | null;
  last_message_sender_id: string | null;
  last_message_has_media: boolean;
  last_message_deleted: boolean;
  last_message_enc_v: number | null;
  last_message_key_id: string | null;
  last_message_ciphertext: string | null;
  unread_count: number;
  muted: boolean;
  archived: boolean;
  favorite: boolean;
}

interface Relationships {
  Relationships: [];
}

export interface Database {
  public: {
    Views: Record<string, never>;
    Tables: {
      users: {
        Row: UsersRow;
        Insert: Partial<UsersRow>;
        Update: Partial<UsersRow>;
      } & Relationships;
      chats: {
        Row: ChatsRow;
        Insert: Partial<ChatsRow>;
        Update: Partial<ChatsRow>;
      } & Relationships;
      chat_members: {
        Row: ChatMembersRow;
        Insert: Partial<ChatMembersRow>;
        Update: Partial<ChatMembersRow>;
      } & Relationships;
      messages: {
        Row: MessagesRow;
        Insert: Partial<MessagesRow>;
        Update: Partial<MessagesRow>;
      } & Relationships;
      message_media: {
        Row: MessageMediaRow;
        Insert: Partial<MessageMediaRow>;
        Update: Partial<MessageMediaRow>;
      } & Relationships;
      message_reads: {
        Row: MessageReadsRow;
        Insert: Partial<MessageReadsRow>;
        Update: Partial<MessageReadsRow>;
      } & Relationships;
      message_stars: {
        Row: MessageStarsRow;
        Insert: Partial<MessageStarsRow>;
        Update: Partial<MessageStarsRow>;
      } & Relationships;
      broadcast_lists: {
        Row: BroadcastListsRow;
        Insert: Partial<BroadcastListsRow>;
        Update: Partial<BroadcastListsRow>;
      } & Relationships;
      broadcast_list_members: {
        Row: BroadcastListMembersRow;
        Insert: Partial<BroadcastListMembersRow>;
        Update: Partial<BroadcastListMembersRow>;
      } & Relationships;
      broadcast_sends: {
        Row: BroadcastSendsRow;
        Insert: Partial<BroadcastSendsRow>;
        Update: Partial<BroadcastSendsRow>;
      } & Relationships;
      broadcast_send_targets: {
        Row: BroadcastSendTargetsRow;
        Insert: Partial<BroadcastSendTargetsRow>;
        Update: Partial<BroadcastSendTargetsRow>;
      } & Relationships;
      message_reactions: {
        Row: MessageReactionsRow;
        Insert: Partial<MessageReactionsRow>;
        Update: Partial<MessageReactionsRow>;
      } & Relationships;
      chat_keys: {
        Row: ChatKeysRow;
        Insert: Partial<ChatKeysRow>;
        Update: Partial<ChatKeysRow>;
      } & Relationships;
      chat_key_members: {
        Row: ChatKeyMembersRow;
        Insert: Partial<ChatKeyMembersRow>;
        Update: Partial<ChatKeyMembersRow>;
      } & Relationships;
      household_keys: {
        Row: HouseholdKeysRow;
        Insert: Partial<HouseholdKeysRow>;
        Update: Partial<HouseholdKeysRow>;
      } & Relationships;
      household_key_members: {
        Row: HouseholdKeyMembersRow;
        Insert: Partial<HouseholdKeyMembersRow>;
        Update: Partial<HouseholdKeyMembersRow>;
      } & Relationships;
      statuses: {
        Row: StatusesRow;
        Insert: Partial<StatusesRow>;
        Update: Partial<StatusesRow>;
      } & Relationships;
      status_views: {
        Row: StatusViewsRow;
        Insert: Partial<StatusViewsRow>;
        Update: Partial<StatusViewsRow>;
      } & Relationships;
      live_locations: {
        Row: LiveLocationsRow;
        Insert: Partial<LiveLocationsRow>;
        Update: Partial<LiveLocationsRow>;
      } & Relationships;
    };
    Functions: {
      get_chat_list: { Args: { p_archived?: boolean }; Returns: ChatListRow[] };
      mark_chat_read: { Args: { p_chat_id: string }; Returns: void };
      find_or_create_dm: { Args: { other_user_id: string }; Returns: string };
      remove_household_member: { Args: { target_user_id: string }; Returns: void };
      check_phone_status: { Args: { p_phone: string }; Returns: { exists: boolean; has_pin: boolean } };
      verify_recovery_pin: { Args: { p_phone: string; p_pin: string }; Returns: boolean };
      claim_phone: { Args: { p_phone: string; p_pin: string }; Returns: void };
      set_pin: { Args: { p_pin: string }; Returns: void };
      recover_account: { Args: { p_phone: string; p_pin: string }; Returns: boolean };
      delete_self: { Args: Record<string, never>; Returns: void };
      delete_own_account: { Args: Record<string, never>; Returns: void };
    };
  };
}
