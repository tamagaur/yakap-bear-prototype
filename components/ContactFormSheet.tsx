import { useEffect, useState } from 'react';

import { Notice } from '@/components/ui/Bits';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Checkbox, SelectField, TextField, ToggleRow } from '@/components/ui/Fields';
import { CONTACT_RELATIONSHIP_OPTIONS } from '@/constants/defaults';
import { useCareStore } from '@/stores/careStore';
import type { ContactInput, FamilyContact } from '@/types/models';
import { isValidPhone } from '@/utils/validation';

const blank: ContactInput = {
  name: '',
  relationship: '',
  phone: '',
  notifyMissedDose: true,
  notifyBearIssues: false,
  consentConfirmed: false,
};

type Errors = Partial<Record<'name' | 'relationship' | 'phone' | 'consent', string>>;

export function ContactFormSheet({
  visible,
  contact,
  onClose,
}: {
  visible: boolean;
  contact?: FamilyContact | null;
  onClose: () => void;
}) {
  const saveContact = useCareStore((state) => state.saveContact);
  const [form, setForm] = useState<ContactInput>(blank);
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    if (!visible) return;
    setErrors({});
    setForm(
      contact
        ? {
            id: contact.id,
            name: contact.name,
            relationship: contact.relationship,
            phone: contact.phone,
            notifyMissedDose: contact.notifyMissedDose,
            notifyBearIssues: contact.notifyBearIssues,
            consentConfirmed: Boolean(contact.consentConfirmedAt),
          }
        : blank,
    );
  }, [contact, visible]);

  const patch = (next: Partial<ContactInput>) => {
    setForm((current) => ({ ...current, ...next }));
    setErrors((current) => ({
      name: 'name' in next ? undefined : current.name,
      relationship: 'relationship' in next ? undefined : current.relationship,
      phone: 'phone' in next ? undefined : current.phone,
      consent: 'consentConfirmed' in next ? undefined : current.consent,
    }));
  };

  const submit = () => {
    const nextErrors: Errors = {};
    if (!form.name.trim()) nextErrors.name = 'Please enter a name.';
    if (!form.relationship) nextErrors.relationship = 'Please choose a relationship.';
    if (!isValidPhone(form.phone)) nextErrors.phone = 'Please enter a valid phone number.';
    if (!form.consentConfirmed) nextErrors.consent = 'Please confirm this person has agreed.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    saveContact(form);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={contact ? 'Edit contact' : 'Add a trusted contact'}
      footer={<Button label={contact ? 'Save changes' : 'Add contact'} onPress={submit} />}
    >
      <TextField label="Name" value={form.name} onChangeText={(name) => patch({ name })} error={errors.name} autoCapitalize="words" />
      <SelectField
        label="Relationship"
        value={form.relationship}
        options={CONTACT_RELATIONSHIP_OPTIONS}
        onChange={(relationship) => patch({ relationship })}
        error={errors.relationship}
      />
      <TextField
        label="Phone number"
        value={form.phone}
        onChangeText={(phone) => patch({ phone })}
        error={errors.phone}
        keyboardType="phone-pad"
        autoComplete="tel"
        placeholder="+63 900 000 0000"
      />
      <ToggleRow
        label="Unconfirmed doses"
        description="Suggest this person when a dose is not confirmed."
        value={form.notifyMissedDose}
        onChange={(notifyMissedDose) => patch({ notifyMissedDose })}
      />
      <ToggleRow
        label="Bear issues"
        description="Suggest this person when the bear needs attention."
        value={form.notifyBearIssues}
        onChange={(notifyBearIssues) => patch({ notifyBearIssues })}
      />
      <Notice
        icon="message-square"
        message="This number is stored on this phone. Yakap Bear never texts anyone on its own. You review and send each message yourself."
      />
      <Checkbox
        label="This person has agreed to receive care updates"
        checked={form.consentConfirmed}
        onChange={(consentConfirmed) => patch({ consentConfirmed })}
        error={errors.consent}
      />
    </BottomSheet>
  );
}
