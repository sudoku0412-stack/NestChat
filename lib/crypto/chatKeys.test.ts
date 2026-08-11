import { chainable, type RecordedCall } from '../testUtils/chain';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));

import { to_base64 } from 'react-native-libsodium';
import { supabase } from '../supabase';
import { generateIdentityKeyPair } from './keys';
import { getOrCreateChatKey } from './chatKeys';

describe('getOrCreateChatKey', () => {
  afterEach(() => jest.resetAllMocks());

  it('creates a new key and wraps it only for members who have published a public key', async () => {
    const alice = generateIdentityKeyPair();

    const chatKeysCalls: RecordedCall[] = [];
    const chatKeyMembersCalls: RecordedCall[] = [];
    let chatKeysFromCallCount = 0;

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'chat_keys') {
        chatKeysFromCallCount += 1;
        // 1st call: "do I already have a wrap?" lookup -> none yet.
        // 2nd call: the insert that creates the new key row.
        if (chatKeysFromCallCount === 1) return chainable({ data: null, error: null }, chatKeysCalls);
        return chainable({ data: { id: 'key-1' }, error: null }, chatKeysCalls);
      }
      if (table === 'chat_members') {
        return chainable(
          {
            data: [
              { user_id: 'alice', users: { public_key: to_base64(alice.publicKey) } },
              { user_id: 'bob', users: { public_key: null } }, // hasn't published a key yet
            ],
            error: null,
          },
          []
        );
      }
      if (table === 'chat_key_members') {
        return chainable({ data: null, error: null }, chatKeyMembersCalls);
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await getOrCreateChatKey('chat-1', 'alice', alice);

    expect(result.keyId).toBe('key-1');
    expect(result.key).toHaveLength(32);

    const insertCall = chatKeyMembersCalls.find((c) => c.method === 'insert');
    expect(insertCall).toBeDefined();
    const wraps = insertCall!.args[0] as { user_id: string }[];
    // Only alice got wrapped -- bob has no public key yet.
    expect(wraps).toHaveLength(1);
    expect(wraps[0].user_id).toBe('alice');
  });
});
