import { endOfMonth, format, isAfter, startOfDay, startOfMonth } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { MonthCalendar } from '@/components/dose/MonthCalendar';
import { AppText } from '@/components/ui/AppText';
import { Divider, EmptyState, IconBadge, Notice, STATUS_META, StatusPill } from '@/components/ui/Bits';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Card, FadeIn } from '@/components/ui/Card';
import { TextField } from '@/components/ui/Fields';
import { Icon } from '@/components/ui/Icon';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { TimeField } from '@/components/ui/TimeField';
import { colors, radii, spacing } from '@/constants/theme';
import { useFeedback } from '@/contexts/FeedbackContext';
import { useCareData, useTodaySnapshot } from '@/hooks/useCareData';
import { useNow } from '@/hooks/useNow';
import { useCareStore } from '@/stores/careStore';
import type { DoseEvent, DoseOccurrence } from '@/types/models';
import { describeEvent } from '@/utils/doseText';
import {
  combineDateTime,
  formatTime,
  fromDateKey,
  getOccurrencesForDate,
  getOccurrencesInRange,
  summarize,
  toDateKey,
} from '@/utils/schedule';

type CorrectionChoice = 'taken' | 'skipped' | 'unconfirmed';

function CorrectionSheet({ dose, onClose }: { dose: DoseOccurrence | null; onClose: () => void }) {
  const correctDose = useCareStore((state) => state.correctDose);
  const { toast } = useFeedback();
  const [choice, setChoice] = useState<CorrectionChoice>('taken');
  const [time, setTime] = useState('08:00');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!dose) return;
    setChoice(dose.status === 'taken' ? 'unconfirmed' : 'taken');
    setTime(dose.time);
    setReason('');
    setError(undefined);
  }, [dose]);

  const submit = () => {
    if (!dose) return;
    if (!reason.trim()) return setError('Please add a short reason. It is kept in the audit trail.');
    const takenAt = combineDateTime(dose.date, time);
    if (choice === 'taken' && isAfter(takenAt, new Date())) return setError('The time taken cannot be in the future.');
    correctDose(dose, { type: choice as DoseEvent['type'], takenAt: choice === 'taken' ? takenAt : undefined, reason });
    onClose();
    toast('Log corrected. The original entry was kept.');
  };

  return (
    <BottomSheet
      visible={Boolean(dose)}
      onClose={onClose}
      title="Correct this log"
      subtitle={dose ? `${dose.medicationName} · ${formatTime(dose.time)}` : undefined}
      footer={<Button label="Save correction" onPress={submit} />}
    >
      <Segmented
        label="Corrected status"
        value={choice}
        onChange={setChoice}
        options={[
          { value: 'taken', label: 'Taken' },
          { value: 'skipped', label: 'Skipped' },
          { value: 'unconfirmed', label: 'Not sure' },
        ]}
      />
      {choice === 'taken' ? <TimeField label="Time taken" value={time} onChange={setTime} /> : null}
      <TextField
        label="Reason for correction"
        value={reason}
        onChangeText={(value) => {
          setReason(value);
          setError(undefined);
        }}
        error={error}
        placeholder="For example, confirmed with Lola by phone"
        multiline
        maxLength={140}
      />
      <Notice icon="file-text" message="Corrections are added to the record. Earlier entries are never erased." />
    </BottomSheet>
  );
}

