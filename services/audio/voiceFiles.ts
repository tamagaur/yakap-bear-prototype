import { Directory, File, Paths } from 'expo-file-system';

const FOLDER = 'voice-reminders';

function voiceDirectory(): Directory {
  const directory = new Directory(Paths.document, FOLDER);
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
  return directory;
}

function normalizeUri(uri: string): string {
  return uri.startsWith('/') ? `file://${uri}` : uri;
}

function extensionOf(uri: string): string {
  const match = /\.([a-z0-9]{2,5})(?:[?#].*)?$/i.exec(uri);
  return match ? `.${match[1].toLowerCase()}` : '.m4a';
}

/** Moves a finished take out of the temporary cache and into permanent app storage. */
export async function persistVoiceFile(tempUri: string, id: string): Promise<string> {
  const source = new File(normalizeUri(tempUri));
  if (!source.exists) throw new Error('The recording file could not be found.');
  const fileName = `${id}${extensionOf(tempUri)}`;
  const destination = new File(voiceDirectory(), fileName);
  source.copySync(destination, { overwrite: true });
  if (!destination.exists) throw new Error('The recording could not be saved.');
  deleteTempVoiceFile(tempUri);
  return fileName;
}

export function resolveVoiceUri(fileName: string): string | null {
  try {
    const file = new File(voiceDirectory(), fileName);
    return file.exists && (file.size ?? 0) > 0 ? file.uri : null;
  } catch {
    return null;
  }
}

export function deleteVoiceFile(fileName: string) {
  try {
    const file = new File(voiceDirectory(), fileName);
    if (file.exists) file.delete();
  } catch {
    // A file that is already gone needs no further cleanup.
  }
}

export function deleteTempVoiceFile(uri: string) {
  try {
    const file = new File(normalizeUri(uri));
    if (file.exists) file.delete();
  } catch {
    // Temporary files are also cleared by the operating system.
  }
}

export function deleteAllVoiceFiles() {
  try {
    const directory = new Directory(Paths.document, FOLDER);
    if (directory.exists) directory.delete();
  } catch {
    // Nothing to remove.
  }
}
