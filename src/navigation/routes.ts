export const routes = {
  dashboard: 'dashboard',
  morning: 'morning',
  evening: 'evening',
  analytics: 'analytics'
} as const;

export type RouteName = (typeof routes)[keyof typeof routes];
