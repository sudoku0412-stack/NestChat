import { Image, StyleSheet, Text, View } from 'react-native';
import { colorForName, colors, initials } from '../lib/theme';

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: number;
}

export function Avatar({ name, avatarUrl, size = 44 }: AvatarProps) {
  const style = { width: size, height: size, borderRadius: size / 2 };

  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={[styles.image, style]} />;
  }

  return (
    <View style={[styles.container, style, { backgroundColor: colorForName(name) }]}>
      <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials(name)}</Text>
    </View>
  );
}

// Offset 3-up stack of monogram squares, used for group chat rows/headers.
export function GroupAvatarStack({ members, size = 44 }: { members: { display_name: string; avatar_url?: string | null }[]; size?: number }) {
  const shown = members.slice(0, 3);
  const stackSize = size * 0.72;
  const offset = size * 0.16;

  return (
    <View style={{ width: size, height: size }}>
      {shown.map((m, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: i * offset,
            top: i * offset,
          }}
        >
          <Avatar name={m.display_name} avatarUrl={m.avatar_url} size={stackSize} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    backgroundColor: colors.surface,
  },
  initials: {
    color: colors.text,
    fontWeight: '600',
  },
});
