jest.mock('expo-contacts', () => ({
  Contact: { getAllDetails: jest.fn() },
  ContactField: { FULL_NAME: 'fullName', PHONES: 'phones' },
  requestPermissionsAsync: jest.fn(),
}));

import { Contact, requestPermissionsAsync } from 'expo-contacts';
import { loadDeviceContacts, loadDeviceContactsForShare, phoneMatchKey } from './contacts';

describe('phoneMatchKey', () => {
  it('returns the last 10 digits, stripping formatting characters', () => {
    expect(phoneMatchKey('+1 (555) 123-4567')).toBe('5551234567');
    expect(phoneMatchKey('555.123.4567')).toBe('5551234567');
  });

  it('is tolerant of a leading country code', () => {
    expect(phoneMatchKey('+91 98765 43210')).toBe(phoneMatchKey('9876543210'));
  });

  it('returns null for numbers too short to be a real phone number', () => {
    expect(phoneMatchKey('12345')).toBeNull();
  });

  it('returns null for null/undefined input', () => {
    expect(phoneMatchKey(null)).toBeNull();
    expect(phoneMatchKey(undefined)).toBeNull();
  });
});

describe('loadDeviceContacts', () => {
  afterEach(() => jest.resetAllMocks());

  it('returns null when permission is denied', async () => {
    (requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
    expect(await loadDeviceContacts()).toBeNull();
  });

  it('maps device contacts to name + matchable phone keys, dropping phoneless contacts', async () => {
    (requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (Contact.getAllDetails as jest.Mock).mockResolvedValue([
      { fullName: 'Sudesna Karak', phones: [{ number: '+1 555-123-4567' }] },
      { fullName: 'No Phone Person', phones: [] },
      { fullName: '  ', phones: [{ number: '5559998888' }] },
    ]);

    const contacts = await loadDeviceContacts();
    expect(contacts).toEqual([
      { name: 'Sudesna Karak', phoneKeys: ['5551234567'] },
      { name: 'Unknown', phoneKeys: ['5559998888'] },
    ]);
  });
});

describe('loadDeviceContactsForShare', () => {
  afterEach(() => jest.resetAllMocks());

  it('returns null when permission is denied', async () => {
    (requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
    expect(await loadDeviceContactsForShare()).toBeNull();
  });

  it('keeps raw phone numbers (not just match keys) and sorts by name', async () => {
    (requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (Contact.getAllDetails as jest.Mock).mockResolvedValue([
      { fullName: 'Zed', phones: [{ number: '+1 555-000-0000' }] },
      { fullName: 'Amy', phones: [{ number: '+1 555-111-1111' }, { number: '555-222-2222' }] },
    ]);

    const contacts = await loadDeviceContactsForShare();
    expect(contacts).toEqual([
      { name: 'Amy', phones: ['+1 555-111-1111', '555-222-2222'] },
      { name: 'Zed', phones: ['+1 555-000-0000'] },
    ]);
  });
});
