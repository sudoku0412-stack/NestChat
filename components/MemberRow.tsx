import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from './Avatar';
import { colors, fontWeight, radius, space } from '../lib/theme';
import type { Member } from '../lib/types';

interface MemberRowProps {
  member: Member;
  onPress?: () => void;
  checkbox?: {
    checked: boolean;
    onToggle: () => void;
  };
  trailing?: React.ReactNode;
}

export function MemberRow({ member, onPress, checkbox, trailing }: MemberRowProps) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      {checkbox && (
        <Pressable
          style={[styles.checkbox, checkbox.checked && styles.checkboxChecked]}
          onPress={checkbox.onToggle}
          hitSlop={8}
        >
          {checkbox.checked && <Text style={styles.checkmark}>✓</Text>}
        </Pressable>
      )}
      <Avatar name={member.display_name} avatarUrl={member.avatar_url} size={40} />
      <View style={styles.info}>
        <Text style={styles.name}>{member.display_name}</Text>
        {member.role === 'admin' && <Text style={styles.roleTag}>Admin</Text>}
      </View>
      {trailing}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[6],
    paddingVertical: space[3],
    gap: space[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkmark: {
    color: colors.bg,
    fontSize: 13,
    fontWeight: fontWeight.semibold,
  },
  info: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontSize: 15,
    fontWeight: fontWeight.medium,
  },
  roleTag: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
});
