import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { InboxItem } from '../api/stories';
import { colors } from '../theme/colors';

// Card cu un autor si titlul povestii lui — folosit in lista de pickAuthor
// din hub. SVG-ul de avatar e full-body 762×1400, decupam doar capul.

export function AuthorChip({
  item,
  isStarting,
  onPress,
}: {
  item: InboxItem;
  isStarting: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={isStarting}
      style={({ pressed }) => [
        styles.row,
        pressed && !isStarting && { opacity: 0.9, transform: [{ scale: 0.98 }] },
        isStarting && { opacity: 0.6 },
      ]}
    >
      <FriendAvatar svg={item.author.avatarSvg} />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {item.author.name}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {item.title}
        </Text>
      </View>
      {isStarting ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <Text style={styles.chevron}>›</Text>
      )}
    </Pressable>
  );
}

function FriendAvatar({ svg }: { svg: string | null }) {
  const SIZE = 44;
  if (!svg) {
    return <View style={[styles.avatar, styles.avatarFallback, { width: SIZE, height: SIZE }]} />;
  }
  const fullHeight = Math.round(SIZE * (1400 / 762));
  return (
    <View style={[styles.avatar, { width: SIZE, height: SIZE }]}>
      <SvgXml xml={svg} width={SIZE} height={fullHeight} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  body: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: 15, fontWeight: '800' },
  sub: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  chevron: { color: colors.accent, fontSize: 22, fontWeight: '800' },
  avatar: { overflow: 'hidden', borderRadius: 22, backgroundColor: colors.cardAlt },
  avatarFallback: {},
});
