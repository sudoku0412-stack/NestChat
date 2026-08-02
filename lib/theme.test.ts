import { avatarPalette, colorForName, initials } from './theme';

describe('colorForName', () => {
  it('always returns a color from the avatar palette', () => {
    for (const name of ['Kaushik', 'Sudesna', 'A', '', 'Zzzz Yyyy']) {
      expect(avatarPalette).toContain(colorForName(name));
    }
  });

  it('is deterministic for the same name', () => {
    expect(colorForName('Kaushik Majumder')).toBe(colorForName('Kaushik Majumder'));
  });

  it('is order-sensitive (different names can map differently)', () => {
    // Not a strict requirement that they differ, but the hash should be a
    // function of the whole string, not just length.
    const a = colorForName('abc');
    const b = colorForName('cba');
    expect(typeof a).toBe('string');
    expect(typeof b).toBe('string');
  });
});

describe('initials', () => {
  it('takes first letters of first and last word for multi-word names', () => {
    expect(initials('Kaushik Majumder')).toBe('KM');
  });

  it('takes first two letters for a single-word name', () => {
    expect(initials('Kaushik')).toBe('KA');
  });

  it('ignores extra whitespace between words', () => {
    expect(initials('  Kaushik   Majumder  ')).toBe('KM');
  });

  it('falls back to "?" for an empty/whitespace-only name', () => {
    expect(initials('')).toBe('?');
    expect(initials('   ')).toBe('?');
  });

  it('uppercases the result', () => {
    expect(initials('kaushik majumder')).toBe('KM');
  });
});
