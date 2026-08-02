// Minimal stand-in for supabase-js's fluent query builder. Every method call
// is recorded (so tests can assert what was sent) and returns another
// chainable proxy, which is also awaitable/thenable — so both
// `await x.from().select().eq().single()` and `await x.from().select()`
// resolve to the same configured `result`, regardless of chain length.
export interface RecordedCall {
  method: string;
  args: unknown[];
}

export function chainable(result: unknown, calls: RecordedCall[] = []) {
  const proxy: any = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === 'then') {
          return (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject);
        }
        if (prop === 'catch') {
          return (reject: any) => Promise.resolve(result).catch(reject);
        }
        return (...args: unknown[]) => {
          calls.push({ method: prop, args });
          return chainable(result, calls);
        };
      },
    }
  );
  return proxy;
}

// Simulates supabase.channel(name).on(event, filter, cb)...subscribe(cb).
// `.subscribe` immediately reports SUBSCRIBED unless told not to; the `.on`
// handlers are captured so a test can manually fire a fake postgres_changes
// event via `stub.handlers['messages'](payload)`.
export function makeChannelStub() {
  const handlers: Record<string, (payload: unknown) => void> = {};
  const channel: any = {
    on(_event: string, filter: { table?: string } | undefined, cb: (payload: unknown) => void) {
      handlers[filter?.table ?? _event] = cb;
      return channel;
    },
    subscribe(statusCb?: (status: string, err?: Error) => void) {
      statusCb?.('SUBSCRIBED');
      return channel;
    },
  };
  return { channel, handlers };
}

export function createSupabaseMock() {
  return {
    from: jest.fn(),
    rpc: jest.fn(),
    channel: jest.fn(),
    removeChannel: jest.fn(),
    realtime: { setAuth: jest.fn() },
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      signInAnonymously: jest.fn(),
      getUser: jest.fn(),
      onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
      signOut: jest.fn(),
    },
    storage: { from: jest.fn() },
  };
}
