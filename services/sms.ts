import * as SMS from 'expo-sms';
import { Linking, Platform } from 'react-native';

/**
 * "opened" means the phone's SMS app was shown. The app cannot tell whether a text was
 * delivered, so nothing here should ever be reported to the user as delivered.
 */
export type SmsComposerResult = 'opened' | 'cancelled' | 'unavailable';

export async function openSmsComposer(phones: string[], message: string): Promise<SmsComposerResult> {
  try {
    if (await SMS.isAvailableAsync()) {
      const { result } = await SMS.sendSMSAsync(phones, message);
      return result === 'cancelled' ? 'cancelled' : 'opened';
    }
  } catch {
    // Fall through to the sms: link below.
  }

  const separator = Platform.OS === 'ios' ? '&' : '?';
  const url = `sms:${phones.join(',')}${separator}body=${encodeURIComponent(message)}`;
  try {
    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
      return 'opened';
    }
  } catch {
    return 'unavailable';
  }
  return 'unavailable';
}
