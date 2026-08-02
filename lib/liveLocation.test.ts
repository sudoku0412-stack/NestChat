import { chainable, type RecordedCall } from './testUtils/chain';

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn().mockResolvedValue(undefined),
  Accuracy: { Balanced: 3 },
}));
jest.mock('./supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('./locationTask', () => ({
  LOCATION_TASK_NAME: 'nestchat-live-location',
  setActiveShareId: jest.fn(),
}));

import * as Location from 'expo-location';
import { supabase } from './supabase';
import { setActiveShareId } from './locationTask';
import { startLiveLocationShare, stopLiveLocationShare } from './liveLocation';

afterEach(() => jest.resetAllMocks());
beforeEach(() => {
  (Location.stopLocationUpdatesAsync as jest.Mock).mockResolvedValue(undefined);
});

function mockGrantedPermissions(position = { coords: { latitude: 12.34, longitude: 56.78 } }) {
  (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
  (Location.requestBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
  (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue(position);
}

describe('startLiveLocationShare', () => {
  it('returns null without touching the database if foreground permission is denied', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });

    const result = await startLiveLocationShare('chat-1', 'user-1', 'until_stopped');

    expect(result).toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('returns null if background permission is denied', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (Location.requestBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });

    const result = await startLiveLocationShare('chat-1', 'user-1', 'until_stopped');

    expect(result).toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('creates the tracking row + announcement message and starts the background task', async () => {
    mockGrantedPermissions();
    const locationCalls: RecordedCall[] = [];
    const messageCalls: RecordedCall[] = [];
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'live_locations') return chainable({ data: { id: 'share-1' }, error: null }, locationCalls);
      return chainable({ error: null }, messageCalls);
    });

    const result = await startLiveLocationShare('chat-1', 'user-1', 'until_stopped');

    expect(result).toBe('share-1');
    const insertCall = locationCalls.find((c) => c.method === 'insert')!;
    expect(insertCall.args[0]).toMatchObject({
      chat_id: 'chat-1',
      user_id: 'user-1',
      lat: 12.34,
      lng: 56.78,
      expires_at: null,
    });
    expect(messageCalls.find((c) => c.method === 'insert')!.args[0]).toMatchObject({
      chat_id: 'chat-1',
      sender_id: 'user-1',
      location_share_id: 'share-1',
    });
    expect(setActiveShareId).toHaveBeenCalledWith('share-1');
    expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(
      'nestchat-live-location',
      expect.objectContaining({ timeInterval: 60000 })
    );
  });

  it.each([
    ['15m', 15 * 60 * 1000],
    ['24h', 24 * 60 * 60 * 1000],
  ] as const)('sets expires_at ~%s from now', async (duration, offsetMs) => {
    mockGrantedPermissions();
    const locationCalls: RecordedCall[] = [];
    (supabase.from as jest.Mock).mockImplementation((table: string) =>
      table === 'live_locations'
        ? chainable({ data: { id: 'share-1' }, error: null }, locationCalls)
        : chainable({ error: null })
    );

    const before = Date.now();
    await startLiveLocationShare('chat-1', 'user-1', duration);

    const expiresAt = new Date(
      (locationCalls.find((c) => c.method === 'insert')!.args[0] as { expires_at: string }).expires_at
    ).getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(before + offsetMs - 2000);
    expect(expiresAt).toBeLessThanOrEqual(before + offsetMs + 5000);
  });

  it('throws and never starts tracking if creating the tracking row fails', async () => {
    mockGrantedPermissions();
    (supabase.from as jest.Mock).mockReturnValue(chainable({ data: null, error: new Error('db down') }));

    await expect(startLiveLocationShare('chat-1', 'user-1', 'until_stopped')).rejects.toThrow('db down');
    expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it('rolls back the tracking row if creating the announcement message fails', async () => {
    mockGrantedPermissions();
    const locationCalls: RecordedCall[] = [];
    (supabase.from as jest.Mock).mockImplementation((table: string) =>
      table === 'live_locations'
        ? chainable({ data: { id: 'share-1' }, error: null }, locationCalls)
        : chainable({ error: new Error('insert message failed') })
    );

    await expect(startLiveLocationShare('chat-1', 'user-1', 'until_stopped')).rejects.toThrow(
      'insert message failed'
    );
    expect(locationCalls.some((c) => c.method === 'delete')).toBe(true);
    expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();
  });
});

describe('stopLiveLocationShare', () => {
  it('marks the row stopped, clears the active share, and stops the background task', async () => {
    const calls: RecordedCall[] = [];
    (supabase.from as jest.Mock).mockReturnValue(chainable({ error: null }, calls));

    await stopLiveLocationShare('share-1');

    expect(calls.find((c) => c.method === 'update')!.args[0]).toHaveProperty('stopped_at');
    expect(calls.some((c) => c.method === 'eq' && c.args[1] === 'share-1')).toBe(true);
    expect(setActiveShareId).toHaveBeenCalledWith(null);
    expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith('nestchat-live-location');
  });
});
