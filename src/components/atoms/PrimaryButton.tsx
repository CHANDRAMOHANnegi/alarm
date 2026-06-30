import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../../theme/colors';

type PrimaryButtonProps = {
  children: ReactNode;
  onPress: () => void;
};

export function PrimaryButton({ children, onPress }: PrimaryButtonProps) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Text style={styles.text}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent
  },
  text: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0
  }
});
