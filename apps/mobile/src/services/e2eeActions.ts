/**
 * What a person can do with encrypted messages on mobile, with the explanations they need first.
 * Used by the Settings switch and the chat banners so the wording and safety steps are identical to the web app.
 */
import { Alert } from 'react-native';
import { getSupabaseClient } from '@cinecraft/api';
import { enableE2EE, disableE2EE } from './e2eeState';

/** Alert.alert as a promise: resolves true when the person taps the confirm button. */
export const confirmAsync = (title: string, message: string, confirmLabel = 'Confirm', destructive = false): Promise<boolean> =>
  new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });

const currentUserId = async (): Promise<string> => {
  const { data } = await getSupabaseClient().auth.getUser();
  const id = data?.user?.id;
  if (!id) throw new Error('Please sign in again.');
  return id;
};

export const turnOnEncryptedMessages = async (): Promise<boolean> => {
  const ok = await confirmAsync(
    'Turn on encrypted messages?',
    'Messages with people who also turn it on will be end-to-end encrypted: only the two of you can read them, not even CineCraft. You will create a 6-digit PIN so you can restore your chats on a new device. If you forget the PIN and lose this device, those messages cannot be recovered.',
    'Turn on',
  );
  if (!ok) return false;
  await enableE2EE(await currentUserId());
  return true;
};

export const turnOffEncryptedMessages = async (): Promise<boolean> => {
  const ok = await confirmAsync(
    'Turn off encrypted messages?',
    'New messages will be sent without end-to-end encryption, and people will see that you turned it off. Your keys and PIN backup are kept, so your old encrypted messages stay readable and you can turn it on again any time.',
    'Turn off',
    true,
  );
  if (!ok) return false;
  await disableE2EE(await currentUserId());
  return true;
};
