(() => {
  "use strict";

  const DB_NAME = "marche_booth_map_project_handles";
  const DB_VERSION = 1;
  const STORE_NAME = "handles";
  const ROOT_KEY = "project_root";

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("このブラウザはIndexedDBに対応していません"));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("IndexedDBを開けませんでした"));
    });
  }

  async function putHandle(handle) {
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(handle, ROOT_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error("フォルダ接続情報を保存できませんでした"));
        tx.onabort = () => reject(tx.error || new Error("フォルダ接続情報の保存が中断されました"));
      });
    } finally { db.close(); }
  }

  async function getHandle() {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).get(ROOT_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error || new Error("フォルダ接続情報を読み込めませんでした"));
      });
    } finally { db.close(); }
  }

  async function clearHandle() {
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(ROOT_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error("フォルダ接続情報を削除できませんでした"));
      });
    } finally { db.close(); }
  }

  async function queryPermission(handle, mode = "readwrite") {
    if (!handle || !handle.queryPermission) return false;
    return (await handle.queryPermission({ mode })) === "granted";
  }

  async function requestPermission(handle, mode = "readwrite") {
    if (!handle) return false;
    if (await queryPermission(handle, mode)) return true;
    if (!handle.requestPermission) return false;
    return (await handle.requestPermission({ mode })) === "granted";
  }

  async function readJson(root, parts) {
    let dir = root;
    for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part);
    const fh = await dir.getFileHandle(parts[parts.length - 1]);
    const file = await fh.getFile();
    return JSON.parse(await file.text());
  }

  async function writeJson(root, parts, data, create = true) {
    let dir = root;
    for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create });
    const fh = await dir.getFileHandle(parts[parts.length - 1], { create });
    const writable = await fh.createWritable();
    await writable.write(JSON.stringify(data, null, 2) + "\n");
    await writable.close();
  }

  window.ProjectHandleStore = { putHandle, getHandle, clearHandle, queryPermission, requestPermission, readJson, writeJson };
})();
