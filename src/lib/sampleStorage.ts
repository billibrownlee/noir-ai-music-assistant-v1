// IndexedDB persistence for audio samples.
// Stores the actual file ArrayBuffer so samples survive page refresh.
// Each load recreates fresh blob URLs from the stored bytes.

const DB_NAME = 'noir_sample_db';
const DB_VERSION = 1;
const STORE_NAME = 'samples';

interface StoredRecord {
  id: string;
  name: string;
  genre: string;
  bpm?: number;
  key?: string;
  tags: string[];
  duration?: number;
  fileBuffer: ArrayBuffer;
  fileName: string;
  fileType: string;
  createdAt: number;
}

export interface StoredSample {
  id: string;
  name: string;
  genre: string;
  bpm?: number;
  key?: string;
  tags: string[];
  duration?: number;
  audioUrl: string;
  uploadDate: Date;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveSampleToDB(
  meta: { id: string; name: string; genre: string; tags: string[]; bpm?: number; key?: string; duration?: number },
  file: File
): Promise<void> {
  const fileBuffer = await file.arrayBuffer();
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const record: StoredRecord = {
      ...meta,
      fileBuffer,
      fileName: file.name,
      fileType: file.type || 'audio/mpeg',
      createdAt: Date.now(),
    };
    const req = tx.objectStore(STORE_NAME).put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function loadAllSamplesFromDB(): Promise<StoredSample[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).index('createdAt').getAll();
    req.onsuccess = () => {
      const records: StoredRecord[] = req.result ?? [];
      const samples: StoredSample[] = records.map((r) => {
        const blob = new Blob([r.fileBuffer], { type: r.fileType });
        return {
          id: r.id,
          name: r.name,
          genre: r.genre,
          bpm: r.bpm,
          key: r.key,
          tags: Array.isArray(r.tags) ? r.tags : [],
          duration: r.duration,
          audioUrl: URL.createObjectURL(blob),
          uploadDate: new Date(r.createdAt),
        };
      });
      resolve(samples);
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function deleteSampleFromDB(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function updateSampleMetaInDB(
  id: string,
  updates: Partial<{ name: string; genre: string; tags: string[]; bpm: number; key: string; duration: number }>
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const record: StoredRecord | undefined = getReq.result;
      if (!record) { resolve(); return; }
      const putReq = store.put({ ...record, ...updates });
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
    tx.oncomplete = () => db.close();
  });
}

export async function clearAllSamplesFromDB(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}
