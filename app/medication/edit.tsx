import { router, useLocalSearchParams } from 'expo-router';

import { MedicationForm } from '@/components/dose/MedicationForm';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { useFeedback } from '@/contexts/FeedbackContext';
import { useCareStore } from '@/stores/careStore';

export default function EditMedicationScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const saveMedication = useCareStore((state) => state.saveMedication);
  const deleteMedication = useCareStore((state) => state.deleteMedication);
  const medicationName = useCareStore((state) => state.data.medications.find((item) => item.id === id)?.name);
  const { confirm, toast } = useFeedback();

  const handleDelete = async () => {
    const approved = await confirm({
      title: `Delete ${medicationName ?? 'this medication'}?`,
      message: 'Future reminders will stop. Doses already logged stay in History.',
      confirmLabel: 'Delete medication',
      destructive: true,
    });
    if (!approved || !id) return;
    deleteMedication(id);
    toast('Medication deleted.');
    router.back();
  };

  return (
    <Screen header={<ScreenHeader backIcon="x" title={id ? 'Edit medication' : 'Add medication'} />}>
      <MedicationForm
        medicationId={id}
        onSaved={(input) => {
          saveMedication(input);
          toast(id ? 'Schedule updated.' : 'Medication added.');
          router.back();
        }}
        onDelete={id ? () => void handleDelete() : undefined}
      />
    </Screen>
  );
}
