import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  AppState,
  Easing,
  KeyboardAvoidingView,
  NativeModules,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';

const STORAGE_KEYS = {
  alarms: '@aura-clock/alarms',
  plans: '@aura-clock/plans',
  retros: '@aura-clock/retros',
  dailyTasks: '@aura-clock/daily-tasks'
} as const;

type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
type TabId = 'dashboard' | 'morning' | 'evening' | 'analytics';
type Tone = 'sunrise' | 'space' | 'midnight';
type RepeatMode = 'once' | 'daily';

type Tab = {
  id: TabId;
  label: string;
  icon: string;
};

type Alarm = {
  id: string;
  notificationId: string;
  snoozeNotificationId?: string;
  label: string;
  fireAt: string;
  enabled: boolean;
  repeat: RepeatMode;
  snoozed?: boolean;
  snoozedUntil?: string;
};

type JournalEntry = {
  date: string;
  text: string;
  createdAt: string;
  mood?: number;
  energy?: number;
};

type DailyTask = {
  id: string;
  title: string;
  category: string;
  active: boolean;
  createdAt: string;
  completedDates: string[];
};

type ScheduleAlarmInput = {
  alarmId: string;
  label: string;
  fireAt: Date;
  repeat: RepeatMode;
};

type Stat = {
  label: string;
  value: number;
};

type AppUsageEntry = {
  packageName: string;
  appName: string;
  totalTimeMs: number;
  lastTimeUsed: number;
};

type AppUsageBridge = {
  hasUsageAccess: () => Promise<boolean>;
  openUsageAccessSettings: () => Promise<void>;
  getTodayUsage: () => Promise<AppUsageEntry[]>;
};

const repeatOptions: Array<{ label: string; value: RepeatMode }> = [
  { label: 'Once', value: 'once' },
  { label: 'Daily', value: 'daily' }
];

const scoreValues = [1, 2, 3, 4, 5];

const defaultDailyTasks: DailyTask[] = [
  {
    id: 'gym',
    title: 'Go to gym',
    category: 'Health',
    active: true,
    createdAt: new Date(0).toISOString(),
    completedDates: []
  },
  {
    id: 'system-design',
    title: 'Learn system design',
    category: 'Learning',
    active: true,
    createdAt: new Date(0).toISOString(),
    completedDates: []
  }
];

const tabs: Tab[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '◎' },
  { id: 'morning', label: 'Morning', icon: '☼' },
  { id: 'evening', label: 'Retro', icon: '◐' },
  { id: 'analytics', label: 'Analytics', icon: '▥' }
];

