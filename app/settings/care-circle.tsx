import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { ContactFormSheet } from '@/components/ContactFormSheet';
import { AppText } from '@/components/ui/AppText';
import { EmptyState, IconBadge, Notice, Tag } from '@/components/ui/Bits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { colors, spacing } from '@/constants/theme';
import { useFeedback } from '@/contexts/FeedbackContext';
import { useCareData } from '@/hooks/useCareData';
import { openSmsComposer } from '@/services/sms';
import { useCareStore } from '@/stores/careStore';
import type { FamilyContact } from '@/types/models';

export default function CareCircleScreen() {
  const data = useCareData();
  const deleteContact = useCareStore((state) => state.deleteContact);
  const { confirm, toast } = useFeedback();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<FamilyContact | null>(null);

  const recipient = data.recipient?.preferredName ?? 'your loved one';

  const openForm = (contact: FamilyContact | null) => {
    setEditing(contact);
    setSheetOpen(true);
  };

  const remove = async (contact: FamilyContact) => {
    const approved = await confirm({
      title: `Remove ${contact.name}?`,
      message: 'They will no longer be suggested for care texts.',
      confirmLabel: 'Remove contact',
      destructive: true,
    });
    if (!approved) return;
    deleteContact(contact.id);
    toast('Contact removed.');
  };

  const text = async (contact: FamilyContact) => {
    const result = await openSmsComposer([contact.phone], `Hi ${contact.name}, this is about ${recipient}'s care.`);
    if (result === 'unavailable') toast('This device cannot open a text message.', 'error');
  };

  return (
    <Screen header={<ScreenHeader title="Family care circle" />}>
      <Notice
        icon="shield"
        message="Contact details stay on this phone. Nothing is shared with anyone unless you choose to call or text them."
      />

      {data.contacts.length === 0 ? (
        <EmptyState
          title="No family contacts yet"
          message={`Add someone you trust to help look after ${recipient}.`}
          actionLabel="Add a contact"
          onAction={() => openForm(null)}
        />
      ) : (
        data.contacts.map((contact) => (
          <Card key={contact.id} style={styles.card}>
            <View style={styles.top}>
              <IconBadge icon="user" size={42} />
              <View style={styles.flex}>
                <AppText variant="title">{contact.name}</AppText>
                <AppText variant="small" color={colors.textMuted}>
                  {contact.relationship} · {contact.phone}
                </AppText>
                <View style={styles.tags}>
                  {contact.notifyMissedDose ? <Tag label="Unconfirmed doses" tone="teal" /> : null}
                  {contact.notifyBearIssues ? <Tag label="Bear issues" tone="brown" /> : null}
                  {contact.consentConfirmedAt ? null : <Tag label="Agreement needed" tone="coral" icon="alert-circle" />}
                </View>
              </View>
            </View>
            <View style={styles.actions}>
              <Button compact variant="secondary" icon="phone" label="Call" containerStyle={styles.flex} onPress={() => void Linking.openURL(`tel:${contact.phone.replace(/\s/g, '')}`)} />
              <Button compact variant="secondary" icon="message-circle" label="Text" containerStyle={styles.flex} onPress={() => void text(contact)} />
            </View>
            <View style={styles.actions}>
              <Button compact variant="ghost" icon="edit-2" label="Edit" containerStyle={styles.flex} onPress={() => openForm(contact)} />
              <Button compact variant="ghost" icon="trash-2" label="Remove" containerStyle={styles.flex} onPress={() => void remove(contact)} />
            </View>
          </Card>
        ))
      )}

      {data.contacts.length > 0 ? <Button label="Add a contact" icon="plus" onPress={() => openForm(null)} /> : null}

      <ContactFormSheet visible={sheetOpen} contact={editing} onClose={() => setSheetOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: spacing.xs },
  top: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  actions: { flexDirection: 'row', gap: spacing.xs },
});
