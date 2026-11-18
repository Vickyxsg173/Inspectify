import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/services/supabaseClient';

const SHIPMENTS_STORAGE_KEY = '@inspectify_shipments_v1';
const ACTIVE_SHIPMENT_KEY = '@inspectify_active_shipment_id';

export interface BoxConditionTag {
  boxId: string; // e.g. "BOX-01" or custom barcode/tracking
  scannedAt: number;
  status: 'INTACT' | 'DEFECTIVE';
  confidence: number;
  imageUri: string;
  annotatedImage?: string;
  defectReason?: string;
  modelUsed?: string;
}

export interface ScreenConditionTag {
  id: string;
  boxId: string; // Associated Package/Box ID within the shipment
  screenIndex: number;
  scannedAt: number;
  status: 'INTACT' | 'DEFECTIVE';
  confidence: number;
  imageUri: string;
  annotatedImage?: string;
  defectReason?: string;
  modelUsed?: string;
}

export interface PackageBoxItem {
  boxId: string; // Package ID inside the shipment
  scannedAt?: number;
  status?: 'INTACT' | 'DEFECTIVE';
  confidence?: number;
  imageUri?: string;
  annotatedImage?: string;
  defectReason?: string;
  modelUsed?: string;
  screens: ScreenConditionTag[];
}

export interface ShipmentRecord {
  id: string; // Custom manual ID or auto SHP-YYYYMMDD-XXXX
  createdAt: number;
  batchLabel?: string;
  activeBoxId: string; // Current package being scanned inside this shipment
  boxes: PackageBoxItem[]; // Nested boxes inside this shipment
  boxCondition?: BoxConditionTag | null; // Primary box condition
  screens: ScreenConditionTag[]; // All screens across boxes in this shipment
  status: 'ON_DEVICE' | 'OFFLOADED';
  offloadedAt?: number;
  cloudSyncPending?: boolean;
}

/**
 * Generate a clean standard warehouse intake Shipment ID
 * e.g. SHP-20261118-9F2B
 */
