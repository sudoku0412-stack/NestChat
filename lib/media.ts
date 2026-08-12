import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from './supabase';
import type { MediaKind } from './database.types';

export interface PickedAsset {
  uri: string;
  kind: MediaKind;
  width?: number;
  height?: number;
  durationSeconds?: number;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
}

function fromImagePickerAsset(asset: ImagePicker.ImagePickerAsset): PickedAsset {
  return {
    uri: asset.uri,
    kind: asset.type === 'video' ? 'video' : 'photo',
    width: asset.width,
    height: asset.height,
    durationSeconds: asset.duration ? asset.duration / 1000 : undefined,
  };
}

export async function pickFromLibrary(): Promise<PickedAsset | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    quality: 1,
  });
  if (result.canceled || !result.assets[0]) return null;
  return fromImagePickerAsset(result.assets[0]);
}

export async function pickFromCamera(): Promise<PickedAsset | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images', 'videos'],
    quality: 1,
  });
  if (result.canceled || !result.assets[0]) return null;
  return fromImagePickerAsset(result.assets[0]);
}

export async function pickDocument(): Promise<PickedAsset | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    kind: 'document',
    fileName: asset.name,
    fileSize: asset.size,
    mimeType: asset.mimeType,
  };
}

export async function pickImageFromLibrary(): Promise<PickedAsset | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: true,
    aspect: [1, 1],
  });
  if (result.canceled || !result.assets[0]) return null;
  return fromImagePickerAsset(result.assets[0]);
}

// Defaults to a compressed re-encode for photos (see design-doc.md §5.2);
// videos are uploaded as-is — client-side video transcoding is out of scope for v1.
async function prepareForUpload(asset: PickedAsset): Promise<PickedAsset> {
  if (asset.kind !== 'photo') return asset;

  const result = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width: 1600 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );

  return { ...asset, uri: result.uri, width: result.width, height: result.height };
}

export interface UploadedMedia {
  kind: MediaKind;
  storagePath: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  fileName?: string;
  fileSize?: number;
}

function extensionAndContentType(asset: PickedAsset): { extension: string; contentType: string } {
  const isGifLike = asset.kind === 'gif' || asset.kind === 'sticker';
  let extension = asset.kind === 'video' ? 'mp4' : isGifLike ? 'gif' : 'jpg';
  let contentType = asset.kind === 'video' ? 'video/mp4' : isGifLike ? 'image/gif' : 'image/jpeg';
  if (asset.kind === 'document') {
    extension = asset.fileName?.split('.').pop() || 'bin';
    contentType = asset.mimeType || 'application/octet-stream';
  }
  return { extension, contentType };
}

// Split out from uploadMedia so chatActions.sendMediaMessage can insert an encryption step
// between "read the (possibly resized) file's bytes" and "upload it" -- resize must still happen
// on the plaintext image, so prepareForUpload runs here, before any encryption.
export async function readAssetBytes(rawAsset: PickedAsset): Promise<{ asset: PickedAsset; bytes: ArrayBuffer }> {
  const asset = await prepareForUpload(rawAsset);
  const response = await fetch(asset.uri);
  const bytes = await response.arrayBuffer();
  return { asset, bytes };
}

export async function uploadMediaBytes(
  chatId: string,
  messageId: string,
  asset: PickedAsset,
  bytes: ArrayBuffer | Uint8Array,
  opts: { encrypted?: boolean } = {}
): Promise<UploadedMedia> {
  let { extension, contentType } = extensionAndContentType(asset);
  if (opts.encrypted) {
    // Encrypted bytes aren't a valid image/video/whatever anymore -- labeling them as such would
    // be actively misleading (and some CDNs/proxies sniff content-type to "help", which is the
    // last thing ciphertext needs).
    extension = `${extension}.enc`;
    contentType = 'application/octet-stream';
  }
  const path = `${chatId}/${messageId}/${Date.now()}.${extension}`;

  const { error } = await supabase.storage.from('chat-media').upload(path, bytes, { contentType });
  if (error) throw error;

  return {
    kind: asset.kind,
    storagePath: path,
    width: asset.width,
    height: asset.height,
    durationSeconds: asset.durationSeconds,
    fileName: asset.fileName,
    fileSize: asset.fileSize,
  };
}

export async function uploadMedia(
  chatId: string,
  messageId: string,
  rawAsset: PickedAsset
): Promise<UploadedMedia> {
  const { asset, bytes } = await readAssetBytes(rawAsset);
  return uploadMediaBytes(chatId, messageId, asset, bytes);
}

export async function getSignedMediaUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('chat-media').createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

export async function getSignedStatusMediaUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('status-media').createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

// Avatars bucket is public — no signed URL needed, just the stable public URL.
export async function uploadAvatar(userId: string, rawAsset: PickedAsset): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    rawAsset.uri,
    [{ resize: { width: 512, height: 512 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
  );

  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const response = await fetch(result.uri);
  const arrayBuffer = await response.arrayBuffer();

  const { error } = await supabase.storage.from('avatars').upload(path, arrayBuffer, {
    contentType: 'image/jpeg',
  });
  if (error) throw error;

  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

export async function getSignedWallpaperUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('wallpapers').createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

export async function uploadWallpaper(chatId: string, userId: string, rawAsset: PickedAsset): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    rawAsset.uri,
    [{ resize: { width: 1080 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
  );

  const path = `${chatId}/${userId}/wallpaper-${Date.now()}.jpg`;
  const response = await fetch(result.uri);
  const arrayBuffer = await response.arrayBuffer();

  const { error } = await supabase.storage.from('wallpapers').upload(path, arrayBuffer, {
    contentType: 'image/jpeg',
  });
  if (error) throw error;

  return path;
}

export async function uploadStatusMedia(userId: string, rawAsset: PickedAsset): Promise<UploadedMedia> {
  const asset = await prepareForUpload(rawAsset);
  const extension = asset.kind === 'video' ? 'mp4' : 'jpg';
  const contentType = asset.kind === 'video' ? 'video/mp4' : 'image/jpeg';
  const path = `${userId}/${Date.now()}.${extension}`;

  const response = await fetch(asset.uri);
  const arrayBuffer = await response.arrayBuffer();

  const { error } = await supabase.storage.from('status-media').upload(path, arrayBuffer, {
    contentType,
  });
  if (error) throw error;

  return {
    kind: asset.kind,
    storagePath: path,
    width: asset.width,
    height: asset.height,
    durationSeconds: asset.durationSeconds,
  };
}
