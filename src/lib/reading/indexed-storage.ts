import type {
  StructuredDocumentMeta,
  DocumentChunk,
  VdocPackage,
  VdocSavedWord,
  SentenceBreakdownResponse,
} from "@/types/reading";

const DB_NAME = "vocabloom_reading_v2";
const DB_VERSION = 2;

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
const memVdocPackages = new Map<string, VdocPackage>();

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

        // 4. Store lưu toàn bộ phiên đóng gói .vdoc
        if (!db.objectStoreNames.contains("vdoc_packages")) {
          db.createObjectStore("vdoc_packages", { keyPath: "id" });
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
 * Đóng gói và lưu phiên học thành định dạng .vdoc trực tiếp vào IndexedDB
 */
export async function saveVdocPackage(vdoc: VdocPackage): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(
      ["vdoc_packages", "documents", "chunks", "reading_progress"],
      "readwrite"
    );

    const vdocStore = tx.objectStore("vdoc_packages");
    const docStore = tx.objectStore("documents");
    const chunkStore = tx.objectStore("chunks");
    const progressStore = tx.objectStore("reading_progress");

    // 1. Lưu bản đóng gói vdoc hoàn chỉnh
    vdocStore.put(vdoc);

    // 2. Đồng bộ hóa sang document metadata
    docStore.put(vdoc.meta);

    // 3. Đồng bộ hóa chunks
    for (const chunk of vdoc.chunks) {
      const record: StoredChunkRecord = {
        docId: vdoc.id,
        chunkIndex: chunk.chunkIndex,
        chunk,
      };
      chunkStore.put(record);
    }

    // 4. Đồng bộ tiến độ
    const progressRecord: ReadingProgressRecord = {
      docId: vdoc.id,
      activeChunkIndex: vdoc.sessionState.activeChunkIndex,
      lastSentenceId: vdoc.sessionState.lastReadSentenceId,
      updatedAt: vdoc.sessionState.lastSavedAt,
    };
    progressStore.put(progressRecord);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    memVdocPackages.set(vdoc.id, vdoc);
    memDocuments.set(vdoc.meta.id, vdoc.meta);
    memProgress.set(vdoc.id, {
      docId: vdoc.id,
      activeChunkIndex: vdoc.sessionState.activeChunkIndex,
      lastSentenceId: vdoc.sessionState.lastReadSentenceId,
      updatedAt: vdoc.sessionState.lastSavedAt,
    });
    for (const chunk of vdoc.chunks) {
      memChunks.set(`${vdoc.meta.id}_${chunk.chunkIndex}`, chunk);
    }
  }
}

/**
 * Lấy gói .vdoc đầy đủ từ IndexedDB theo ID
 */
