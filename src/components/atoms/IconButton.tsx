import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../../theme/colors';

type IconButtonProps = {
  label: string;
  icon: string;
  onPress: () => void;
};

export function IconButton({ label, icon, onPress }: IconButtonProps) {
  return (
    <Pressable accessibilityLabel={label} style={styles.button} onPress={onPress}>
      <Text style={styles.icon}>{icon}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)'
  },
  icon: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0
  }
});
