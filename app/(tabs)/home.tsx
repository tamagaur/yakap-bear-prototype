import { format, formatDistanceToNow, isSameDay } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { BearMascot } from '@/components/bear/BearMascot';
import { DoseActionSheet } from '@/components/dose/DoseActionSheet';
import { DoseRow } from '@/components/dose/DoseRow';
import { AppText } from '@/components/ui/AppText';
import {
  Divider,
  EmptyState,
  InfoLink,
  InfoPoint,
  ProgressRing,
  SectionHeader,
  StatusChip,
  StatusPill,
} from '@/components/ui/Bits';
import { Button } from '@/components/ui/Button';
import { Card, FadeIn } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { IconButton, Screen } from '@/components/ui/Screen';
import { colors, radii, shadows, spacing } from '@/constants/theme';
import { useCareData, useTodaySnapshot } from '@/hooks/useCareData';
import { useNow } from '@/hooks/useNow';
import { useBear } from '@/hooks/useServices';
import type { DoseOccurrence } from '@/types/models';
import { describeCountdown, describeDay, formatTime, getGreeting, toDateKey } from '@/utils/schedule';

function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <PressableScale accessibilityLabel={label} onPress={onPress} containerStyle={styles.quickWrap} style={styles.quick}>
      <View style={styles.quickIcon}>
        <Icon name={icon} size={20} color={colors.primaryDark} />
      </View>
      <AppText variant="caption" align="center" numberOfLines={1}>
        {label}
      </AppText>
    </PressableScale>
  );
}

