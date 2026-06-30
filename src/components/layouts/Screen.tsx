import { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: 18,
    paddingBottom: 112,
    gap: 16
  }
});
