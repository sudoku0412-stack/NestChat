import { chainable, type RecordedCall } from './testUtils/chain';

jest.mock('./supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('./media', () => ({ uploadStatusMedia: jest.fn() }));

import { supabase } from './supabase';
import { uploadStatusMedia } from './media';
import {
  deleteStatus,
  getStatusViewers,
  markStatusViewed,
  postMediaStatus,
  postTextStatus,
} from './statusActions';

afterEach(() => jest.resetAllMocks());

describe('postTextStatus', () => {
  it('inserts a text status with the given background color', async () => {
    const calls: RecordedCall[] = [];
    (supabase.from as jest.Mock).mockReturnValue(chainable({ error: null }, calls));

    await postTextStatus('user-1', 'Hello world', '#ff0000');

    expect(supabase.from).toHaveBeenCalledWith('statuses');
    expect(calls[0].args[0]).toEqual({
      user_id: 'user-1',
      type: 'text',
      text_content: 'Hello world',
      background_color: '#ff0000',
    });
  });

  it('throws when the insert fails', async () => {
    (supabase.from as jest.Mock).mockReturnValue(chainable({ error: new Error('nope') }));
    await expect(postTextStatus('user-1', 'x', '#000')).rejects.toThrow('nope');
  });
});

describe('postMediaStatus', () => {
  it('stores a trimmed caption as text_content', async () => {
    const calls: RecordedCall[] = [];
    (supabase.from as jest.Mock).mockReturnValue(chainable({ error: null }, calls));
    (uploadStatusMedia as jest.Mock).mockResolvedValue({ kind: 'photo', storagePath: 'p.jpg' });

    await postMediaStatus('user-1', { uri: 'x', kind: 'photo' }, '  Caption text  ');

    expect(calls[0].args[0]).toMatchObject({
      type: 'photo',
      storage_path: 'p.jpg',
      text_content: 'Caption text',
    });
  });

  it('stores null text_content when no caption is given', async () => {
    const calls: RecordedCall[] = [];
    (supabase.from as jest.Mock).mockReturnValue(chainable({ error: null }, calls));
    (uploadStatusMedia as jest.Mock).mockResolvedValue({ kind: 'video', storagePath: 'v.mp4' });

    await postMediaStatus('user-1', { uri: 'x', kind: 'video' });

    expect(calls[0].args[0]).toMatchObject({ text_content: null });
  });

  it('stores null text_content when the caption is only whitespace', async () => {
    const calls: RecordedCall[] = [];
    (supabase.from as jest.Mock).mockReturnValue(chainable({ error: null }, calls));
    (uploadStatusMedia as jest.Mock).mockResolvedValue({ kind: 'photo', storagePath: 'p.jpg' });

    await postMediaStatus('user-1', { uri: 'x', kind: 'photo' }, '   ');

    expect(calls[0].args[0]).toMatchObject({ text_content: null });
  });
});

describe('markStatusViewed', () => {
  it('upserts a status_views row, ignoring duplicates', async () => {
    const calls: RecordedCall[] = [];
    (supabase.from as jest.Mock).mockReturnValue(chainable({ error: null }, calls));

    await markStatusViewed('status-1', 'viewer-1');

    expect(supabase.from).toHaveBeenCalledWith('status_views');
    expect(calls[0]).toEqual({
      method: 'upsert',
      args: [
        { status_id: 'status-1', viewer_id: 'viewer-1' },
        { onConflict: 'status_id,viewer_id', ignoreDuplicates: true },
      ],
    });
  });
});

describe('deleteStatus', () => {
  it('deletes the status by id', async () => {
    const calls: RecordedCall[] = [];
    (supabase.from as jest.Mock).mockReturnValue(chainable({ error: null }, calls));

    await deleteStatus('status-1');

    expect(supabase.from).toHaveBeenCalledWith('statuses');
    expect(calls.some((c) => c.method === 'delete')).toBe(true);
    expect(calls.some((c) => c.method === 'eq' && c.args[0] === 'id' && c.args[1] === 'status-1')).toBe(
      true
    );
  });
});

describe('getStatusViewers', () => {
  it('joins status_views with users and returns viewer profiles', async () => {
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'status_views') {
        return chainable({
          data: [
            { viewer_id: 'u1', viewed_at: '2026-01-01T00:00:00Z' },
            { viewer_id: 'u2', viewed_at: '2026-01-02T00:00:00Z' },
          ],
        });
      }
      return chainable({
        data: [
          { id: 'u1', display_name: 'Alice', avatar_url: null },
          { id: 'u2', display_name: 'Bob', avatar_url: null },
        ],
      });
    });

    const viewers = await getStatusViewers('status-1');

    expect(viewers).toEqual([
      { id: 'u1', display_name: 'Alice', avatar_url: null, viewed_at: '2026-01-01T00:00:00Z' },
      { id: 'u2', display_name: 'Bob', avatar_url: null, viewed_at: '2026-01-02T00:00:00Z' },
    ]);
  });

  it('returns an empty array when nobody has viewed it', async () => {
    (supabase.from as jest.Mock).mockReturnValue(chainable({ data: [] }));
    expect(await getStatusViewers('status-1')).toEqual([]);
  });

  it('drops viewer ids that no longer resolve to a user', async () => {
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'status_views') {
        return chainable({ data: [{ viewer_id: 'ghost', viewed_at: '2026-01-01T00:00:00Z' }] });
      }
      return chainable({ data: [] });
    });

    expect(await getStatusViewers('status-1')).toEqual([]);
  });
});
