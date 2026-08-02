jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));
jest.mock('./supabase', () => ({ supabase: { storage: { from: jest.fn() } } }));

import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from './supabase';
import {
  getSignedMediaUrl,
  pickDocument,
  pickFromCamera,
  pickFromLibrary,
  uploadMedia,
  type PickedAsset,
} from './media';

afterEach(() => jest.resetAllMocks());

function mockStorageBucket(overrides: Record<string, jest.Mock> = {}) {
  const bucket = {
    upload: jest.fn().mockResolvedValue({ error: null }),
    createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: 'https://signed' }, error: null }),
    getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://public' } }),
    ...overrides,
  };
  (supabase.storage.from as jest.Mock).mockReturnValue(bucket);
  return bucket;
}

describe('pickFromCamera / pickFromLibrary', () => {
  it('returns null when permission is denied', async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
    expect(await pickFromCamera()).toBeNull();
  });

  it('returns null when the user cancels', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true, assets: null });
    expect(await pickFromLibrary()).toBeNull();
  });

  it('maps a picked video asset to kind "video"', async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://v.mov', type: 'video', width: 1920, height: 1080, duration: 5000 }],
    });

    const asset = await pickFromCamera();
    expect(asset).toEqual({
      uri: 'file://v.mov',
      kind: 'video',
      width: 1920,
      height: 1080,
      durationSeconds: 5,
    });
  });

  it('maps a picked image asset to kind "photo"', async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://p.jpg', type: 'image', width: 800, height: 600 }],
    });

    const asset = await pickFromCamera();
    expect(asset?.kind).toBe('photo');
    expect(asset?.durationSeconds).toBeUndefined();
  });
});

describe('pickDocument', () => {
  it('returns null when the user cancels', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({ canceled: true, assets: null });
    expect(await pickDocument()).toBeNull();
  });

  it('maps the picked file to a document-kind PickedAsset', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://report.pdf', name: 'report.pdf', size: 12345, mimeType: 'application/pdf' }],
    });

    expect(await pickDocument()).toEqual({
      uri: 'file://report.pdf',
      kind: 'document',
      fileName: 'report.pdf',
      fileSize: 12345,
      mimeType: 'application/pdf',
    });
  });
});

describe('uploadMedia', () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) });
  });
  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('re-encodes photos and uploads with an image/jpeg content type', async () => {
    (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
      uri: 'file://resized.jpg',
      width: 1600,
      height: 900,
    });
    const bucket = mockStorageBucket();

    const asset: PickedAsset = { uri: 'file://original.jpg', kind: 'photo', width: 4000, height: 2250 };
    const result = await uploadMedia('chat-1', 'msg-1', asset);

    expect(ImageManipulator.manipulateAsync).toHaveBeenCalled();
    expect(bucket.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^chat-1\/msg-1\/\d+\.jpg$/),
      expect.anything(),
      { contentType: 'image/jpeg' }
    );
    expect(result.width).toBe(1600);
    expect(result.height).toBe(900);
  });

  it('uploads videos as-is (no manipulation), with a video/mp4 content type', async () => {
    const bucket = mockStorageBucket();
    const asset: PickedAsset = { uri: 'file://v.mov', kind: 'video' };

    await uploadMedia('chat-1', 'msg-2', asset);

    expect(ImageManipulator.manipulateAsync).not.toHaveBeenCalled();
    expect(bucket.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^chat-1\/msg-2\/\d+\.mp4$/),
      expect.anything(),
      { contentType: 'video/mp4' }
    );
  });

  it('derives extension and content type from the picked file for documents', async () => {
    const bucket = mockStorageBucket();
    const asset: PickedAsset = {
      uri: 'file://report.pdf',
      kind: 'document',
      fileName: 'report.pdf',
      mimeType: 'application/pdf',
    };

    const result = await uploadMedia('chat-1', 'msg-3', asset);

    expect(ImageManipulator.manipulateAsync).not.toHaveBeenCalled();
    expect(bucket.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^chat-1\/msg-3\/\d+\.pdf$/),
      expect.anything(),
      { contentType: 'application/pdf' }
    );
    expect(result.fileName).toBe('report.pdf');
  });

  it('falls back to a generic content type/extension for documents missing metadata', async () => {
    const bucket = mockStorageBucket();
    const asset: PickedAsset = { uri: 'file://blob', kind: 'document' };

    await uploadMedia('chat-1', 'msg-4', asset);

    expect(bucket.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^chat-1\/msg-4\/\d+\.bin$/),
      expect.anything(),
      { contentType: 'application/octet-stream' }
    );
  });

  it('throws when the storage upload fails', async () => {
    mockStorageBucket({ upload: jest.fn().mockResolvedValue({ error: new Error('quota exceeded') }) });
    const asset: PickedAsset = { uri: 'file://v.mov', kind: 'video' };

    await expect(uploadMedia('chat-1', 'msg-5', asset)).rejects.toThrow('quota exceeded');
  });
});

describe('getSignedMediaUrl', () => {
  it('returns the signed URL on success', async () => {
    mockStorageBucket();
    expect(await getSignedMediaUrl('chat-1/msg-1/x.jpg')).toBe('https://signed');
  });

  it('returns null on failure', async () => {
    mockStorageBucket({
      createSignedUrl: jest.fn().mockResolvedValue({ data: null, error: new Error('not found') }),
    });
    expect(await getSignedMediaUrl('missing.jpg')).toBeNull();
  });
});
