import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Divider } from '@/components/ui/Bits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { colors, spacing } from '@/constants/theme';

const GUIDES = [
  {
    question: 'How do I add or change a dose?',
    answer: 'Open the Schedule tab and tap the plus button to add a medication, or tap the pencil on a dose to edit it. Past history keeps the times it was logged at.',
  },
  {
    question: 'How do I record a voice reminder?',
    answer: 'Open the Voice tab, tap the red microphone, and speak for up to 30 seconds. Preview it, give it a name, and assign it to a dose.',
  },
  {
    question: 'Does a reminder mark the dose as taken?',
    answer: 'No. A dose only counts as taken when someone confirms it in the app. If it is not confirmed, it stays unconfirmed.',
  },
  {
    question: 'Why did a reminder not arrive?',
    answer: 'Check that notifications are allowed in Reminder preferences, that Away mode is off, and that the phone is not in a focus or silent mode. Open the app at least every two weeks so reminders stay scheduled.',
  },
  {
    question: 'Does the family get texted automatically?',
    answer: 'No. When a dose is unconfirmed, you can open a prepared text in your messages app, then review and send it yourself.',
  },
  {
    question: 'Is the bear real in this version?',
    answer: 'The Demo Bear is a simulation. Connection and battery values are invented for demonstration, and audio plays through this phone.',
  },
];

function Guide({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <PressableScale
        accessibilityLabel={question}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        pressedScale={0.99}
        style={styles.question}
      >
        <AppText variant="title" style={styles.flex}>
          {question}
        </AppText>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
      </PressableScale>
      {open ? (
        <AppText variant="small" color={colors.textMuted} style={styles.answer}>
          {answer}
        </AppText>
      ) : null}
    </View>
  );
}

export default function SupportScreen() {
  return (
    <Screen header={<ScreenHeader title="Support" />}>
      <AppText variant="h2">How can we help?</AppText>
      <Card style={styles.list}>
        {GUIDES.map((guide, index) => (
          <View key={guide.question}>
            {index > 0 ? <Divider /> : null}
            <Guide {...guide} />
          </View>
        ))}
      </Card>
      <Button label="Urgent help" variant="danger" icon="phone" onPress={() => router.push('/settings/urgent')} />
      <Button label="App information" variant="secondary" icon="info" onPress={() => router.push('/settings/about')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingVertical: spacing.xxs },
  question: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 56, paddingVertical: spacing.xs },
  answer: { paddingBottom: spacing.sm },
});
