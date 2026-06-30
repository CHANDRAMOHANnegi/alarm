export type RepeatMode = 'once' | 'daily';

export type DailyTask = {
  id: string;
  title: string;
  category: string;
  active: boolean;
  createdAt: string;
  completedDates: string[];
};

export type AppUsageEntry = {
  packageName: string;
  appName: string;
  totalTimeMs: number;
  lastTimeUsed: number;
};
