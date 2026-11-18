/**
 * Browser stand-in used only when previewing the app on the web. Expo Go on a phone uses
 * voiceFiles.ts, which stores audio in the app's private document folder.
 */
const PREFIX = 'yakap.voice.';

const readAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('The recording could not be read.'));
    reader.readAsDataURL(blob);
  });

export async function persistVoiceFile(tempUri: string, id: string): Promise<string> {
  const response = await fetch(tempUri);
  const dataUrl = await readAsDataUrl(await response.blob());
  const fileName = `${id}.webm`;
  localStorage.setItem(PREFIX + fileName, dataUrl);
  return fileName;
}

export function resolveVoiceUri(fileName: string): string | null {
  return localStorage.getItem(PREFIX + fileName);
}

export function deleteVoiceFile(fileName: string) {
  localStorage.removeItem(PREFIX + fileName);
}

export function deleteTempVoiceFile(uri: string) {
  if (uri.startsWith('blob:')) URL.revokeObjectURL(uri);
}

export function deleteAllVoiceFiles() {
  Object.keys(localStorage)
    .filter((key) => key.startsWith(PREFIX))
    .forEach((key) => localStorage.removeItem(key));
}
