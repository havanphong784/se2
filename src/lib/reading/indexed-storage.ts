import type {
  StructuredDocumentMeta,
  DocumentChunk,
} from "@/types/reading";

const DB_NAME = "vocabloom_reading_v1";
const DB_VERSION = 1;

interface StoredChunkRecord {
  docId: string;
  chunkIndex: number;
  chunk: DocumentChunk;
}

interface ReadingProgressRecord {
  docId: string;
  activeChunkIndex: number;
  lastSentenceId?: string;
  updatedAt: number;
}

// In-memory fallback trong trường hợp trình duyệt chặn IndexedDB (Private Browsing)
const memDocuments = new Map<string, StructuredDocumentMeta>();
const memChunks = new Map<string, DocumentChunk>();
const memProgress = new Map<string, ReadingProgressRecord>();

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available on server-side."));
  }

  if (!("indexedDB" in window)) {
    return Promise.reject(new Error("IndexedDB is not supported by this browser."));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 1. Store lưu Metadata tài liệu
        if (!db.objectStoreNames.contains("documents")) {
          db.createObjectStore("documents", { keyPath: "id" });
        }

        // 2. Store lưu từng Chunk dữ liệu
        if (!db.objectStoreNames.contains("chunks")) {
          const chunkStore = db.createObjectStore("chunks", {
            keyPath: ["docId", "chunkIndex"],
          });
          chunkStore.createIndex("docId", "docId", { unique: false });
        }

        // 3. Store lưu tiến độ đọc dở
        if (!db.objectStoreNames.contains("reading_progress")) {
          db.createObjectStore("reading_progress", { keyPath: "docId" });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  return dbPromise;
}

/**
 * Lưu toàn bộ tài liệu cấu trúc (Metadata và tất cả các Chunks) vào IndexedDB
 */
export async function saveStructuredDocument(
  meta: StructuredDocumentMeta,
  chunks: DocumentChunk[]
): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(["documents", "chunks", "reading_progress"], "readwrite");

    const docStore = tx.objectStore("documents");
    const chunkStore = tx.objectStore("chunks");
    const progressStore = tx.objectStore("reading_progress");

    docStore.put(meta);

    for (const chunk of chunks) {
      const record: StoredChunkRecord = {
        docId: meta.id,
        chunkIndex: chunk.chunkIndex,
        chunk,
      };
      chunkStore.put(record);
    }

    const progressRecord: ReadingProgressRecord = {
      docId: meta.id,
      activeChunkIndex: meta.activeChunkIndex || 0,
      lastSentenceId: meta.lastReadSentenceId,
      updatedAt: Date.now(),
    };
    progressStore.put(progressRecord);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("IndexedDB save fallback to memory:", err);
    memDocuments.set(meta.id, meta);
    for (const chunk of chunks) {
      memChunks.set(`${meta.id}_${chunk.chunkIndex}`, chunk);
    }
    memProgress.set(meta.id, {
      docId: meta.id,
      activeChunkIndex: meta.activeChunkIndex || 0,
      lastSentenceId: meta.lastReadSentenceId,
      updatedAt: Date.now(),
    });
  }
}

/**
 * Lấy Metadata của tài liệu theo docId
 */
export async function getDocumentMeta(
  docId: string
): Promise<StructuredDocumentMeta | null> {
  try {
    const db = await getDb();
    const tx = db.transaction("documents", "readonly");
    const store = tx.objectStore("documents");
    const request = store.get(docId);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return memDocuments.get(docId) || null;
  }
}

/**
 * Lấy danh sách tất cả tài liệu đã lưu trong IndexedDB
 */
export async function getAllDocumentsMeta(): Promise<StructuredDocumentMeta[]> {
  try {
    const db = await getDb();
    const tx = db.transaction("documents", "readonly");
    const store = tx.objectStore("documents");
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const list = (request.result as StructuredDocumentMeta[]) || [];
        list.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(list);
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    return Array.from(memDocuments.values()).sort(
      (a, b) => b.updatedAt - a.updatedAt
    );
  }
}

/**
 * Lazy Load 1 Chunk nội dung từ IndexedDB (0ms/rất nhẹ)
 */
export async function getDocumentChunk(
  docId: string,
  chunkIndex: number
): Promise<DocumentChunk | null> {
  try {
    const db = await getDb();
    const tx = db.transaction("chunks", "readonly");
    const store = tx.objectStore("chunks");
    const request = store.get([docId, chunkIndex]);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const record = request.result as StoredChunkRecord | undefined;
        resolve(record ? record.chunk : null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    return memChunks.get(`${docId}_${chunkIndex}`) || null;
  }
}

/**
 * Cập nhật tiến độ đọc hiện tại của tài liệu
 */
export async function updateReadingProgress(
  docId: string,
  chunkIndex: number,
  lastSentenceId?: string
): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(["documents", "reading_progress"], "readwrite");
    const docStore = tx.objectStore("documents");
    const progressStore = tx.objectStore("reading_progress");

    const getDocReq = docStore.get(docId);
    getDocReq.onsuccess = () => {
      const doc = getDocReq.result as StructuredDocumentMeta | undefined;
      if (doc) {
        doc.activeChunkIndex = chunkIndex;
        doc.lastReadSentenceId = lastSentenceId;
        doc.updatedAt = Date.now();
        docStore.put(doc);
      }
    };

    const progressRecord: ReadingProgressRecord = {
      docId,
      activeChunkIndex: chunkIndex,
      lastSentenceId,
      updatedAt: Date.now(),
    };
    progressStore.put(progressRecord);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    const doc = memDocuments.get(docId);
    if (doc) {
      doc.activeChunkIndex = chunkIndex;
      doc.lastReadSentenceId = lastSentenceId;
      doc.updatedAt = Date.now();
    }
    memProgress.set(docId, {
      docId,
      activeChunkIndex: chunkIndex,
      lastSentenceId,
      updatedAt: Date.now(),
    });
  }
}

/**
 * Xóa một tài liệu và toàn bộ chunks của nó
 */
export async function deleteDocument(docId: string): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(["documents", "chunks", "reading_progress"], "readwrite");
    tx.objectStore("documents").delete(docId);
    tx.objectStore("reading_progress").delete(docId);

    const chunkStore = tx.objectStore("chunks");
    const index = chunkStore.index("docId");
    const request = index.getAllKeys(docId);

    request.onsuccess = () => {
      const keys = request.result;
      for (const key of keys) {
        chunkStore.delete(key);
      }
    };

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    memDocuments.delete(docId);
    memProgress.delete(docId);
    for (const key of memChunks.keys()) {
      if (key.startsWith(`${docId}_`)) {
        memChunks.delete(key);
      }
    }
  }
}