const notificationCategory = 'AURA_ALARM';
const alarmActions = {
  snooze: 'AURA_SNOOZE',
  stop: 'AURA_STOP'
} as const;
const snoozeMinutes = 5;
const AppUsage = NativeModules.AppUsageModule as AppUsageBridge | undefined;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function isoDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function greetingFor(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function parseAlarmTime(value: string): Date | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;

  const next = new Date();
  next.setHours(hour, minute, 0, 0);
  if (next <= new Date()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

function getAlarmNextFireAt(alarm: Alarm, from = new Date()) {
  if (alarm.snoozedUntil) {
    const snoozedUntil = new Date(alarm.snoozedUntil);
    if (snoozedUntil > from) return snoozedUntil;
  }

  const fireAt = new Date(alarm.fireAt);
  if (alarm.repeat === 'once') return fireAt;

  const next = new Date(from);
  next.setHours(fireAt.getHours(), fireAt.getMinutes(), 0, 0);
  if (next <= from) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

function normalizeAlarm(alarm: Alarm): Alarm {
  return {
    ...alarm,
    repeat: alarm.repeat ?? 'once'
  };
}

function normalizeAlarms(savedAlarms: Alarm[]) {
  return savedAlarms
    .map(normalizeAlarm)
    .map((alarm) => {
      if (alarm.snoozedUntil && new Date(alarm.snoozedUntil).getTime() <= Date.now()) {
        return {
          ...alarm,
          snoozed: false,
          snoozedUntil: undefined,
          snoozeNotificationId: undefined
        };
      }
      return alarm;
    })
    .filter(isFutureAlarm);
}

async function saveJson<T>(key: StorageKey, value: T) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

async function loadJson<T>(key: StorageKey, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
}

async function playSoftChime() {
  Speech.speak('Aura alarm. It is time to begin.', {
    pitch: 1.03,
    rate: 0.88
  });
  Vibration.vibrate([0, 600, 250, 600]);
}

function isFutureAlarm(alarm: Alarm) {
  if (!alarm.enabled) return false;
  if (alarm.repeat === 'daily') return true;
  return getAlarmNextFireAt(alarm).getTime() > Date.now();
}

function formatAlarmDate(date: Date) {
  const today = isoDate();
  const target = isoDate(date);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (target === today) return 'Today';
  if (target === isoDate(tomorrow)) return 'Tomorrow';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

async function scheduleAlarmNotification({ alarmId, label, fireAt, repeat }: ScheduleAlarmInput) {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Aura Clock',
      body: label || 'It is time.',
      sound: true,
      categoryIdentifier: notificationCategory,
      data: { alarmId }
    },
    trigger:
      repeat === 'daily'
        ? {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: fireAt.getHours(),
            minute: fireAt.getMinutes()
          }
        : {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: fireAt
          }
  });
}

function countCurrentStreak(entries: JournalEntry[]) {
  const dates = new Set(entries.map((entry) => entry.date));
  let cursor = new Date();
  let streak = 0;

  while (dates.has(isoDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function countDateStreak(dates: string[]) {
  const completed = new Set(dates);
  let cursor = new Date();
  let streak = 0;

  while (completed.has(isoDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function isTaskDoneToday(task: DailyTask, date = isoDate()) {
  return task.completedDates.includes(date);
}

function getTaskCompletionRate(tasks: DailyTask[], date = isoDate()) {
  const activeTasks = tasks.filter((task) => task.active);
  if (activeTasks.length === 0) return 0;
  const completed = activeTasks.filter((task) => isTaskDoneToday(task, date)).length;
  return Math.round((completed / activeTasks.length) * 100);
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 10) / 10;
}

function formatDuration(totalTimeMs: number) {
  const totalMinutes = Math.round(totalTimeMs / 60000);
  if (totalMinutes < 1) return '<1m';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function usageSummary(entries: AppUsageEntry[]) {
  const totalMs = entries.reduce((total, entry) => total + entry.totalTimeMs, 0);
  const topApp = entries[0];
  return {
    totalMs,
    totalLabel: formatDuration(totalMs),
    topLabel: topApp ? `${topApp.appName} • ${formatDuration(topApp.totalTimeMs)}` : 'No usage yet'
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [now, setNow] = useState(new Date());
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [plans, setPlans] = useState<JournalEntry[]>([]);
  const [retros, setRetros] = useState<JournalEntry[]>([]);
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState('Personal');
  const [alarmTime, setAlarmTime] = useState('');
  const [alarmLabel, setAlarmLabel] = useState('Morning planning');
  const [alarmRepeat, setAlarmRepeat] = useState<RepeatMode>('once');
  const [morningText, setMorningText] = useState('');
  const [eveningText, setEveningText] = useState('');
  const [moodScore, setMoodScore] = useState(3);
  const [energyScore, setEnergyScore] = useState(3);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasUsageAccess, setHasUsageAccess] = useState(false);
  const [usageLoading, setUsageLoading] = useState(false);
  const [appUsage, setAppUsage] = useState<AppUsageEntry[]>([]);
  const pulse = useRef(new Animated.Value(0)).current;
  const alarmsRef = useRef<Alarm[]>([]);

  useEffect(() => {
    alarmsRef.current = alarms;
  }, [alarms]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const loadAppUsage = useCallback(async () => {
    if (Platform.OS !== 'android' || !AppUsage) return;
    setUsageLoading(true);
    try {
      const allowed = await AppUsage.hasUsageAccess();
      setHasUsageAccess(allowed);
      if (allowed) {
        const entries = await AppUsage.getTodayUsage();
        setAppUsage(entries);
      } else {
        setAppUsage([]);
      }
    } catch (error) {
      setAppUsage([]);
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAppUsage();
    if (Platform.OS !== 'android') return undefined;

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        loadAppUsage();
      }
    });

    return () => subscription.remove();
  }, [loadAppUsage]);

  useEffect(() => {
    const boot = async () => {
      try {
        await Notifications.setNotificationCategoryAsync(notificationCategory, [
          {
            identifier: alarmActions.snooze,
            buttonTitle: `Snooze ${snoozeMinutes}m`
          },
          {
            identifier: alarmActions.stop,
            buttonTitle: 'Stop',
            options: { isDestructive: true }
          }
        ]);
        const [savedAlarms, savedPlans, savedRetros, savedTasks] = await Promise.all([
          loadJson<Alarm[]>(STORAGE_KEYS.alarms, []),
          loadJson<JournalEntry[]>(STORAGE_KEYS.plans, []),
          loadJson<JournalEntry[]>(STORAGE_KEYS.retros, []),
          loadJson<DailyTask[]>(STORAGE_KEYS.dailyTasks, defaultDailyTasks)
        ]);
        const activeAlarms = normalizeAlarms(savedAlarms);
        if (activeAlarms.length !== savedAlarms.length) {
          await saveJson(STORAGE_KEYS.alarms, activeAlarms);
        }
        setAlarms(activeAlarms);
        setPlans(savedPlans);
        setRetros(savedRetros);
        setDailyTasks(savedTasks);
      } catch (error) {
        Alert.alert('Storage issue', 'Aura Clock could not load saved data.');
      }
    };

    boot();
  }, []);

  useEffect(() => {
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const alarmId = notification.request.content.data?.alarmId as string | undefined;
      if (!alarmId) return;
      playSoftChime();
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const alarmId = response.notification.request.content.data?.alarmId as string | undefined;
        if (!alarmId) return;

        const currentAlarms = alarmsRef.current;
        const alarm = currentAlarms.find((item) => item.id === alarmId);
        if (!alarm) return;

        if (response.actionIdentifier === alarmActions.snooze) {
          const fireAt = new Date(Date.now() + snoozeMinutes * 60 * 1000);
          const notificationId = await scheduleAlarmNotification({
            alarmId,
            label: `${alarm.label} (snoozed)`,
            fireAt,
            repeat: 'once'
          });
          const updated = currentAlarms.map((item) =>
            item.id === alarmId
              ? {
                  ...item,
                  notificationId: item.repeat === 'once' ? notificationId : item.notificationId,
                  snoozeNotificationId: item.repeat === 'daily' ? notificationId : item.snoozeNotificationId,
                  fireAt: item.repeat === 'once' ? fireAt.toISOString() : item.fireAt,
                  label: item.label.replace(' (snoozed)', ''),
                  snoozed: true,
                  snoozedUntil: fireAt.toISOString()
                }
              : item
          );
          setAlarms(updated);
          await saveJson(STORAGE_KEYS.alarms, updated);
          return;
        }

        const updated =
          alarm.repeat === 'daily'
            ? currentAlarms.map((item) =>
                item.id === alarmId
                  ? {
                      ...item,
                      snoozed: false,
                      snoozedUntil: undefined,
                      snoozeNotificationId: undefined
                    }
                  : item
              )
            : currentAlarms.filter((item) => item.id !== alarmId);
        setAlarms(updated);
        await saveJson(STORAGE_KEYS.alarms, updated);
      }
    );

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!isSpeaking) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true
        })
      ])
    ).start();
  }, [isSpeaking, pulse]);

  const todayPlan = useMemo(
    () => plans.find((item) => item.date === isoDate(now)),
    [now, plans]
  );

  const todayRetro = useMemo(
    () => retros.find((item) => item.date === isoDate(now)),
    [now, retros]
  );

  const nextAlarm = useMemo(() => {
    return alarms
      .filter(isFutureAlarm)
      .sort((a, b) => getAlarmNextFireAt(a).getTime() - getAlarmNextFireAt(b).getTime())[0];
  }, [alarms]);

  const activeAlarms = useMemo(() => {
    return alarms
      .filter(isFutureAlarm)
      .sort((a, b) => getAlarmNextFireAt(a).getTime() - getAlarmNextFireAt(b).getTime());
  }, [alarms]);

  const planningStreak = useMemo(() => countCurrentStreak(plans), [plans]);
  const retroStreak = useMemo(() => countCurrentStreak(retros), [retros]);
  const averageMood = useMemo(
    () => average(retros.map((entry) => entry.mood).filter((value): value is number => typeof value === 'number')),
    [retros]
  );
  const averageEnergy = useMemo(
    () =>
      average(
        retros.map((entry) => entry.energy).filter((value): value is number => typeof value === 'number')
      ),
    [retros]
  );
  const activeDailyTasks = useMemo(() => dailyTasks.filter((task) => task.active), [dailyTasks]);
  const completedDailyTasks = useMemo(
    () => activeDailyTasks.filter((task) => isTaskDoneToday(task, isoDate(now))),
    [activeDailyTasks, now]
  );
  const taskCompletionRate = useMemo(
    () => getTaskCompletionRate(dailyTasks, isoDate(now)),
    [dailyTasks, now]
  );
  const bestTaskStreak = useMemo(
    () =>
      activeDailyTasks.reduce(
        (highest, task) => Math.max(highest, countDateStreak(task.completedDates)),
        0
      ),
    [activeDailyTasks]
  );
  const usage = useMemo(() => usageSummary(appUsage), [appUsage]);

  const speak = useCallback((text: string) => {
    setIsSpeaking(true);
    Speech.stop();
    Speech.speak(text, {
      pitch: 1.04,
      rate: 0.9,
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false)
    });
  }, []);

  const openUsageSettings = async () => {
    if (Platform.OS !== 'android' || !AppUsage) return;
    await AppUsage.openUsageAccessSettings();
  };

  const scheduleAlarm = async () => {
    const fireAt = parseAlarmTime(alarmTime);
    if (!fireAt) {
      Alert.alert('Use 24-hour time', 'Enter alarm time as HH:MM, for example 06:30.');
      return;
    }

    const permissions = await Notifications.requestPermissionsAsync();
    if (!permissions.granted) {
      Alert.alert('Notifications blocked', 'Enable notifications to schedule alarms.');
      return;
    }

    const alarmId = `${Date.now()}`;
    const label = alarmLabel.trim() || 'Aura alarm';
    const notificationId = await scheduleAlarmNotification({
      alarmId,
      label,
      fireAt,
      repeat: alarmRepeat
    });

    const alarm: Alarm = {
      id: alarmId,
      notificationId,
      label,
      fireAt: fireAt.toISOString(),
      enabled: true,
      repeat: alarmRepeat
    };
    const updated = [alarm, ...alarms];
    setAlarms(updated);
    await saveJson(STORAGE_KEYS.alarms, updated);
    setAlarmTime('');
    speak(`${alarm.label} is set for ${formatTime(fireAt)}.`);
  };

  const cancelAlarm = async (alarmId: string) => {
    const alarm = alarms.find((item) => item.id === alarmId);
    if (alarm?.notificationId) {
      await Notifications.cancelScheduledNotificationAsync(alarm.notificationId);
    }
    if (alarm?.snoozeNotificationId) {
      await Notifications.cancelScheduledNotificationAsync(alarm.snoozeNotificationId);
    }
    const updated = alarms.filter((item) => item.id !== alarmId);
    setAlarms(updated);
    await saveJson(STORAGE_KEYS.alarms, updated);
  };

  const snoozeAlarm = async (alarmId: string) => {
    const alarm = alarms.find((item) => item.id === alarmId);
    if (!alarm) return;
    if (alarm.repeat === 'once' && alarm.notificationId) {
      await Notifications.cancelScheduledNotificationAsync(alarm.notificationId);
    }
    if (alarm.snoozeNotificationId) {
      await Notifications.cancelScheduledNotificationAsync(alarm.snoozeNotificationId);
    }

    const fireAt = new Date(Date.now() + snoozeMinutes * 60 * 1000);
    const notificationId = await scheduleAlarmNotification({
      alarmId,
      label: `${alarm.label} (snoozed)`,
      fireAt,
      repeat: 'once'
    });
    const updated = alarms.map((item) =>
      item.id === alarmId
        ? {
            ...item,
            notificationId: item.repeat === 'once' ? notificationId : item.notificationId,
            snoozeNotificationId: item.repeat === 'daily' ? notificationId : item.snoozeNotificationId,
            fireAt: item.repeat === 'once' ? fireAt.toISOString() : item.fireAt,
            snoozed: true,
            snoozedUntil: fireAt.toISOString()
          }
        : item
    );
    setAlarms(updated);
    await saveJson(STORAGE_KEYS.alarms, updated);
    speak(`${alarm.label} snoozed for ${snoozeMinutes} minutes.`);
  };

  const saveMorningPlan = async () => {
    if (!morningText.trim()) return;
    const entry = {
      date: isoDate(),
      text: morningText.trim(),
      createdAt: new Date().toISOString()
    };
    const updated = [entry, ...plans.filter((item) => item.date !== entry.date)];
    setPlans(updated);
    await saveJson(STORAGE_KEYS.plans, updated);
    setMorningText('');
    speak('Morning plan saved. Start with the most meaningful task first.');
  };

  const saveEveningRetro = async () => {
    if (!eveningText.trim()) return;
    const entry = {
      date: isoDate(),
      text: eveningText.trim(),
      createdAt: new Date().toISOString(),
      mood: moodScore,
      energy: energyScore
    };
    const updated = [entry, ...retros.filter((item) => item.date !== entry.date)];
    setRetros(updated);
    await saveJson(STORAGE_KEYS.retros, updated);
    setEveningText('');
    setMoodScore(3);
    setEnergyScore(3);
    speak('Retrospection saved. Rest well and let tomorrow be lighter.');
  };

  const renderScreen = () => {
    if (activeTab === 'morning') {
      return (
        <ScreenShell tone="sunrise">
          <Hero
            title="Morning Planning"
            subtitle="Shape the day before the day shapes you."
            clock={formatTime(now)}
            pulse={pulse}
            isSpeaking={isSpeaking}
          />
          <AssistantCard
            title="Voice prompt"
            body="Good morning. What are the three outcomes that would make today feel complete?"
            onSpeak={() =>
              speak('Good morning. What are the three outcomes that would make today feel complete?')
            }
          />
          <InputPanel
            value={morningText}
            onChangeText={setMorningText}
            placeholder="Top priorities, appointments, workout, focus blocks..."
            action="Save Plan"
            onAction={saveMorningPlan}
          />
          {todayPlan ? <LogCard label="Today's plan" text={todayPlan.text} /> : null}
        </ScreenShell>
      );
    }

    if (activeTab === 'evening') {
      return (
        <ScreenShell tone="space">
          <Hero
            title="Evening Retrospection"
            subtitle="Close the loop with calm clarity."
            clock={formatTime(now)}
            pulse={pulse}
            isSpeaking={isSpeaking}
          />
          <AssistantCard
            title="Voice prompt"
            body="What worked today, what felt heavy, and what should tomorrow inherit?"
            onSpeak={() =>
              speak('What worked today, what felt heavy, and what should tomorrow inherit?')
            }
          />
          <InputPanel
            value={eveningText}
            onChangeText={setEveningText}
            placeholder="Wins, misses, mood, lessons, tomorrow's first move..."
            action="Save Retro"
            onAction={saveEveningRetro}
          />
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Daily signal</Text>
            <ScorePicker label="Mood" value={moodScore} onChange={setMoodScore} />
            <ScorePicker label="Energy" value={energyScore} onChange={setEnergyScore} />
          </View>
          {todayRetro ? <LogCard label="Today's retro" text={todayRetro.text} /> : null}
        </ScreenShell>
      );
    }

    if (activeTab === 'analytics') {
      return (
        <ScreenShell tone="midnight">
          <Hero
            title="Analytics"
            subtitle="Small records, visible patterns."
            clock={`${plans.length + retros.length} logs`}
            pulse={pulse}
            isSpeaking={isSpeaking}
          />
          <StatsRow
            stats={[
              { label: 'Plan streak', value: planningStreak },
              { label: 'Retro streak', value: retroStreak },
              { label: 'Active alarms', value: activeAlarms.length }
            ]}
          />
          <View style={styles.insightGrid}>
            <InsightCard label="Avg mood" value={averageMood ? `${averageMood}/5` : '—'} />
            <InsightCard label="Avg energy" value={averageEnergy ? `${averageEnergy}/5` : '—'} />
          </View>
          <UsagePanel
            entries={appUsage}
            hasAccess={hasUsageAccess}
            loading={usageLoading}
            totalLabel={usage.totalLabel}
            topLabel={usage.topLabel}
            onOpenSettings={openUsageSettings}
            onRefresh={loadAppUsage}
          />
          <History title="Recent plans" entries={plans} />
          <History title="Recent retros" entries={retros} />
        </ScreenShell>
      );
    }

    return (
      <ScreenShell tone="midnight">
        <Hero
          title={`${greetingFor(now)}, Chandra`}
          subtitle="Your mobile voice alarm and planning cockpit."
          clock={formatTime(now)}
          pulse={pulse}
          isSpeaking={isSpeaking}
        />
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Alarm</Text>
            <Pressable style={styles.smallButton} onPress={playSoftChime}>
              <Text style={styles.smallButtonText}>Test</Text>
            </Pressable>
          </View>
          <View style={styles.row}>
            <TextInput
              value={alarmTime}
              onChangeText={setAlarmTime}
              placeholder="06:30"
              placeholderTextColor="#8F8AA9"
              keyboardType="numbers-and-punctuation"
              style={[styles.input, styles.timeInput]}
            />
            <TextInput
              value={alarmLabel}
              onChangeText={setAlarmLabel}
              placeholder="Label"
              placeholderTextColor="#8F8AA9"
              style={[styles.input, styles.labelInput]}
            />
          </View>
          <RepeatControl value={alarmRepeat} onChange={setAlarmRepeat} />
          <Pressable style={styles.primaryButton} onPress={scheduleAlarm}>
            <Text style={styles.primaryButtonText}>Schedule Alarm</Text>
          </Pressable>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Next wake-up</Text>
          {nextAlarm ? (
            <View style={styles.nextAlarmBlock}>
              <View style={styles.alarmItem}>
                <View>
                  <Text style={styles.alarmTime}>{formatTime(getAlarmNextFireAt(nextAlarm))}</Text>
                  <Text style={styles.muted}>
                    {formatAlarmDate(getAlarmNextFireAt(nextAlarm))} • {nextAlarm.label}
                    {nextAlarm.repeat === 'daily' ? ' • Daily' : ''}
                  </Text>
                </View>
                <Pressable style={styles.ghostButton} onPress={() => cancelAlarm(nextAlarm.id)}>
                  <Text style={styles.ghostButtonText}>Cancel</Text>
                </Pressable>
              </View>
              <Pressable style={styles.snoozeButton} onPress={() => snoozeAlarm(nextAlarm.id)}>
                <Text style={styles.snoozeButtonText}>Snooze {snoozeMinutes} min</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.muted}>No active alarms yet.</Text>
          )}
        </View>

        <UsagePanel
          entries={appUsage}
          hasAccess={hasUsageAccess}
          loading={usageLoading}
          totalLabel={usage.totalLabel}
          topLabel={usage.topLabel}
          onOpenSettings={openUsageSettings}
          onRefresh={loadAppUsage}
        />

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Scheduled alarms</Text>
          {activeAlarms.length > 0 ? (
            activeAlarms.map((alarm) => (
              <View key={alarm.id} style={styles.scheduledAlarmRow}>
                <View>
                  <Text style={styles.scheduledAlarmTime}>
                    {formatTime(getAlarmNextFireAt(alarm))}
                  </Text>
                  <Text style={styles.muted}>
                    {formatAlarmDate(getAlarmNextFireAt(alarm))} • {alarm.label}
                    {alarm.repeat === 'daily' ? ' • Daily' : ''}
                  </Text>
                </View>
                <Pressable style={styles.ghostButton} onPress={() => cancelAlarm(alarm.id)}>
                  <Text style={styles.ghostButtonText}>Cancel</Text>
                </Pressable>
              </View>
            ))
          ) : (
            <Text style={styles.muted}>Set your first alarm above.</Text>
          )}
        </View>
      </ScreenShell>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.app}>
          {renderScreen()}
          <View style={styles.tabBar}>
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id)}
                  style={[styles.tab, active && styles.activeTab]}
                >
                  <Text style={[styles.tabIcon, active && styles.activeTabText]}>{tab.icon}</Text>
                  <Text style={[styles.tabText, active && styles.activeTabText]}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ScreenShell({ children, tone }: { children: ReactNode; tone: Tone }) {
  return (
    <ScrollView
      style={[styles.screen, toneStyles[tone]]}
      contentContainerStyle={styles.screenContent}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

function Hero({
  title,
  subtitle,
  clock,
  pulse,
  isSpeaking
}: {
  title: string;
  subtitle: string;
  clock: string;
  pulse: Animated.Value;
  isSpeaking: boolean;
}) {
  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.24]
  });
  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.92]
  });

  return (
    <View style={styles.hero}>
      <View style={styles.heroText}>
        <Text style={styles.clock}>{clock}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <View style={styles.voiceWrap}>
        <Animated.View style={[styles.voicePulse, { transform: [{ scale }], opacity }]} />
        <View style={[styles.voiceCore, isSpeaking && styles.voiceCoreActive]}>
          <Text style={styles.voiceIcon}>AI</Text>
        </View>
      </View>
    </View>
  );
}

