import { Contact, ContactField, requestPermissionsAsync } from 'expo-contacts';

export interface DeviceContact {
  name: string;
  phoneKeys: string[];
}

// Matches phone numbers by their last 10 digits — good enough at household/contacts
// scale without a full E.164 parsing library, and tolerant of contacts saved with or
// without a leading country code / formatting characters.
export function phoneMatchKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7) return null;
  return digits.slice(-10);
}

export async function loadDeviceContacts(): Promise<DeviceContact[] | null> {
  const perm = await requestPermissionsAsync();
  if (!perm.granted) return null;

  const details = await Contact.getAllDetails([ContactField.FULL_NAME, ContactField.PHONES]);

  return details
    .map((d) => ({
      name: d.fullName?.trim() || 'Unknown',
      phoneKeys: (d.phones ?? [])
        .map((p) => phoneMatchKey(p.number))
        .filter((k): k is string => !!k),
    }))
    .filter((c) => c.phoneKeys.length > 0);
}
