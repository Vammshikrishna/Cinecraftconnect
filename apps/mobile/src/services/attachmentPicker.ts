import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import { POST_VIDEO_MAX_SECONDS } from '@cinecraft/core';
import { launchCamera, launchImageLibrary, Asset } from 'react-native-image-picker';

export interface PickedAttachment {
  uri: string;
  name: string;
  type: string;
  size?: number;
  /** picture / video size as the picker reports it (video: before any phone turn is applied) */
  width?: number;
  height?: number;
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
    width: a.width,
    height: a.height,
  };
};

/**
 * Camera needs a runtime permission (the manifest declares CAMERA, so launching the camera without it would crash).
 * Returns true only when the user has granted it.
 */
const ensureCameraPermission = async (withMic = false): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;
  const perms = [PermissionsAndroid.PERMISSIONS.CAMERA, ...(withMic ? [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] : [])];
  const have = await Promise.all(perms.map((p) => PermissionsAndroid.check(p)));
  if (have.every(Boolean)) return true;
  const result = await PermissionsAndroid.requestMultiple(perms);
  const values = perms.map((p) => result[p]);
  if (values.every((v) => v === PermissionsAndroid.RESULTS.GRANTED)) return true;
  const what = withMic ? 'camera and microphone' : 'camera';
  const blocked = values.some((v) => v === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN);
  Alert.alert(
    blocked ? `Allow ${what} access` : `${what[0].toUpperCase()}${what.slice(1)} access needed`,
    withMic
      ? 'CineCraft Connect needs the camera and microphone to record a video with sound. Turn them on in Settings.'
      : 'CineCraft Connect needs the camera to take a photo. Turn it on in Settings.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => { }) },
    ],
  );
  return false;
};

const runCamera = async (kind: 'photo' | 'video'): Promise<PickedAttachment[]> => {
  if (!(await ensureCameraPermission(kind === 'video'))) return [];
  try {
    const res = await launchCamera(
      kind === 'video'
        ? { mediaType: 'video', videoQuality: 'high', durationLimit: POST_VIDEO_MAX_SECONDS, saveToPhotos: false }
        : { mediaType: 'photo', saveToPhotos: false, quality: 0.9 },
    );
    if (res.didCancel) return [];
    if (res.errorCode) {
      Alert.alert('Camera unavailable', res.errorMessage || 'Could not open the camera.');
      return [];
    }
    const items = (res.assets || []).map(fromAsset).filter(Boolean) as PickedAttachment[];
    if (kind === 'video') {
      // the camera app can return a slightly different file type; make sure it is treated as a video
      for (const it of items) if (!it.type.startsWith('video/')) it.type = 'video/mp4';
    }
    return items;
  } catch (e: any) {
    Alert.alert('Camera unavailable', e?.message || 'Could not open the camera.');
    return [];
  }
};

/** Ask whether to take a photo or record a video (photo-only pickers skip the question). */
const openCamera = (opts: PickAttachmentOptions): Promise<PickedAttachment[]> => {
  if (opts.photosOnly) return runCamera('photo');
  return new Promise((resolve, reject) => {
    const go = (k: 'photo' | 'video') => runCamera(k).then(resolve, reject);
    Alert.alert('Camera', 'What would you like to capture?', [
      { text: 'Take photo', onPress: () => go('photo') },
      { text: 'Record video', onPress: () => go('video') },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve([]) },
    ], { cancelable: true, onDismiss: () => resolve([]) });
  });
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
      { text: 'Camera', onPress: () => run(() => openCamera(opts)) },
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
