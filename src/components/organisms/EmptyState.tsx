import { StyleSheet, View } from 'react-native';
import { AppText } from '../atoms/AppText';
import { sharedStyles } from '../../theme/styles';

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={sharedStyles.panel}>
      <AppText style={styles.title}>{title}</AppText>
      <AppText muted style={styles.body}>{body}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8
  },
  body: {
    fontSize: 14,
    lineHeight: 21
  }
});