function NextDoseCard({
  dose,
  now,
  celebrateKey,
  onConfirm,
}: {
  dose: DoseOccurrence;
  now: Date;
  celebrateKey: number;
  onConfirm: () => void;
}) {
  const data = useCareData();
  const { width } = useWindowDimensions();
  const voice = data.recordings.find((item) => item.id === dose.voiceRecordingId);
  const isToday = isSameDay(dose.scheduledAt, now);
  const countdown = dose.status === 'late' ? 'Waiting to confirm' : describeCountdown(dose.scheduledAt, now);
  const bearSize = width < 360 ? 92 : 116;

  return (
    <LinearGradient colors={['#FFFDF8', '#F8EAD7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <View style={styles.heroTop}>
        <View style={styles.heroText}>
          <AppText variant="eyebrow" color={colors.primaryDark}>
            {isToday ? 'Next dose' : describeDay(dose.scheduledAt, now)}
          </AppText>
          <AppText variant="display" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {formatTime(dose.time)}
          </AppText>
          <AppText variant="small" color={colors.textMuted} numberOfLines={1}>
            {countdown}
          </AppText>
        </View>
        <BearMascot size={bearSize} mood="idle" celebrateKey={celebrateKey} />
      </View>

      <View style={styles.medRow}>
        <View style={styles.medIcon}>
          <Icon name="package" size={18} color={colors.brownDark} />
        </View>
        <View style={styles.flex}>
          <AppText variant="title" numberOfLines={1}>
            {dose.medicationName}
          </AppText>
          <View style={styles.voiceLine}>
            <Icon name={voice ? 'volume-2' : 'volume-x'} size={13} color={colors.textMuted} />
            <AppText variant="caption" color={colors.textMuted} numberOfLines={1} style={styles.flex}>
              {voice ? voice.name : 'No voice message'}
            </AppText>
          </View>
        </View>
        <AppText variant="title" color={colors.brownDark}>
          {dose.doseLabel}
        </AppText>
      </View>

      {isToday ? (
        <Button label="Mark as taken" icon="check" variant="teal" onPress={onConfirm} />
      ) : (
        <StatusPill status={dose.status} />
      )}
    </LinearGradient>
  );
}

export default function HomeScreen() {
  const data = useCareData();
  const now = useNow(20_000);
  const bear = useBear();
  const { today, summary, nextDose, alerts, away } = useTodaySnapshot(now);
  const [activeDose, setActiveDose] = useState<DoseOccurrence | null>(null);
  const [celebrateKey, setCelebrateKey] = useState(0);

  const recipient = data.recipient?.preferredName ?? 'your loved one';
  const firstName = data.caregiver?.name.split(' ')[0] ?? 'there';
  const hasPlan = data.schedules.length > 0;
  const totalToday = summary.due + summary.upcoming + summary.away;
  const recentActivity = data.activity.slice(0, 2);
  const bearReady = bear.connection === 'connected';
  const bearLow = bearReady && (bear.battery ?? 100) <= 20;
  const progressLabel = `${summary.confirmed}/${totalToday} doses taken`;

  return (
    <Screen tabbed>
      <FadeIn style={styles.header}>
        <View style={styles.flex}>
          <AppText variant="eyebrow" color={colors.primaryDark}>
            {format(now, 'EEEE, MMM d')}
          </AppText>
          <AppText variant="h1" accessibilityRole="header" numberOfLines={2}>
            {getGreeting(now)}, {firstName}!
          </AppText>
        </View>
        <IconButton
          icon="bell"
          label="Care alerts"
          tone="card"
          badge={alerts.length}
          onPress={() => router.push('/alerts')}
        />
      </FadeIn>

      <View style={styles.chips}>
        {data.bear ? (
          <StatusChip
            label={bearLow ? 'Bear battery low' : bearReady ? 'Demo Bear active' : 'Bear offline'}
            tone={bearLow ? 'coral' : bearReady ? 'teal' : 'neutral'}
            onPress={() => router.push('/settings/bear')}
          />
        ) : (
          <StatusChip label="Pair Demo Bear" tone="neutral" icon="link" onPress={() => router.push('/settings/bear')} />
        )}
        {away ? (
          <InfoLink label="Away mode on" title="Away mode" tone="brown" icon="map-pin">
            <InfoPoint icon="bell-off" tone="brown" text="Phone reminders are paused." />
            <InfoPoint icon="calendar" text="The medication schedule hasn't changed." />
            <Button compact variant="secondary" label="Manage Away mode" onPress={() => router.push('/settings/away')} />
          </InfoLink>
        ) : null}
        {data.hasSamplePlan ? (
          <InfoLink label="Sample plan" title="Sample plan" icon="book-open">
            <InfoPoint icon="book-open" tone="honey" text="This is example data for demonstration." />
            <InfoPoint icon="trash-2" text="Remove it anytime in Settings › Medication plan." />
          </InfoLink>
        ) : null}
      </View>

      {alerts[0] ? (
        <Card onPress={() => router.push('/alerts')} accessibilityLabel={alerts[0].title} style={styles.alertCard} tone="flat">
          <Icon name="bell" size={18} color={colors.coralDeep} />
          <AppText variant="smallBold" style={styles.flex} numberOfLines={2}>
            {alerts[0].title}
          </AppText>
          <Icon name="chevron-right" size={18} color={colors.coralDeep} />
        </Card>
      ) : null}

      {!hasPlan ? (
        <EmptyState
          title="No medicines yet"
          message={`Add ${recipient}'s first dose.`}
          actionLabel="Add medication"
          onAction={() => router.push('/medication/edit')}
        />
      ) : nextDose ? (
        <FadeIn delay={60}>
          <NextDoseCard
            dose={nextDose}
            now={now}
            celebrateKey={celebrateKey}
            onConfirm={() => setActiveDose(nextDose)}
          />
        </FadeIn>
      ) : (
        <FadeIn delay={60} style={styles.allDone}>
          <BearMascot size={120} mood="celebrating" celebrateKey={celebrateKey} />
          <AppText variant="h3" align="center">
            All done for now!
          </AppText>
        </FadeIn>
      )}

      {today.length > 0 ? (
        <FadeIn delay={120}>
          <Card style={styles.todayCard}>
            <PressableScale
              accessibilityLabel={`${progressLabel}. Open history`}
              onPress={() => router.push({ pathname: '/history', params: { date: toDateKey(now) } })}
              pressedScale={0.99}
              style={styles.todayHeader}
            >
              <ProgressRing value={totalToday ? summary.confirmed / totalToday : 0} size={50} stroke={6} label="Doses taken today">
                <Icon name="heart" size={16} color={colors.primary} />
              </ProgressRing>
              <View style={styles.flex}>
                <AppText variant="caption" color={colors.textMuted}>
                  Today
                </AppText>
                <AppText variant="title">{progressLabel}</AppText>
              </View>
              <Icon name="chevron-right" size={20} color={colors.textMuted} />
            </PressableScale>
            {today.map((occurrence) => (
              <View key={occurrence.key}>
                <Divider />
                <DoseRow
                  occurrence={occurrence}
                  onPress={
                    occurrence.status === 'upcoming' || occurrence.status === 'late' || occurrence.status === 'missed'
                      ? () => setActiveDose(occurrence)
                      : () => router.push({ pathname: '/history', params: { date: occurrence.date } })
                  }
                />
              </View>
            ))}
          </Card>
        </FadeIn>
      ) : null}

      <View style={styles.quickRow}>
        <QuickAction icon="plus" label="Add dose" onPress={() => router.push('/medication/edit')} />
        <QuickAction icon="mic" label="Record" onPress={() => router.push('/voice')} />
        <QuickAction icon="users" label="Family" onPress={() => router.push('/settings/care-circle')} />
        <QuickAction icon="calendar" label="Schedule" onPress={() => router.push('/schedule')} />
      </View>

      {recentActivity.length > 0 ? (
        <View style={styles.activity}>
          <SectionHeader title="Recent" />
          {recentActivity.map((item) => (
            <View key={item.id} style={styles.activityRow}>
              <View style={styles.activityDot} />
              <AppText variant="small" style={styles.flex} numberOfLines={2}>
                {item.message}
              </AppText>
              <AppText variant="caption" color={colors.textMuted}>
                {formatDistanceToNow(new Date(item.at))}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}

      <AppText variant="caption" color={colors.textMuted} align="center" style={styles.disclaimer}>
        A reminder aid, not medical advice.
      </AppText>

      <DoseActionSheet
        occurrence={activeDose}
        onClose={() => setActiveDose(null)}
        onRecorded={() => setCelebrateKey((value) => value + 1)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: -spacing.xxs },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    backgroundColor: colors.coralSoft,
  },
  hero: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.raised,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heroText: { flex: 1, gap: 2 },
  medRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255, 252, 247, 0.85)',
  },
  medIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brownSoft,
  },
  voiceLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  allDone: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  todayCard: { paddingVertical: spacing.xs },
  todayHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  quickRow: { flexDirection: 'row', gap: spacing.xs },
  quickWrap: { flex: 1 },
  quick: { alignItems: 'center', gap: 6, paddingVertical: spacing.xs },
  quickIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  activity: { gap: spacing.xs },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  activityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.coral },
  disclaimer: { marginTop: spacing.xs },
});
