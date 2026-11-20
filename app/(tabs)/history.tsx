import { endOfMonth, format, isAfter, startOfDay, startOfMonth } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { MonthCalendar } from '@/components/dose/MonthCalendar';
import { AppText } from '@/components/ui/AppText';
import { Divider, EmptyState, IconBadge, Notice, ProgressRing, STATUS_META, StatusPill } from '@/components/ui/Bits';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Card, SwapIn } from '@/components/ui/Card';
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
    if (!reason.trim()) return setError('Please add a short reason.');
    const takenAt = combineDateTime(dose.date, time);
    if (choice === 'taken' && isAfter(takenAt, new Date())) return setError("That time hasn't happened yet.");
    correctDose(dose, { type: choice as DoseEvent['type'], takenAt: choice === 'taken' ? takenAt : undefined, reason });
    onClose();
    toast('Log corrected.');
  };

  return (
    <BottomSheet
      visible={Boolean(dose)}
      onClose={onClose}
      title="Correct log"
      subtitle={dose ? `${dose.medicationName} · ${formatTime(dose.time)}` : undefined}
      footer={<Button label="Save" onPress={submit} />}
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
        label="Reason"
        value={reason}
        onChangeText={(value) => {
          setReason(value);
          setError(undefined);
        }}
        error={error}
        placeholder="e.g. Confirmed with Lola by phone"
        multiline
        maxLength={140}
      />
      <Notice icon="file-text" message="The original entry is always kept." />
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
          <AppText variant="title" numberOfLines={1}>
            {dose.medicationName}
          </AppText>
          <AppText variant="small" color={colors.textMuted}>
            {formatTime(dose.time)} · {dose.doseLabel}
          </AppText>
        </View>
        <StatusPill status={dose.status} confirmedLate={dose.confirmedLate} />
      </View>

      {dose.events.length > 0 ? (
        <View style={styles.audit}>
          {dose.events.map((event) => (
            <View key={event.id} style={styles.auditRow}>
              <Icon name={event.source === 'correction' ? 'edit-3' : 'check'} size={13} color={colors.textMuted} />
              <View style={styles.flex}>
                <AppText variant="caption" color={colors.textMuted}>
                  {describeEvent(event)}
                </AppText>
                {event.reason ? (
                  <AppText variant="caption" color={colors.textMuted}>
                    “{event.reason}”
                  </AppText>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {canCorrect ? (
        <Button compact variant="ghost" icon="edit-2" label="Correct" onPress={onCorrect} containerStyle={styles.correct} />
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
  const weekValue = week.due > 0 ? week.confirmed / week.due : 0;

  return (
    <Screen tabbed header={<ScreenHeader large title="History" />}>
      {!hasAnyHistory ? (
        <EmptyState
          title="No history yet"
          message="Taken doses will show up here."
          actionLabel="Add medication"
          onAction={() => router.push('/medication/edit')}
        />
      ) : (
        <>
          <Card style={styles.summary}>
            <ProgressRing value={weekValue} size={64} stroke={7} label="Doses taken this week">
              <AppText variant="smallBold" color={colors.primaryDark}>
                {week.due > 0 ? `${Math.round(weekValue * 100)}%` : '–'}
              </AppText>
            </ProgressRing>
            <View style={styles.flex}>
              <AppText variant="caption" color={colors.textMuted}>
                This week
              </AppText>
              <AppText variant="h3">{week.due === 0 ? 'Nothing due yet' : `${week.confirmed}/${week.due} doses taken`}</AppText>
              {week.away > 0 ? (
                <AppText variant="caption" color={colors.textMuted}>
                  {week.away} away, not counted
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

          <SwapIn swapKey={selectedKey} style={styles.dayBlock}>
            <View style={styles.dayTitle}>
              <AppText variant="h3">{format(selected, 'EEEE')}</AppText>
              <AppText variant="small" color={colors.textMuted}>
                {format(selected, 'MMM d, yyyy')}
              </AppText>
            </View>
            {dayDoses.length === 0 ? (
              <EmptyState mood="sleepy" size={84} title="No doses this day" />
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
          </SwapIn>
        </>
      )}

      <CorrectionSheet dose={correcting} onClose={() => setCorrecting(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dayBlock: { gap: spacing.sm },
  dayTitle: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  timeline: { paddingVertical: spacing.xxs },
  timelineItem: { paddingVertical: spacing.sm, gap: spacing.xs },
  timelineTop: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  audit: { gap: 4, padding: spacing.xs, borderRadius: radii.sm, backgroundColor: colors.cream, marginLeft: 50 },
  auditRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  correct: { alignSelf: 'flex-start', marginLeft: 38 },
});
