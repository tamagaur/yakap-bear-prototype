import { addDays, eachDayOfInterval, format, isSameDay, startOfDay, subDays } from 'date-fns';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { DoseActionSheet } from '@/components/dose/DoseActionSheet';
import { AppText } from '@/components/ui/AppText';
import { Divider, EmptyState, STATUS_META, StatusPill } from '@/components/ui/Bits';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Card, SwapIn } from '@/components/ui/Card';
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
  const meta = STATUS_META[dose.status];

  return (
    <Card style={styles.doseCard}>
      <View style={styles.doseTop}>
        <View style={[styles.doseTime, { backgroundColor: `${meta.color}1A` }]}>
          <AppText variant="h3" color={meta.color}>
            {format(dose.scheduledAt, 'h:mm')}
          </AppText>
          <AppText variant="caption" color={meta.color} style={styles.period}>
            {format(dose.scheduledAt, 'a')}
          </AppText>
        </View>
        <View style={styles.doseInfo}>
          <AppText variant="title" numberOfLines={1}>
            {dose.medicationName}
          </AppText>
          <AppText variant="small" color={colors.textMuted} numberOfLines={1}>
            {dose.doseLabel}
          </AppText>
          <StatusPill status={dose.status} confirmedLate={dose.confirmedLate} />
        </View>
        <PressableScale
          accessibilityLabel={`Options for ${dose.medicationName}`}
          onPress={onMenu}
          hitSlop={6}
          style={styles.menuButton}
        >
          <Icon name="more-horizontal" size={20} color={colors.textMuted} />
        </PressableScale>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Icon name="clock" size={13} color={colors.textMuted} />
          <AppText variant="caption" color={colors.textMuted}>
            {describeWindow(dose, data.settings)}
          </AppText>
        </View>
        <View style={[styles.metaItem, styles.flex]}>
          <Icon name={voice ? 'volume-2' : 'volume-x'} size={13} color={colors.textMuted} />
          <AppText variant="caption" color={colors.textMuted} numberOfLines={1} style={styles.flex}>
            {voice ? voice.name : 'No voice'}
          </AppText>
        </View>
      </View>
      {dose.status === 'late' ? (
        <AppText variant="caption" color={colors.honeyDark}>
          Confirm by {lateUntil(dose, data.settings)}
        </AppText>
      ) : null}

      {canAct ? <Button compact variant="teal" icon="check" label="Mark as taken" onPress={onAct} /> : null}
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
        message: 'Future reminders stop. Past logs stay in History.',
        confirmLabel: 'Delete',
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
          large
          title="Schedule"
          right={<IconButton icon="plus" tone="card" label="Add medication" onPress={() => router.push('/medication/edit')} />}
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
          title="No medicines yet"
          message={`Add ${recipient}'s dose times.`}
          actionLabel="Add medication"
          onAction={() => router.push('/medication/edit')}
        />
      ) : view === 'day' ? (
        <SwapIn swapKey={selectedKey} style={styles.list}>
          <View style={styles.dayTitle}>
            <AppText variant="h3">{describeDay(selected, now)}</AppText>
            <AppText variant="small" color={colors.textMuted}>
              {format(selected, 'EEE, MMM d')}
            </AppText>
          </View>
          {dayDoses.length === 0 ? (
            <EmptyState mood="sleepy" size={90} title="Nothing scheduled" />
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
        </SwapIn>
      ) : (
        <SwapIn swapKey={`week-${toDateKey(weekDays[0].date)}`}>
          <Card style={styles.weekCard}>
            {weekDays.map(({ date, doses }, index) => {
              const isToday = isSameDay(date, now);
              return (
                <View key={date.toISOString()}>
                  {index > 0 ? <Divider /> : null}
                  <PressableScale
                    accessibilityLabel={`Open ${format(date, 'EEEE, MMMM d')}`}
                    onPress={() => {
                      setSelected(date);
                      setView('day');
                    }}
                    pressedScale={0.99}
                    style={styles.weekRow}
                  >
                    <View style={[styles.weekDay, isToday && styles.weekDayToday]}>
                      <AppText variant="caption" color={isToday ? colors.textOnPrimary : colors.textMuted}>
                        {format(date, 'EEE')}
                      </AppText>
                      <AppText variant="title" color={isToday ? colors.textOnPrimary : colors.text}>
                        {format(date, 'd')}
                      </AppText>
                    </View>
                    <View style={styles.weekDoses}>
                      {doses.length === 0 ? (
                        <AppText variant="small" color={colors.textMuted}>
                          No doses
                        </AppText>
                      ) : (
                        doses.map((dose) => (
                          <View key={dose.key} style={styles.weekDose}>
                            <View style={[styles.weekDot, { backgroundColor: STATUS_META[dose.status].color }]} />
                            <AppText variant="smallBold" style={styles.weekTime}>
                              {formatTime(dose.time)}
                            </AppText>
                            <AppText variant="small" color={colors.textMuted} numberOfLines={1} style={styles.flex}>
                              {dose.medicationName}
                            </AppText>
                          </View>
                        ))
                      )}
                    </View>
                    <Icon name="chevron-right" size={18} color={colors.textMuted} />
                  </PressableScale>
                </View>
              );
            })}
          </Card>
        </SwapIn>
      )}

      <AppText variant="caption" color={colors.textMuted} align="center">
        Follow your care team&apos;s dose instructions.
      </AppText>

      <DoseActionSheet occurrence={activeDose} onClose={() => setActiveDose(null)} />

      <BottomSheet
        visible={Boolean(menuDose)}
        onClose={() => setMenuDose(null)}
        title={menuDose?.medicationName}
        subtitle={menuDose ? `${menuDose.doseLabel} · ${formatTime(menuDose.time)}` : undefined}
      >
        <Button
          label="Edit"
          variant="secondary"
          icon="edit-2"
          onPress={() => {
            const id = menuDose?.medicationId;
            setMenuDose(null);
            if (id) afterSheetClose(() => router.push({ pathname: '/medication/edit', params: { id } }));
          }}
        />
        <Button label="Delete" variant="danger" icon="trash-2" onPress={() => menuDose && handleDelete(menuDose)} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  strip: { gap: spacing.xs, paddingVertical: 2 },
  stripDay: {
    width: DAY_WIDTH - spacing.xs,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stripDayActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  todayDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'transparent' },
  list: { gap: spacing.sm },
  dayTitle: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs, marginTop: spacing.xxs },
  doseCard: { gap: spacing.sm },
  doseTop: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  doseTime: { width: 64, paddingVertical: spacing.xs, borderRadius: radii.md, alignItems: 'center' },
  period: { fontSize: 11, lineHeight: 14 },
  doseInfo: { flex: 1, gap: 3 },
  menuButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: colors.cream,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  weekCard: { paddingVertical: spacing.xxs },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: TOUCH_TARGET + 8,
  },
  weekDay: { width: 46, paddingVertical: 4, borderRadius: radii.md, alignItems: 'center', backgroundColor: colors.cream },
  weekDayToday: { backgroundColor: colors.primary },
  weekDoses: { flex: 1, gap: 4 },
  weekDose: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weekDot: { width: 8, height: 8, borderRadius: 4 },
  weekTime: { minWidth: 66 },
});
