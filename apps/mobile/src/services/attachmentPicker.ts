import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import { launchCamera, launchImageLibrary, Asset } from 'react-native-image-picker';

export interface PickedAttachment {
  uri: string;
  name: string;
  type: string;
  size?: number;
}

export interface PickAttachmentOptions {
  /** Allow selecting more than one item from the gallery / files. Default true. */
  multiple?: boolean;
  /** Offer the "Files" option (documents, PDFs, zips). Default true; pass false for photo/video-only pickers. */
  allowFiles?: boolean;
  /** Restrict gallery/camera to photos only (e.g. avatars). Default: photos and videos. */
  photosOnly?: boolean;
}

const fromAsset = (a: Asset): PickedAttachment | null => {
  if (!a.uri) return null;
  const isVideo = (a.type || '').startsWith('video/');
  return {
    uri: a.uri,
    name: a.fileName || `${isVideo ? 'video' : 'photo'}_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
    type: a.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
    size: a.fileSize,
  };
};

/**
 * Camera needs a runtime permission (the manifest declares CAMERA, so launching the camera without it would crash).
 * Returns true only when the user has granted it.
 */
const ensureCameraPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;
  const perm = PermissionsAndroid.PERMISSIONS.CAMERA;
  if (await PermissionsAndroid.check(perm)) return true;
  const result = await PermissionsAndroid.request(perm, {
    title: 'Allow camera access',
    message: 'CineCraft Connect needs the camera so you can take a photo to share.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
  });
  if (result === PermissionsAndroid.RESULTS.GRANTED) return true;
  if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
    Alert.alert('Camera is turned off', 'Turn on camera access for CineCraft Connect in Settings to take photos.', [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => { }) },
    ]);
  }
  return false;
};

const takePhoto = async (): Promise<PickedAttachment[]> => {
  if (!(await ensureCameraPermission())) return [];
  const res = await launchCamera({ mediaType: 'photo', saveToPhotos: false, quality: 0.9 });
  if (res.didCancel) return [];
  if (res.errorCode) {
    Alert.alert('Camera unavailable', res.errorMessage || 'Could not open the camera.');
    return [];
  }
  return (res.assets || []).map(fromAsset).filter(Boolean) as PickedAttachment[];
};

// Android's system photo picker: shows the user's photos/videos in a grid, no storage permission required.
const pickFromGallery = async (opts: PickAttachmentOptions): Promise<PickedAttachment[]> => {
  const res = await launchImageLibrary({
    mediaType: opts.photosOnly ? 'photo' : 'mixed',
    selectionLimit: opts.multiple === false ? 1 : 0,
  });
  if (res.didCancel) return [];
  if (res.errorCode) {
    Alert.alert('Gallery unavailable', res.errorMessage || 'Could not open your photos.');
    return [];
  }
  return (res.assets || []).map(fromAsset).filter(Boolean) as PickedAttachment[];
};

const pickFiles = async (opts: PickAttachmentOptions): Promise<PickedAttachment[]> => {
  try {
    const results = await DocumentPicker.pick({
      allowMultiSelection: opts.multiple !== false,
      type: [DocumentPicker.types.allFiles],
    });
    return results.map((r) => ({
      uri: r.uri,
      name: r.name || `file_${Date.now()}`,
      type: r.type || 'application/octet-stream',
      size: r.size ?? undefined,
    }));
  } catch (err) {
    if (DocumentPicker.isCancel(err)) return [];
    throw err;
  }
};

/**
 * Instagram/WhatsApp-style attach flow: ask where the attachment should come from (camera, photo library or files),
 * then return the chosen items. Resolves to [] when the user cancels.
 */
export const pickAttachments = (opts: PickAttachmentOptions = {}): Promise<PickedAttachment[]> =>
  new Promise((resolve, reject) => {
    const run = (task: () => Promise<PickedAttachment[]>) => task().then(resolve, reject);
    const buttons: any[] = [
      { text: 'Camera', onPress: () => run(takePhoto) },
      { text: 'Photos & videos', onPress: () => run(() => pickFromGallery(opts)) },
    ];
    if (opts.allowFiles !== false) {
      buttons.push({ text: 'Files', onPress: () => run(() => pickFiles(opts)) });
    }
    Alert.alert('Add attachment', 'Choose where to get it from', buttons, {
      cancelable: true,
      onDismiss: () => resolve([]),
    });
  });