function TimelineItem({ dose, onCorrect }: { dose: DoseOccurrence; onCorrect: () => void }) {
  const meta = STATUS_META[dose.status];
  const canCorrect = dose.status !== 'upcoming';

  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineTop}>
        <IconBadge icon={meta.icon} tone={meta.tone} size={38} />
        <View style={styles.flex}>
          <AppText variant="title">{dose.medicationName}</AppText>
          <AppText variant="small" color={colors.textMuted}>
            {formatTime(dose.time)} · {dose.doseLabel}
          </AppText>
          <StatusPill status={dose.status} confirmedLate={dose.confirmedLate} />
        </View>
      </View>

      {dose.events.length > 0 ? (
        <View style={styles.audit}>
          {dose.events.map((event) => (
            <View key={event.id} style={styles.auditRow}>
              <Icon name={event.source === 'correction' ? 'edit-3' : 'check'} size={14} color={colors.textMuted} />
              <View style={styles.flex}>
                <AppText variant="small" color={colors.textMuted}>
                  {describeEvent(event)}
                </AppText>
                {event.reason ? (
                  <AppText variant="caption" color={colors.textMuted}>
                    Reason: {event.reason}
                  </AppText>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : dose.status === 'missed' ? (
        <AppText variant="small" color={colors.textMuted}>
          No confirmation was recorded for this dose.
        </AppText>
      ) : null}

      {canCorrect ? (
        <Button compact variant="ghost" icon="edit-2" label="Correct this log" onPress={onCorrect} containerStyle={styles.correct} />
      ) : null}
    </View>
  );
}

export default function HistoryScreen() {
  const data = useCareData();
  const now = useNow();
  const params = useLocalSearchParams<{ date?: string }>();
  const { week } = useTodaySnapshot(now);

  const [selected, setSelected] = useState(() => new Date());
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [correcting, setCorrecting] = useState<DoseOccurrence | null>(null);

  useEffect(() => {
    if (!params.date) return;
    const date = fromDateKey(params.date);
    setSelected(date);
    setMonth(startOfMonth(date));
  }, [params.date]);

  const selectedKey = toDateKey(selected);
  const dayDoses = useMemo(() => getOccurrencesForDate(data, selectedKey, now), [data, now, selectedKey]);

  const monthRate = useMemo(() => {
    const end = isAfter(endOfMonth(month), now) ? now : endOfMonth(month);
    if (isAfter(startOfDay(month), now)) return null;
    return summarize(getOccurrencesInRange(data, startOfMonth(month), end, now)).rate;
  }, [data, month, now]);

  const hasAnyHistory = data.schedules.length > 0;

  return (
    <Screen tabbed header={<ScreenHeader title="History" showBack={false} />}>
      {!hasAnyHistory ? (
        <EmptyState
          title="No history yet"
          message="Once doses are scheduled and confirmed, their story will appear here."
          actionLabel="Add a medication"
          onAction={() => router.push('/medication/edit')}
        />
      ) : (
        <>
          <Card style={styles.summary}>
            <IconBadge icon="heart" tone="coral" />
            <View style={styles.flex}>
              <AppText variant="title">
                {week.due === 0
                  ? 'No doses have come due this week yet.'
                  : `${week.confirmed} out of ${week.due} ${week.due === 1 ? 'dose' : 'doses'} confirmed this week.`}
              </AppText>
              {week.away > 0 ? (
                <AppText variant="small" color={colors.textMuted}>
                  {week.away} during Away mode, not counted.
                </AppText>
              ) : null}
            </View>
          </Card>

          <Card>
            <MonthCalendar
              month={month}
              selected={selected}
              now={now}
              monthRate={monthRate}
              onSelect={setSelected}
              onMonthChange={setMonth}
            />
          </Card>

          <FadeIn key={selectedKey} style={styles.dayBlock}>
            <View>
              <AppText variant="eyebrow" color={colors.primaryDark}>
                {format(selected, 'EEEE')}
              </AppText>
              <AppText variant="h2">{format(selected, 'MMMM d, yyyy')}</AppText>
            </View>
            {dayDoses.length === 0 ? (
              <Card>
                <AppText color={colors.textMuted} align="center">
                  No doses were scheduled on this day.
                </AppText>
              </Card>
            ) : (
              <Card style={styles.timeline}>
                {dayDoses.map((dose, index) => (
                  <View key={dose.key}>
                    {index > 0 ? <Divider /> : null}
                    <TimelineItem dose={dose} onCorrect={() => setCorrecting(dose)} />
                  </View>
                ))}
              </Card>
            )}
          </FadeIn>
        </>
      )}

      <CorrectionSheet dose={correcting} onClose={() => setCorrecting(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dayBlock: { gap: spacing.sm },
  timeline: { paddingVertical: spacing.xxs },
  timelineItem: { paddingVertical: spacing.sm, gap: spacing.xs },
  timelineTop: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  audit: { gap: 6, padding: spacing.xs, borderRadius: radii.sm, backgroundColor: colors.cream },
  auditRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  correct: { alignSelf: 'flex-start' },
});
