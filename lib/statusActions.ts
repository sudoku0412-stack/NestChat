import { supabase } from './supabase';
import { uploadStatusMedia, type PickedAsset } from './media';

export async function postTextStatus(userId: string, text: string, backgroundColor: string) {
  const { error } = await supabase.from('statuses').insert({
    user_id: userId,
    type: 'text',
    text_content: text,
    background_color: backgroundColor,
  });
  if (error) throw error;
}

export async function postMediaStatus(userId: string, asset: PickedAsset) {
  const uploaded = await uploadStatusMedia(userId, asset);
  const { error } = await supabase.from('statuses').insert({
    user_id: userId,
    type: uploaded.kind as 'photo' | 'video',
    storage_path: uploaded.storagePath,
  });
  if (error) throw error;
}

export async function markStatusViewed(statusId: string, viewerId: string) {
  await supabase
    .from('status_views')
    .upsert({ status_id: statusId, viewer_id: viewerId }, { onConflict: 'status_id,viewer_id', ignoreDuplicates: true });
}

export async function deleteStatus(statusId: string) {
  await supabase.from('statuses').delete().eq('id', statusId);
}

export interface StatusViewer {
  id: string;
  display_name: string;
  avatar_url: string | null;
  viewed_at: string;
}

export async function getStatusViewers(statusId: string): Promise<StatusViewer[]> {
  const { data: viewRows } = await supabase
    .from('status_views')
    .select('viewer_id, viewed_at')
    .eq('status_id', statusId)
    .order('viewed_at', { ascending: false });

  const rows = viewRows ?? [];
  if (rows.length === 0) return [];

  const { data: userRows } = await supabase
    .from('users')
    .select('id, display_name, avatar_url')
    .in(
      'id',
      rows.map((r) => r.viewer_id)
    );

  const usersById = new Map((userRows ?? []).map((u) => [u.id, u]));

  return rows
    .map((row) => {
      const user = usersById.get(row.viewer_id);
      return user ? { ...user, viewed_at: row.viewed_at } : null;
    })
    .filter((v): v is StatusViewer => v !== null);
}
