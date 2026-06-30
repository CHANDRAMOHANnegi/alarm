import { ReactNode } from 'react';
import { Text, TextProps } from 'react-native';
import { colors } from '../../theme/colors';

type AppTextProps = TextProps & {
  children: ReactNode;
  muted?: boolean;
};

export function AppText({ children, muted, style, ...props }: AppTextProps) {
  return (
    <Text {...props} style={[{ color: muted ? colors.muted : colors.text, letterSpacing: 0 }, style]}>
      {children}
    </Text>
  );
}
