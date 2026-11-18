import { addDays, eachDayOfInterval, format, isSameDay, startOfDay, subDays } from 'date-fns';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { DoseActionSheet } from '@/components/dose/DoseActionSheet';
import { AppText } from '@/components/ui/AppText';
import { EmptyState, Notice, STATUS_META, StatusPill } from '@/components/ui/Bits';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Card, FadeIn } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { IconButton, Screen, ScreenHeader } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { colors, radii, spacing, TOUCH_TARGET } from '@/constants/theme';
import { afterSheetClose, useFeedback } from '@/contexts/FeedbackContext';
import { useCareData, useRecipientName } from '@/hooks/useCareData';
import { useNow } from '@/hooks/useNow';
import { useCareStore } from '@/stores/careStore';
import type { DoseOccurrence } from '@/types/models';
import { describeWindow, lateUntil } from '@/utils/doseText';
import { describeDay, formatTime, getOccurrencesForDate, getWeekRange, toDateKey } from '@/utils/schedule';

const DAYS_BEFORE = 7;
const DAYS_AFTER = 21;
const DAY_WIDTH = 60;

function DateStrip({ selected, now, onSelect }: { selected: Date; now: Date; onSelect: (date: Date) => void }) {
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const days = useMemo(
    () => eachDayOfInterval({ start: subDays(startOfDay(now), DAYS_BEFORE), end: addDays(startOfDay(now), DAYS_AFTER) }),
    // Rebuilt once per day rather than on every clock tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toDateKey(now)],
  );

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollTo({ x: Math.max(0, (DAYS_BEFORE - 1) * DAY_WIDTH), animated: false }), 60);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
      {days.map((day) => {
        const active = isSameDay(day, selected);
        const isToday = isSameDay(day, now);
        return (
          <PressableScale
            key={day.toISOString()}
            accessibilityLabel={format(day, 'EEEE, MMMM d')}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(day)}
            style={[styles.stripDay, active && styles.stripDayActive]}
          >
            <AppText variant="caption" color={active ? colors.textOnPrimary : colors.textMuted}>
              {format(day, 'EEE')}
            </AppText>
            <AppText variant="h3" color={active ? colors.textOnPrimary : colors.text}>
              {format(day, 'd')}
            </AppText>
            <View style={[styles.todayDot, isToday && { backgroundColor: active ? colors.honey : colors.primary }]} />
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

function DoseCard({
  dose,
  canAct,
  onAct,
  onMenu,
}: {
  dose: DoseOccurrence;
  canAct: boolean;
  onAct: () => void;
  onMenu: () => void;
}) {
  const data = useCareData();
  const voice = data.recordings.find((item) => item.id === dose.voiceRecordingId);
  const accent = STATUS_META[dose.status].color;

  return (
    <Card style={[styles.doseCard, { borderLeftColor: accent }]}>
      <View style={styles.doseTop}>
        <View style={styles.doseTime}>
          <AppText variant="h3">{format(dose.scheduledAt, 'h:mm')}</AppText>
          <AppText variant="caption" color={colors.textMuted}>
            {format(dose.scheduledAt, 'a')}
          </AppText>
        </View>
        <View style={styles.flex}>
          <AppText variant="title">{dose.medicationName}</AppText>
          <AppText variant="small" color={colors.textMuted}>
            {dose.doseLabel}
          </AppText>
          <StatusPill status={dose.status} confirmedLate={dose.confirmedLate} />
        </View>
        <PressableScale accessibilityLabel={`Options for ${dose.medicationName}`} onPress={onMenu} style={styles.menuButton}>
          <Icon name="edit-2" size={20} color={colors.primaryDark} />
        </PressableScale>
      </View>

      <View style={styles.doseMeta}>
        <View style={styles.metaRow}>
          <Icon name="clock" size={15} color={colors.textMuted} />
          <AppText variant="small" color={colors.textMuted}>
            On time {describeWindow(dose, data.settings)}
          </AppText>
        </View>
        <View style={styles.metaRow}>
          <Icon name="alert-triangle" size={15} color={colors.textMuted} />
          <AppText variant="small" color={colors.textMuted}>
            Late until {lateUntil(dose, data.settings)}
          </AppText>
        </View>
        <View style={styles.metaRow}>
          <Icon name="volume-2" size={15} color={colors.textMuted} />
          <AppText variant="small" color={colors.textMuted} style={styles.flex} numberOfLines={1}>
            {voice ? `"${voice.name}"` : 'No voice message'}
          </AppText>
        </View>
      </View>

      {canAct ? <Button compact variant="teal" icon="check" label="Confirm dose" onPress={onAct} /> : null}
    </Card>
  );
}

export default function ScheduleScreen() {
  const data = useCareData();
  const now = useNow();
  const recipient = useRecipientName();
  const deleteMedication = useCareStore((state) => state.deleteMedication);
  const { confirm, toast } = useFeedback();

  const [view, setView] = useState<'day' | 'week'>('day');
  const [selected, setSelected] = useState(() => new Date());
  const [activeDose, setActiveDose] = useState<DoseOccurrence | null>(null);
  const [menuDose, setMenuDose] = useState<DoseOccurrence | null>(null);

  const selectedKey = toDateKey(selected);
  const dayDoses = useMemo(() => getOccurrencesForDate(data, selectedKey, now), [data, selectedKey, now]);

  const weekDays = useMemo(() => {
    const { start, end } = getWeekRange(selected);
    return eachDayOfInterval({ start, end }).map((date) => ({
      date,
      doses: getOccurrencesForDate(data, toDateKey(date), now),
    }));
  }, [data, now, selected]);

  const canAct = (dose: DoseOccurrence) =>
    isSameDay(dose.scheduledAt, now) && ['upcoming', 'late', 'missed', 'away'].includes(dose.status);

  const handleDelete = (dose: DoseOccurrence) => {
    setMenuDose(null);
    afterSheetClose(async () => {
      const approved = await confirm({
        title: `Delete ${dose.medicationName}?`,
        message: 'All of its future reminders will stop. Doses already logged stay in History.',
        confirmLabel: 'Delete medication',
        destructive: true,
      });
      if (!approved) return;
      deleteMedication(dose.medicationId);
      toast('Medication deleted.');
    });
  };

  return (
    <Screen
      tabbed
      header={
        <ScreenHeader
          title="Schedule"
          showBack={false}
          right={<IconButton icon="plus" label="Add a medication" onPress={() => router.push('/medication/edit')} />}
        />
      }
    >
      <Segmented
        label="Schedule view"
        value={view}
        onChange={setView}
        options={[
          { value: 'day', label: 'Day' },
          { value: 'week', label: 'Week' },
        ]}
      />
      <DateStrip selected={selected} now={now} onSelect={setSelected} />

      {data.schedules.length === 0 ? (
        <EmptyState
          title="No medications yet"
          message={`Add ${recipient}'s dose times and they will appear here.`}
          actionLabel="Add a medication"
          onAction={() => router.push('/medication/edit')}
        />
      ) : view === 'day' ? (
        <FadeIn key={selectedKey} style={styles.list}>
          <View>
            <AppText variant="eyebrow" color={colors.primaryDark}>
              {describeDay(selected, now)}
            </AppText>
            <AppText variant="h2">{format(selected, 'EEEE, MMMM d')}</AppText>
          </View>
          {dayDoses.length === 0 ? (
            <Card>
              <AppText color={colors.textMuted} align="center">
                No doses scheduled on this day.
              </AppText>
            </Card>
          ) : (
            dayDoses.map((dose) => (
              <DoseCard
                key={dose.key}
                dose={dose}
                canAct={canAct(dose)}
                onAct={() => setActiveDose(dose)}
                onMenu={() => setMenuDose(dose)}
              />
            ))
          )}
        </FadeIn>
      ) : (
        <FadeIn key={`week-${toDateKey(weekDays[0].date)}`} style={styles.list}>
          {weekDays.map(({ date, doses }) => (
            <Card key={date.toISOString()} style={styles.weekCard}>
              <PressableScale
                accessibilityLabel={`Open ${format(date, 'EEEE, MMMM d')}`}
                onPress={() => {
                  setSelected(date);
                  setView('day');
                }}
                style={styles.weekHeader}
              >
                <AppText variant="title" style={styles.flex}>
                  {format(date, 'EEE, MMM d')}
                </AppText>
                <Icon name="chevron-right" size={18} color={colors.textMuted} />
              </PressableScale>
              {doses.length === 0 ? (
                <AppText variant="small" color={colors.textMuted}>
                  No doses
                </AppText>
              ) : (
                doses.map((dose) => (
                  <View key={dose.key} style={styles.weekRow}>
                    <AppText variant="smallBold" style={styles.weekTime}>
                      {formatTime(dose.time)}
                    </AppText>
                    <AppText variant="small" style={styles.flex} numberOfLines={1}>
                      {dose.medicationName}
                    </AppText>
                    <StatusPill status={dose.status} confirmedLate={dose.confirmedLate} />
                  </View>
                ))
              )}
            </Card>
          ))}
        </FadeIn>
      )}

      <Notice
        icon="shield"
        tone="honey"
        message={`Schedule changes are not medical advice. Please confirm dose instructions with ${recipient}'s care team.`}
      />

      <DoseActionSheet occurrence={activeDose} onClose={() => setActiveDose(null)} />

      <BottomSheet
        visible={Boolean(menuDose)}
        onClose={() => setMenuDose(null)}
        title={menuDose?.medicationName}
        subtitle={menuDose ? `${menuDose.doseLabel} · ${formatTime(menuDose.time)}` : undefined}
      >
        <Button
          label="Edit medication"
          variant="secondary"
          icon="edit-2"
          onPress={() => {
            const id = menuDose?.medicationId;
            setMenuDose(null);
            if (id) afterSheetClose(() => router.push({ pathname: '/medication/edit', params: { id } }));
          }}
        />
        <Button label="Delete medication" variant="danger" icon="trash-2" onPress={() => menuDose && handleDelete(menuDose)} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  strip: { gap: spacing.xs, paddingVertical: 2 },
  stripDay: {
    width: DAY_WIDTH - spacing.xs,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stripDayActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  todayDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'transparent' },
  list: { gap: spacing.sm },
  doseCard: { gap: spacing.sm, borderLeftWidth: 4 },
  doseTop: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  doseTime: { alignItems: 'flex-start', minWidth: 54 },
  menuButton: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
  },
  doseMeta: { gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weekCard: { gap: spacing.xs },
  weekHeader: { flexDirection: 'row', alignItems: 'center', minHeight: TOUCH_TARGET - 8 },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  weekTime: { minWidth: 72 },
});