export async function getVdocPackage(docId: string): Promise<VdocPackage | null> {
  try {
    const db = await getDb();
    const tx = db.transaction("vdoc_packages", "readonly");
    const store = tx.objectStore("vdoc_packages");
    const request = store.get(docId);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve((request.result as VdocPackage) || null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return memVdocPackages.get(docId) || null;
  }
}

/**
 * Lấy danh sách tất cả các gói .vdoc trong IndexedDB
 */
export async function getAllVdocPackages(): Promise<VdocPackage[]> {
  try {
    const db = await getDb();
    const tx = db.transaction("vdoc_packages", "readonly");
    const store = tx.objectStore("vdoc_packages");
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const list = (request.result as VdocPackage[]) || [];
        list.sort((a, b) => b.sessionState.lastSavedAt - a.sessionState.lastSavedAt);
        resolve(list);
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    return Array.from(memVdocPackages.values()).sort(
      (a, b) => b.sessionState.lastSavedAt - a.sessionState.lastSavedAt
    );
  }
}

/**
 * Helper tạo gói VdocPackage hoàn chỉnh từ trạng thái hiện tại
 */
export function buildVdocPackage(params: {
  meta: StructuredDocumentMeta;
  chunks: DocumentChunk[];
  activeChunkIndex: number;
  lastReadSentenceId?: string;
  aiAnalysesCache?: Record<string, SentenceBreakdownResponse>;
  savedWords?: VdocSavedWord[];
}): VdocPackage {
  const {
    meta,
    chunks,
    activeChunkIndex,
    lastReadSentenceId,
    aiAnalysesCache = {},
    savedWords = [],
  } = params;

  return {
    schema: "vocabloom.vdoc.v1",
    version: "1.0",
    id: meta.id,
    meta: {
      ...meta,
      activeChunkIndex,
      lastReadSentenceId,
      updatedAt: Date.now(),
    },
    sessionState: {
      activeChunkIndex,
      lastReadSentenceId,
      savedWordsCount: savedWords.length,
      analyzedSentencesCount: Object.keys(aiAnalysesCache).length,
      lastSavedAt: Date.now(),
    },
    chunks,
    aiAnalysesCache,
    savedWords,
  };
}

/**
 * Lưu toàn bộ tài liệu cấu trúc (Metadata và tất cả các Chunks) vào IndexedDB
 */
export async function saveStructuredDocument(
  meta: StructuredDocumentMeta,
  chunks: DocumentChunk[]
): Promise<void> {
  // Đồng thời tự động tạo bản đóng gói .vdoc để bảo toàn trọn vẹn phiên
  const vdoc = buildVdocPackage({
    meta,
    chunks,
    activeChunkIndex: meta.activeChunkIndex || 0,
    lastReadSentenceId: meta.lastReadSentenceId,
  });

  return saveVdocPackage(vdoc);
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
 * Lấy toàn bộ chunks của một tài liệu từ IndexedDB
 */
export async function getAllDocumentChunks(
  docId: string
): Promise<DocumentChunk[]> {
  try {
    const db = await getDb();
    const tx = db.transaction("chunks", "readonly");
    const store = tx.objectStore("chunks");
    const index = store.index("docId");
    const request = index.getAll(docId);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const records = (request.result as StoredChunkRecord[]) || [];
        records.sort((a, b) => a.chunkIndex - b.chunkIndex);
        resolve(records.map((r) => r.chunk));
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    const list: DocumentChunk[] = [];
    for (const [k, v] of memChunks.entries()) {
      if (k.startsWith(`${docId}_`)) {
        list.push(v);
      }
    }
    list.sort((a, b) => a.chunkIndex - b.chunkIndex);
    return list;
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
    const tx = db.transaction(
      ["documents", "reading_progress", "vdoc_packages"],
      "readwrite"
    );
    const docStore = tx.objectStore("documents");
    const progressStore = tx.objectStore("reading_progress");
    const vdocStore = tx.objectStore("vdoc_packages");

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

    const getVdocReq = vdocStore.get(docId);
    getVdocReq.onsuccess = () => {
      const vdoc = getVdocReq.result as VdocPackage | undefined;
      if (vdoc) {
        vdoc.sessionState.activeChunkIndex = chunkIndex;
        vdoc.sessionState.lastReadSentenceId = lastSentenceId;
        vdoc.sessionState.lastSavedAt = Date.now();
        vdoc.meta.activeChunkIndex = chunkIndex;
        vdoc.meta.lastReadSentenceId = lastSentenceId;
        vdocStore.put(vdoc);
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
    const vdoc = memVdocPackages.get(docId);
    if (vdoc) {
      vdoc.sessionState.activeChunkIndex = chunkIndex;
      vdoc.sessionState.lastReadSentenceId = lastSentenceId;
      vdoc.sessionState.lastSavedAt = Date.now();
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
 * Xóa một tài liệu và toàn bộ chunks, vdoc packages của nó khỏi IndexedDB
 */
export async function deleteDocument(docId: string): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(
      ["documents", "chunks", "reading_progress", "vdoc_packages"],
      "readwrite"
    );
    tx.objectStore("documents").delete(docId);
    tx.objectStore("reading_progress").delete(docId);
    tx.objectStore("vdoc_packages").delete(docId);

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
    memVdocPackages.delete(docId);
    for (const key of memChunks.keys()) {
      if (key.startsWith(`${docId}_`)) {
        memChunks.delete(key);
      }
    }
  }
}