function AssistantCard({
  title,
  body,
  onSpeak
}: {
  title: string;
  body: string;
  onSpeak: () => void;
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>{title}</Text>
        <Pressable style={styles.smallButton} onPress={onSpeak}>
          <Text style={styles.smallButtonText}>Speak</Text>
        </Pressable>
      </View>
      <Text style={styles.bodyText}>{body}</Text>
    </View>
  );
}

function InputPanel({
  value,
  onChangeText,
  placeholder,
  action,
  onAction
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <View style={styles.panel}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8F8AA9"
        multiline
        textAlignVertical="top"
        style={[styles.input, styles.textArea]}
      />
      <Pressable style={styles.primaryButton} onPress={onAction}>
        <Text style={styles.primaryButtonText}>{action}</Text>
      </Pressable>
    </View>
  );
}

function RepeatControl({
  value,
  onChange
}: {
  value: RepeatMode;
  onChange: (value: RepeatMode) => void;
}) {
  return (
    <View style={styles.segmentedControl}>
      {repeatOptions.map((option) => {
        const active = value === option.value;
        return (
          <Pressable
            key={option.value}
            style={[styles.segmentButton, active && styles.segmentButtonActive]}
            onPress={() => onChange(option.value)}
          >
            <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ScorePicker({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.scoreRow}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <View style={styles.scoreButtons}>
        {scoreValues.map((score) => {
          const active = value === score;
          return (
            <Pressable
              key={`${label}-${score}`}
              style={[styles.scoreButton, active && styles.scoreButtonActive]}
              onPress={() => onChange(score)}
            >
              <Text style={[styles.scoreButtonText, active && styles.scoreButtonTextActive]}>
                {score}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function InsightCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.insightCard}>
      <Text style={styles.insightValue}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

function LogCard({ label, text }: { label: string; text: string }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{label}</Text>
      <Text style={styles.bodyText}>{text}</Text>
    </View>
  );
}

function StatsRow({ stats }: { stats: Stat[] }) {
  return (
    <View style={styles.statsRow}>
      {stats.map((stat) => (
        <View key={stat.label} style={styles.statBox}>
          <Text style={styles.statValue}>{stat.value}</Text>
          <Text style={styles.muted}>{stat.label}</Text>
        </View>
      ))}
    </View>
  );
}

function UsagePanel({
  entries,
  hasAccess,
  loading,
  totalLabel,
  topLabel,
  onOpenSettings,
  onRefresh
}: {
  entries: AppUsageEntry[];
  hasAccess: boolean;
  loading: boolean;
  totalLabel: string;
  topLabel: string;
  onOpenSettings: () => void;
  onRefresh: () => void;
}) {
  if (Platform.OS !== 'android') {
    return (
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Phone usage</Text>
        <Text style={styles.bodyText}>
          iOS limits cross-app usage access, so this stays as reflection data on this device.
        </Text>
      </View>
    );
  }

  if (!hasAccess) {
    return (
      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Phone usage</Text>
          <Pressable style={styles.smallButton} onPress={onOpenSettings}>
            <Text style={styles.smallButtonText}>Allow</Text>
          </Pressable>
        </View>
        <Text style={styles.bodyText}>
          Grant Usage Access to show today&apos;s app time, top distractions, and evening patterns.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>Phone usage</Text>
        <Pressable style={styles.smallButton} onPress={onRefresh}>
          <Text style={styles.smallButtonText}>{loading ? 'Syncing' : 'Refresh'}</Text>
        </Pressable>
      </View>
      <View style={styles.usageSummaryRow}>
        <InsightCard label="Today" value={totalLabel} />
        <View style={styles.usageTopCard}>
          <Text style={styles.usageTopLabel}>Most used</Text>
          <Text style={styles.usageTopValue}>{topLabel}</Text>
        </View>
      </View>
      {entries.slice(0, 5).map((entry, index) => {
        const maxTime = entries[0]?.totalTimeMs || 1;
        const width = `${Math.max(8, Math.round((entry.totalTimeMs / maxTime) * 100))}%` as const;

        return (
          <View key={entry.packageName} style={styles.usageRow}>
            <View style={styles.usageRowHeader}>
              <Text style={styles.usageAppName}>
                {index + 1}. {entry.appName}
              </Text>
              <Text style={styles.usageDuration}>{formatDuration(entry.totalTimeMs)}</Text>
            </View>
            <View style={styles.usageTrack}>
              <View style={[styles.usageFill, { width }]} />
            </View>
          </View>
        );
      })}
      {entries.length === 0 ? <Text style={styles.muted}>No foreground app usage found today.</Text> : null}
    </View>
  );
}

function History({ title, entries }: { title: string; entries: JournalEntry[] }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{title}</Text>
      {entries.slice(0, 4).map((entry) => (
        <View key={`${title}-${entry.createdAt}`} style={styles.historyItem}>
          <Text style={styles.historyDate}>{entry.date}</Text>
          <Text style={styles.bodyText}>{entry.text}</Text>
        </View>
      ))}
      {entries.length === 0 ? <Text style={styles.muted}>No entries saved yet.</Text> : null}
    </View>
  );
}

const toneStyles = StyleSheet.create({
  sunrise: {
    backgroundColor: '#21131C'
  },
  space: {
    backgroundColor: '#121126'
  },
  midnight: {
    backgroundColor: '#11131D'
  }
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#11131D'
  },
  keyboard: {
    flex: 1
  },
  app: {
    flex: 1
  },
  screen: {
    flex: 1
  },
  screenContent: {
    padding: 18,
    paddingBottom: 112,
    gap: 16
  },
  hero: {
    minHeight: 210,
    borderRadius: 28,
    padding: 22,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)'
  },
  heroText: {
    flex: 1,
    paddingRight: 18
  },
  clock: {
    color: '#FFB07B',
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: 0
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    marginTop: 12,
    letterSpacing: 0
  },
  subtitle: {
    color: '#D9D5E8',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    letterSpacing: 0
  },
  voiceWrap: {
    width: 86,
    height: 86,
    alignItems: 'center',
    justifyContent: 'center'
  },
  voicePulse: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FF7A90'
  },
  voiceCore: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#221F35',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)'
  },
  voiceCoreActive: {
    backgroundColor: '#FF7A90'
  },
  voiceIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0
  },
  panel: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)'
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12
  },
  panelTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0
  },
  bodyText: {
    color: '#E7E3F3',
    fontSize: 15,
    lineHeight: 23,
    letterSpacing: 0
  },
  muted: {
    color: '#A9A3BE',
    fontSize: 14,
    letterSpacing: 0
  },
  row: {
    flexDirection: 'row',
    gap: 10
  },
  segmentedControl: {
    minHeight: 44,
    marginTop: 12,
    padding: 4,
    borderRadius: 16,
    flexDirection: 'row',
    backgroundColor: 'rgba(10,10,20,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  segmentButton: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  segmentButtonActive: {
    backgroundColor: 'rgba(255,122,144,0.22)'
  },
  segmentButtonText: {
    color: '#A9A3BE',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0
  },
  segmentButtonTextActive: {
    color: '#FFFFFF'
  },
  scoreRow: {
    marginTop: 14,
    gap: 10
  },
  scoreLabel: {
    color: '#E7E3F3',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0
  },
  scoreButtons: {
    flexDirection: 'row',
    gap: 8
  },
  scoreButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,20,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  scoreButtonActive: {
    backgroundColor: '#FF7A90',
    borderColor: '#FF7A90'
  },
  scoreButtonText: {
    color: '#A9A3BE',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0
  },
  scoreButtonTextActive: {
    color: '#FFFFFF'
  },
  input: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    backgroundColor: 'rgba(10,10,20,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    fontSize: 16,
    letterSpacing: 0
  },
  timeInput: {
    width: 92
  },
  labelInput: {
    flex: 1
  },
  textArea: {
    minHeight: 132,
    marginBottom: 14
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF7A90',
    marginTop: 14
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0
  },
  smallButton: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)'
  },
  smallButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0
  },
  ghostButton: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)'
  },
  ghostButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0
  },
  alarmItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16
  },
  nextAlarmBlock: {
    gap: 14
  },
  alarmTime: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 0
  },
  snoozeButton: {
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,176,123,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,176,123,0.24)'
  },
  snoozeButtonText: {
    color: '#FFB07B',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0
  },
  scheduledAlarmRow: {
    minHeight: 64,
    paddingTop: 14,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14
  },
  scheduledAlarmTime: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10
  },
  insightGrid: {
    flexDirection: 'row',
    gap: 10
  },
  usageSummaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14
  },
  usageTopCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)'
  },
  usageTopLabel: {
    color: '#A9A3BE',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: 6
  },
  usageTopValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 22,
    letterSpacing: 0
  },
  usageRow: {
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)'
  },
  usageRowHeader: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  usageAppName: {
    flex: 1,
    color: '#E7E3F3',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0
  },
  usageDuration: {
    color: '#FFB07B',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0
  },
  usageTrack: {
    height: 8,
    borderRadius: 4,
    marginTop: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(10,10,20,0.48)'
  },
  usageFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF7A90'
  },
  insightCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    backgroundColor: 'rgba(255,176,123,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,176,123,0.2)'
  },
  insightValue: {
    color: '#FFB07B',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 4
  },
  statBox: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)'
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0
  },
  historyItem: {
    paddingTop: 14,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)'
  },
  historyDate: {
    color: '#FFB07B',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 0
  },
  tabBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    minHeight: 72,
    borderRadius: 26,
    padding: 8,
    flexDirection: 'row',
    backgroundColor: 'rgba(18,17,31,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)'
  },
  tab: {
    flex: 1,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3
  },
  activeTab: {
    backgroundColor: 'rgba(255,122,144,0.18)'
  },
  tabIcon: {
    color: '#A9A3BE',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0
  },
  tabText: {
    color: '#A9A3BE',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0
  },
  activeTabText: {
    color: '#FFFFFF'
  }
});
