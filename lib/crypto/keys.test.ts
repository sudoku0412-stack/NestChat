import { ensureIdentityKeyPair, generateIdentityKeyPair, getIdentityKeyPair, wipeIdentityKeyPair } from './keys';

describe('identity keypair storage', () => {
  afterEach(async () => {
    await wipeIdentityKeyPair();
  });

  it('generateIdentityKeyPair produces distinct public/secret keys each call', () => {
    const a = generateIdentityKeyPair();
    const b = generateIdentityKeyPair();
    expect(a.publicKey).not.toEqual(b.publicKey);
    expect(a.secretKey).not.toEqual(b.secretKey);
  });

  it('getIdentityKeyPair returns null when nothing is stored', async () => {
    expect(await getIdentityKeyPair()).toBeNull();
  });

  it('ensureIdentityKeyPair generates and persists a keypair on first call', async () => {
    const created = await ensureIdentityKeyPair();
    const loaded = await getIdentityKeyPair();
    expect(loaded).not.toBeNull();
    expect(Array.from(loaded!.publicKey)).toEqual(Array.from(created.publicKey));
    expect(Array.from(loaded!.secretKey)).toEqual(Array.from(created.secretKey));
  });

  it('ensureIdentityKeyPair is idempotent -- returns the same keypair on repeat calls', async () => {
    const first = await ensureIdentityKeyPair();
    const second = await ensureIdentityKeyPair();
    expect(Array.from(second.publicKey)).toEqual(Array.from(first.publicKey));
  });

  it('wipeIdentityKeyPair removes the stored keypair', async () => {
    await ensureIdentityKeyPair();
    await wipeIdentityKeyPair();
    expect(await getIdentityKeyPair()).toBeNull();
  });
});