export function generateShipmentId(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SHP-${yyyy}${mm}${dd}-${rand}`;
}

/**
 * Generate a package/box ID
 */
export function generateBoxId(index = 1): string {
  return `BOX-${String(index).padStart(2, '0')}`;
}

/**
 * Get all stored shipments, sorted newest first
 */
export async function getShipments(): Promise<ShipmentRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(SHIPMENTS_STORAGE_KEY);
    if (!raw) return [];
    const list: ShipmentRecord[] = JSON.parse(raw);
    // Ensure all shipments have the nested boxes structure
    return list.map(normalizeShipment).sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.warn('Error reading shipments:', error);
    return [];
  }
}

/**
 * Normalizes a shipment to ensure `boxes` and `activeBoxId` exist
 */
function normalizeShipment(s: any): ShipmentRecord {
  const activeBoxId = s.activeBoxId || s.boxCondition?.boxId || 'BOX-01';
  let boxes: PackageBoxItem[] = s.boxes || [];

  if (boxes.length === 0) {
    boxes = [
      {
        boxId: activeBoxId,
        scannedAt: s.boxCondition?.scannedAt,
        status: s.boxCondition?.status,
        confidence: s.boxCondition?.confidence,
        imageUri: s.boxCondition?.imageUri,
        annotatedImage: s.boxCondition?.annotatedImage,
        defectReason: s.boxCondition?.defectReason,
        modelUsed: s.boxCondition?.modelUsed,
        screens: s.screens || [],
      },
    ];
  }

  return {
    ...s,
    activeBoxId,
    boxes,
    screens: s.screens || [],
  };
}

/**
 * Get the currently active intake Shipment ID.
 * If none exists, creates a fresh initial shipment and marks it active.
 */
export async function getActiveShipmentId(): Promise<string> {
  try {
    const savedId = await AsyncStorage.getItem(ACTIVE_SHIPMENT_KEY);
    if (savedId) {
      const all = await getShipments();
      const exists = all.some((s) => s.id === savedId);
      if (exists) return savedId;
    }
    // Create new initial shipment
    const fresh = await createNewShipment();
    return fresh.id;
  } catch {
    const fallbackId = generateShipmentId();
    return fallbackId;
  }
}

/**
 * Set the currently active intake shipment ID
 */
export async function setActiveShipmentId(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(ACTIVE_SHIPMENT_KEY, id);
  } catch (error) {
    console.error('Error setting active shipment ID:', error);
  }
}

/**
 * Manually create a shipment with a custom Shipment ID and Box ID
 */
export async function createManualShipment(params: {
  shipmentId: string;
  initialBoxId?: string;
  batchLabel?: string;
}): Promise<ShipmentRecord> {
  const trimmedId = params.shipmentId.trim();
  if (!trimmedId) {
    throw new Error('Shipment ID cannot be empty.');
  }

  const list = await getShipments();
  if (list.some((s) => s.id.toLowerCase() === trimmedId.toLowerCase())) {
    throw new Error(`Shipment ID "${trimmedId}" already exists. Please use a unique ID.`);
  }

  const boxId = params.initialBoxId?.trim() || 'BOX-01';
  const newShipment: ShipmentRecord = {
    id: trimmedId,
    createdAt: Date.now(),
    batchLabel: params.batchLabel?.trim() || undefined,
    activeBoxId: boxId,
    boxes: [
      {
        boxId,
        screens: [],
      },
    ],
    boxCondition: null,
    screens: [],
    status: 'ON_DEVICE',
  };

  const updated = [newShipment, ...list];
  await AsyncStorage.setItem(SHIPMENTS_STORAGE_KEY, JSON.stringify(updated));
  await setActiveShipmentId(trimmedId);
  return newShipment;
}

/**
 * Create a new intake Shipment Record with auto-generated ID and set it as active
 */
export async function createNewShipment(batchLabel?: string): Promise<ShipmentRecord> {
  const id = generateShipmentId();
  return createManualShipment({
    shipmentId: id,
    initialBoxId: 'BOX-01',
    batchLabel,
  });
}

/**
 * Add a new box package inside an existing shipment and set it active
 */
export async function addBoxToShipment(
  shipmentId: string,
  customBoxId?: string
): Promise<ShipmentRecord | null> {
  try {
    const list = await getShipments();
    const idx = list.findIndex((s) => s.id === shipmentId);
    if (idx === -1) return null;

    const shipment = list[idx];
    const newBoxId =
      customBoxId?.trim() || generateBoxId(shipment.boxes.length + 1);

    // Prevent duplicate box ID in the same shipment
    if (shipment.boxes.some((b) => b.boxId.toLowerCase() === newBoxId.toLowerCase())) {
      throw new Error(`Box ID "${newBoxId}" already exists in this shipment.`);
    }

    const newBox: PackageBoxItem = {
      boxId: newBoxId,
      screens: [],
    };

    shipment.boxes.push(newBox);
    shipment.activeBoxId = newBoxId;
    shipment.status = 'ON_DEVICE';

    await AsyncStorage.setItem(SHIPMENTS_STORAGE_KEY, JSON.stringify(list));
    return shipment;
  } catch (error: any) {
    console.error('Error adding box to shipment:', error);
    throw error;
  }
}

/**
 * Set the currently active box inside a shipment
 */
export async function setActiveBoxForShipment(
  shipmentId: string,
  boxId: string
): Promise<ShipmentRecord | null> {
  try {
    const list = await getShipments();
    const idx = list.findIndex((s) => s.id === shipmentId);
    if (idx === -1) return null;

    const shipment = list[idx];
    const exists = shipment.boxes.some((b) => b.boxId === boxId);
    if (!exists) {
      shipment.boxes.push({ boxId, screens: [] });
    }

    shipment.activeBoxId = boxId;
    // Update top-level boxCondition to match active box if scanned
    const currentBox = shipment.boxes.find((b) => b.boxId === boxId);
    if (currentBox && currentBox.status) {
      shipment.boxCondition = {
        boxId: currentBox.boxId,
        scannedAt: currentBox.scannedAt || Date.now(),
        status: currentBox.status,
        confidence: currentBox.confidence || 0,
        imageUri: currentBox.imageUri || '',
        annotatedImage: currentBox.annotatedImage,
        defectReason: currentBox.defectReason,
        modelUsed: currentBox.modelUsed,
      };
    }

    await AsyncStorage.setItem(SHIPMENTS_STORAGE_KEY, JSON.stringify(list));
    return shipment;
  } catch (error) {
    console.error('Error setting active box:', error);
    return null;
  }
}

/**
 * Associate an outer box inspection scan with the specific box inside the shipment
 */
export async function recordBoxCondition(
  shipmentId: string,
  boxTag: Omit<BoxConditionTag, 'boxId'> & { boxId?: string }
): Promise<ShipmentRecord | null> {
  try {
    const list = await getShipments();
    let idx = list.findIndex((s) => s.id === shipmentId);

    if (idx === -1) {
      const created = await createManualShipment({
        shipmentId,
        initialBoxId: boxTag.boxId || 'BOX-01',
      });
      list.unshift(created);
      idx = 0;
    }

    const shipment = list[idx];
    const targetBoxId = boxTag.boxId || shipment.activeBoxId || 'BOX-01';

    let box = shipment.boxes.find((b) => b.boxId === targetBoxId);
    if (!box) {
      box = { boxId: targetBoxId, screens: [] };
      shipment.boxes.push(box);
    }

    // Update box inspection results
    box.scannedAt = boxTag.scannedAt;
    box.status = boxTag.status;
    box.confidence = boxTag.confidence;
    box.imageUri = boxTag.imageUri;
    box.annotatedImage = boxTag.annotatedImage;
    box.defectReason = boxTag.defectReason;
    box.modelUsed = boxTag.modelUsed;

    // Update top-level boxCondition
    shipment.boxCondition = {
      ...boxTag,
      boxId: targetBoxId,
    };
    shipment.activeBoxId = targetBoxId;
    shipment.status = 'ON_DEVICE';

    await AsyncStorage.setItem(SHIPMENTS_STORAGE_KEY, JSON.stringify(list));
    return shipment;
  } catch (error) {
    console.error('Error recording box condition:', error);
    return null;
  }
}

/**
 * Associate a scanned screen with the specific package/box inside the shipment
 */
export async function recordScreenCondition(
  shipmentId: string,
  screenData: Omit<ScreenConditionTag, 'id' | 'screenIndex' | 'boxId'> & { boxId?: string }
): Promise<ShipmentRecord | null> {
  try {
    const list = await getShipments();
    let shipment = list.find((s) => s.id === shipmentId);

    if (!shipment) {
      shipment = await createManualShipment({
        shipmentId,
        initialBoxId: screenData.boxId || 'BOX-01',
      });
      list.unshift(shipment);
    }

    const targetBoxId = screenData.boxId || shipment.activeBoxId || 'BOX-01';
    let box = shipment.boxes.find((b) => b.boxId === targetBoxId);
    if (!box) {
      box = { boxId: targetBoxId, screens: [] };
      shipment.boxes.push(box);
    }

    const screenIndex = (box.screens?.length || 0) + 1;
    const newScreen: ScreenConditionTag = {
      ...screenData,
      boxId: targetBoxId,
      id: `scr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      screenIndex,
    };

    box.screens.push(newScreen);
    shipment.screens = shipment.boxes.flatMap((b) => b.screens);
    shipment.status = 'ON_DEVICE';

    await AsyncStorage.setItem(SHIPMENTS_STORAGE_KEY, JSON.stringify(list));
    return shipment;
  } catch (error) {
    console.error('Error recording screen condition:', error);
    return null;
  }
}

