// In-memory stand-in for react-native-keychain under Jest -- no real Keychain/Keystore exists
// under Node. Scoped by `service` the same way the real module is.
const store = new Map();

function keyFor(options) {
  return typeof options === 'string' ? options : options?.service ?? 'default';
}

module.exports = {
  setGenericPassword: jest.fn(async (username, password, options) => {
    store.set(keyFor(options), { username, password });
    return { service: keyFor(options), storage: 'test' };
  }),
  getGenericPassword: jest.fn(async (options) => {
    const entry = store.get(keyFor(options));
    if (!entry) return false;
    return { username: entry.username, password: entry.password, service: keyFor(options), storage: 'test' };
  }),
  resetGenericPassword: jest.fn(async (options) => {
    store.delete(keyFor(options));
    return true;
  }),
  __reset: () => store.clear(),
};
