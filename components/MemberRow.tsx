import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from './Avatar';
import { useAccentTheme } from '../lib/accentTheme';
import { useTheme } from '../lib/themeMode';
import { fontWeight, radius, space } from '../lib/theme';
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
  const { colors: accentColors } = useAccentTheme();
  const theme = useTheme();
  return (
    <Pressable style={[styles.row, { borderBottomColor: theme.divider }]} onPress={onPress}>
      {checkbox && (
        <Pressable
          style={[
            styles.checkbox,
            { borderColor: theme.textMuted },
            checkbox.checked && { backgroundColor: accentColors.accent, borderColor: accentColors.accent },
          ]}
          onPress={checkbox.onToggle}
          hitSlop={8}
        >
          {checkbox.checked && <Text style={[styles.checkmark, { color: theme.bg }]}>✓</Text>}
        </Pressable>
      )}
      <Avatar name={member.display_name} avatarUrl={member.avatar_url} size={40} />
      <View style={styles.info}>
        <Text style={[styles.name, { color: theme.text }]}>{member.display_name}</Text>
        {member.role === 'admin' && <Text style={[styles.roleTag, { color: theme.textMuted }]}>Admin</Text>}
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
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    fontSize: 13,
    fontWeight: fontWeight.semibold,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: fontWeight.medium,
  },
  roleTag: {
    fontSize: 12,
    marginTop: 2,
  },
});
