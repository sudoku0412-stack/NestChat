import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { loadDeviceContactsForShare, type ShareableContact } from '../lib/contacts';
import { Avatar } from './Avatar';
import { colors, fontWeight, radius, space } from '../lib/theme';

interface ContactPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (contact: ShareableContact) => void;
}

export function ContactPickerModal({ visible, onClose, onSelect }: ContactPickerModalProps) {
  const [contacts, setContacts] = useState<ShareableContact[] | null>(null);

  useEffect(() => {
    if (!visible) return;
    setContacts(null);
    loadDeviceContactsForShare().then(setContacts);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Share a contact</Text>
          {contacts === null ? (
            <ActivityIndicator color={colors.accent} style={styles.loading} />
          ) : contacts.length === 0 ? (
            <Text style={styles.empty}>No contacts with a phone number found, or access was denied.</Text>
          ) : (
            <FlatList
              data={contacts}
              keyExtractor={(c, i) => `${c.name}-${i}`}
              style={styles.list}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.row}
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                >
                  <Avatar name={item.name} avatarUrl={null} size={36} />
                  <View style={styles.rowTexts}>
                    <Text style={styles.rowName}>{item.name}</Text>
                    <Text style={styles.rowPhone} numberOfLines={1}>
                      {item.phones[0]}
                    </Text>
                  </View>
                </Pressable>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '70%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: space[4],
    paddingBottom: space[8],
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: fontWeight.semibold,
    paddingHorizontal: space[6],
    marginBottom: space[3],
  },
  loading: {
    paddingVertical: space[8],
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    paddingHorizontal: space[6],
    paddingVertical: space[6],
  },
  list: {
    paddingHorizontal: space[4],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
    paddingHorizontal: space[2],
  },
  rowTexts: {
    flex: 1,
  },
  rowName: {
    color: colors.text,
    fontSize: 15,
  },
  rowPhone: {
    color: colors.textMuted,
    fontSize: 13,
  },
});