/**
 * Offloads shipment data from on-device storage to cloud.
 * Releases heavy on-device image cache to make local storage free,
 * while marking the shipment as OFFLOADED with cloud sync timestamp.
 */
export async function offloadShipmentToCloud(
  shipmentId: string
): Promise<{ success: boolean; shipment?: ShipmentRecord; error?: string }> {
  try {
    const list = await getShipments();
    const idx = list.findIndex((s) => s.id === shipmentId);
    if (idx === -1) {
      return { success: false, error: 'Shipment not found on device.' };
    }

    const target = list[idx];

    // Attempt to backup images to Supabase Storage before releasing local cache
    const uploadImageToSupabase = async (localUri?: string): Promise<string | undefined> => {
      if (!localUri || (!localUri.startsWith('file://') && !localUri.startsWith(FileSystem.cacheDirectory || ''))) {
        return localUri;
      }
      try {
        const fileInfo = await FileSystem.getInfoAsync(localUri);
        if (!fileInfo.exists) return localUri;

        const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: 'base64' });
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        const fileName = `shipments/${shipmentId}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`;
        const { data, error } = await supabase.storage
          .from('shipment-images')
          .upload(fileName, bytes, { contentType: 'image/jpeg', upsert: true });

        if (!error && data?.path) {
          const { data: pubData } = supabase.storage.from('shipment-images').getPublicUrl(data.path);
          return pubData.publicUrl;
        }
      } catch (err) {
        console.warn('Supabase storage upload skipped/failed:', err);
      }
      return localUri;
    };

    // Upload box and screen images in parallel
    const uploadedBoxImg = await uploadImageToSupabase(target.boxCondition?.imageUri);
    for (const b of target.boxes) {
      if (b.imageUri) b.imageUri = (await uploadImageToSupabase(b.imageUri)) || b.imageUri;
      for (const sc of b.screens) {
        if (sc.imageUri) sc.imageUri = (await uploadImageToSupabase(sc.imageUri)) || sc.imageUri;
      }
    }
    for (const sc of target.screens) {
      if (sc.imageUri) sc.imageUri = (await uploadImageToSupabase(sc.imageUri)) || sc.imageUri;
    }

    // Clean up local filesystem cached image files if present
    const urisToPurge: (string | undefined)[] = [
      target.boxCondition?.imageUri,
      ...target.boxes.map((b) => b.imageUri),
      ...target.screens.map((sc) => sc.imageUri),
    ];

    for (const uri of urisToPurge) {
      if (uri && (uri.startsWith('file://') || uri.startsWith(FileSystem.cacheDirectory || ''))) {
        try {
          const info = await FileSystem.getInfoAsync(uri);
          if (info.exists) {
            await FileSystem.deleteAsync(uri, { idempotent: true });
          }
        } catch {
          // Ignore cache deletion errors
        }
      }
    }

    // Mark as offloaded to cloud
    const updated: ShipmentRecord = {
      ...target,
      status: 'OFFLOADED',
      offloadedAt: Date.now(),
      boxCondition: target.boxCondition
        ? {
            ...target.boxCondition,
            imageUri: target.boxCondition.annotatedImage || target.boxCondition.imageUri,
          }
        : null,
      boxes: target.boxes.map((b) => ({
        ...b,
        imageUri: b.annotatedImage || b.imageUri,
        screens: b.screens.map((sc) => ({
          ...sc,
          imageUri: sc.annotatedImage || sc.imageUri,
        })),
      })),
      screens: target.screens.map((sc) => ({
        ...sc,
        imageUri: sc.annotatedImage || sc.imageUri,
      })),
    };

    list[idx] = updated;
    await AsyncStorage.setItem(SHIPMENTS_STORAGE_KEY, JSON.stringify(list));
    return { success: true, shipment: updated };
  } catch (err: any) {
    console.error('Error offloading shipment to cloud:', err);
    return { success: false, error: err.message || 'Failed to offload shipment.' };
  }
}

/**
 * Delete a shipment completely from on-device storage
 */
export async function deleteShipment(shipmentId: string): Promise<void> {
  try {
    const list = await getShipments();
    const filtered = list.filter((s) => s.id !== shipmentId);
    await AsyncStorage.setItem(SHIPMENTS_STORAGE_KEY, JSON.stringify(filtered));

    // If active shipment was deleted, set next or create new
    const active = await AsyncStorage.getItem(ACTIVE_SHIPMENT_KEY);
    if (active === shipmentId) {
      if (filtered.length > 0) {
        await setActiveShipmentId(filtered[0].id);
      } else {
        await createNewShipment();
      }
    }
  } catch (error) {
    console.error('Error deleting shipment:', error);
  }
}
