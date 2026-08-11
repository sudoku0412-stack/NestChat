// Env vars lib/supabase.ts requires at import time — tests mock the module
// itself (see lib/testUtils/chain.ts), but some files import it transitively
// before the mock is registered, so these just need to exist, not be real.
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// react-native-libsodium and react-native-keychain are native modules with no Node-runnable
// implementation -- see lib/testUtils/libsodiumMock.js for why the substitute is real (but
// different) cryptography rather than a no-op stub.
jest.mock('react-native-libsodium', () => require('./lib/testUtils/libsodiumMock'));
jest.mock('react-native-keychain', () => require('./lib/testUtils/keychainMock'));
