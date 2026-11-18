import { format, formatDistanceToNow, isSameDay } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { BearFace, BearMascot } from '@/components/bear/BearMascot';
import { DoseActionSheet } from '@/components/dose/DoseActionSheet';
import { DoseRow } from '@/components/dose/DoseRow';
import { AppText } from '@/components/ui/AppText';
import {
  DemoTag,
  Divider,
  EmptyState,
  IconBadge,
  Notice,
  ProgressBar,
  SectionHeader,
  StatusPill,
  Tag,
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

const BEAR_NOTES = [
  'A familiar voice makes every reminder warmer.',
  'Small routines add up to big care.',
  'Thank you for looking after your family today.',
  'One gentle reminder at a time.',
  'You are doing a wonderful job.',
];

function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <PressableScale accessibilityLabel={label} onPress={onPress} containerStyle={styles.quickWrap} style={styles.quick}>
      <IconBadge icon={icon} size={40} />
      <AppText variant="caption" align="center">
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
  const countdown =
    dose.status === 'late' ? 'Waiting for confirmation' : describeCountdown(dose.scheduledAt, now);

  return (
    <LinearGradient colors={[colors.card, '#F6E8D6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <View style={styles.heroTop}>
        <View style={styles.flex}>
          <AppText variant="eyebrow" color={colors.primaryDark}>
            {isToday ? 'Next dose' : `Next dose · ${describeDay(dose.scheduledAt, now)}`}
          </AppText>
          <AppText variant="display" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            {formatTime(dose.time)}
          </AppText>
          <AppText color={colors.textMuted}>{countdown}</AppText>
          <View style={styles.heroPill}>
            <StatusPill status={dose.status} />
          </View>
        </View>
        <BearMascot size={width < 360 ? 84 : 118} floating celebrateKey={celebrateKey} />
      </View>
      <View style={styles.heroDetail}>
        <View style={styles.heroRow}>
          <AppText variant="title" style={styles.flex}>
            {dose.medicationName}
          </AppText>
          <AppText variant="h3">{dose.doseLabel}</AppText>
        </View>
        <View style={styles.heroVoice}>
          <Icon name="volume-2" size={16} color={colors.textMuted} />
          <AppText variant="small" color={colors.textMuted} style={styles.flex} numberOfLines={1}>
            {voice ? `Reminder: "${voice.name}"` : 'No voice message assigned yet'}
          </AppText>
        </View>
      </View>
      {isToday ? <Button label="Mark as taken" icon="check" variant="teal" onPress={onConfirm} /> : null}
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
  const note = BEAR_NOTES[now.getDate() % BEAR_NOTES.length];
  const recentActivity = data.activity.slice(0, 3);
  const bearReady = bear.connection === 'connected';
  const bearLow = bearReady && (bear.battery ?? 100) <= 20;
  const progressLabel = `${summary.confirmed} of ${totalToday} ${totalToday === 1 ? 'dose' : 'doses'} confirmed today`;

  return (
    <Screen tabbed>
      <FadeIn style={styles.header}>
        <View style={styles.flex}>
          <AppText variant="eyebrow" color={colors.primaryDark}>
            {format(now, 'EEEE, MMMM d')}
          </AppText>
          <AppText variant="h1" accessibilityRole="header">
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

      <FadeIn delay={40} style={styles.noteRow}>
        <BearFace size={34} />
        <AppText variant="small" color={colors.textMuted} style={styles.flex}>
          {note}
        </AppText>
      </FadeIn>

      {data.hasSamplePlan ? (
        <Notice
          icon="book-open"
          tone="honey"
          title="Sample care plan"
          message="Example data for demonstration. You can remove it in Settings."
        />
      ) : null}
      {away ? (
        <Notice
          icon="map-pin"
          tone="brown"
          title="Away mode is on"
          message="Phone reminders are paused. The medication schedule has not changed."
        />
      ) : null}
      {alerts[0] ? (
        <Card onPress={() => router.push('/alerts')} accessibilityLabel={alerts[0].title} style={styles.alertCard}>
          <Icon name="bell" size={20} color={colors.primaryDark} />
          <View style={styles.flex}>
            <AppText variant="smallBold">{alerts[0].title}</AppText>
            <AppText variant="small" color={colors.textMuted}>
              {alerts[0].body}
            </AppText>
          </View>
          <Icon name="arrow-right" size={20} color={colors.primaryDark} />
        </Card>
      ) : null}

      {!hasPlan ? (
        <EmptyState
          title="No medications yet"
          message={`Add ${recipient}'s first dose time and the bear will take it from there.`}
          actionLabel="Add a medication"
          onAction={() => router.push('/medication/edit')}
        />
      ) : nextDose ? (
        <FadeIn delay={80}>
          <NextDoseCard
            dose={nextDose}
            now={now}
            celebrateKey={celebrateKey}
            onConfirm={() => setActiveDose(nextDose)}
          />
        </FadeIn>
      ) : (
        <Card style={styles.allDone}>
          <BearMascot size={110} mood="happy" celebrateKey={celebrateKey} />
          <AppText variant="h3" align="center">
            All caught up
          </AppText>
          <AppText variant="small" color={colors.textMuted} align="center">
            No more doses are scheduled for {recipient} right now.
          </AppText>
        </Card>
      )}

      {totalToday > 0 ? (
        <Card
          onPress={() => router.push({ pathname: '/history', params: { date: toDateKey(now) } })}
          accessibilityLabel={`${progressLabel}. View details`}
          style={styles.progressCard}
        >
          <View style={styles.progressTop}>
            <AppText variant="title" style={styles.flex}>
              {progressLabel}
            </AppText>
            <Icon name="chevron-right" size={20} color={colors.textMuted} />
          </View>
          <ProgressBar value={summary.confirmed / totalToday} label="Doses confirmed today" />
        </Card>
      ) : null}

      {today.length > 0 ? (
        <>
          <SectionHeader title="Today's doses" action="View schedule" onAction={() => router.push('/schedule')} />
          <Card style={styles.listCard}>
            {today.map((occurrence, index) => (
              <View key={occurrence.key}>
                {index > 0 ? <Divider /> : null}
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
        </>
      ) : null}

      <SectionHeader title={`${recipient}'s bear`} />
      <Card onPress={() => router.push('/settings/bear')} accessibilityLabel="Bear status" style={styles.bearCard}>
        <BearFace size={54} />
        <View style={styles.flex}>
          <AppText variant="title">{data.bear ? `${data.bear.serial} ${bearReady ? 'is ready' : 'is offline'}` : 'No bear paired'}</AppText>
          <View style={styles.statusLine}>
            <View style={[styles.statusDot, { backgroundColor: bearReady ? colors.primary : colors.borderStrong }]} />
            <AppText variant="small" color={colors.textMuted}>
              {bearReady ? `Simulated · ${bear.battery ?? 0}% battery` : 'Tap to set up the Demo Bear'}
            </AppText>
          </View>
          <View style={styles.bearTags}>
            <DemoTag label="Demo Bear" />
            {bearLow ? <Tag label="Low battery (simulated)" tone="coral" icon="battery" /> : null}
          </View>
        </View>
        <Icon name="chevron-right" size={20} color={colors.textMuted} />
      </Card>

      <SectionHeader title="Quick actions" />
      <View style={styles.quickRow}>
        <QuickAction icon="plus" label="Add dose" onPress={() => router.push('/medication/edit')} />
        <QuickAction icon="mic" label="Record voice" onPress={() => router.push('/voice')} />
        <QuickAction icon="users" label="Care circle" onPress={() => router.push('/settings/care-circle')} />
        <QuickAction icon="play" label="Preview" onPress={() => router.push('/settings/bear')} />
      </View>

      {recentActivity.length > 0 ? (
        <>
          <SectionHeader title="Care circle activity" />
          <Card style={styles.listCard}>
            {recentActivity.map((item, index) => (
              <View key={item.id}>
                {index > 0 ? <Divider /> : null}
                <View style={styles.activityRow}>
                  <Icon name="heart" size={17} color={colors.coralDeep} />
                  <View style={styles.flex}>
                    <AppText variant="small">{item.message}</AppText>
                    <AppText variant="caption" color={colors.textMuted}>
                      {formatDistanceToNow(new Date(item.at), { addSuffix: true })}
                    </AppText>
                  </View>
                </View>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <AppText variant="caption" color={colors.textMuted} align="center">
        Yakap Bear is a reminder aid and does not give medical advice. Follow your care team's instructions.
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
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  alertCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primarySoft },
  hero: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.raised,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  heroPill: { marginTop: spacing.xs },
  heroDetail: { gap: spacing.xs, padding: spacing.sm, borderRadius: radii.md, backgroundColor: 'rgba(255, 252, 247, 0.8)' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  heroVoice: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  allDone: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xl },
  progressCard: { gap: spacing.sm },
  progressTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  listCard: { paddingVertical: spacing.xs },
  bearCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  bearTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  quickRow: { flexDirection: 'row', gap: spacing.xs },
  quickWrap: { flex: 1 },
  quick: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activityRow: { flexDirection: 'row', gap: spacing.xs, paddingVertical: spacing.sm, alignItems: 'flex-start' },
});
