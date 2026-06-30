import { Platform } from 'react-native';

export function supportsAppUsageAccess() {
  return Platform.OS === 'android';
}
