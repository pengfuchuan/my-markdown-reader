export interface FileTreeNode {
  name: string;
  kind: 'file' | 'directory';
  path: string;
  handle: FileSystemFileHandle | FileSystemDirectoryHandle;
  children?: FileTreeNode[];
}

// IndexedDB helpers for persisting directory handles
const DB_NAME = 'md-reader-fs';
const STORE = 'handles';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function storeHandle(key: string, handle: FileSystemDirectoryHandle | FileSystemFileHandle) {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(handle, key);
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getHandle(key: string): Promise<FileSystemDirectoryHandle | FileSystemFileHandle | undefined> {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readonly');
  const req = tx.objectStore(STORE).get(key);
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function isMarkdownFile(name: string): boolean {
  return /\.md$/i.test(name);
}

export function isFileSystemAccessSupported(): boolean {
  return 'showOpenFilePicker' in window && 'showDirectoryPicker' in window;
}

async function decodeFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let text = new TextDecoder('utf-8').decode(buffer);
  if (/\ufffd/.test(text) && !/[\u4e00-\u9fff]/.test(text)) {
    try {
      text = new TextDecoder('gbk').decode(buffer);
    } catch {
      // Keep UTF-8 result
    }
  }
  return text;
}

export async function readFileContent(handle: FileSystemFileHandle): Promise<string> {
  const file = await handle.getFile();
  return decodeFile(file);
}

async function sortEntries(entries: [string, FileSystemHandle][]): Promise<[string, FileSystemHandle][]> {
  return entries.sort((a, b) => {
    if (a[1].kind !== b[1].kind) return a[1].kind === 'directory' ? -1 : 1;
    return a[0].localeCompare(b[0], undefined, { sensitivity: 'base' });
  });
}

export async function buildFileTree(
  dirHandle: FileSystemDirectoryHandle,
  prefix = '',
  maxDepth = 5,
  currentDepth = 0
): Promise<FileTreeNode[]> {
  if (currentDepth >= maxDepth) return [];

  const entries: [string, FileSystemHandle][] = [];
  for await (const entry of dirHandle.entries()) {
    entries.push(entry);
  }
  const sorted = await sortEntries(entries);

  const nodes: FileTreeNode[] = [];
  for (const [name, handle] of sorted) {
    const path = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === 'directory') {
      const dirH = handle as FileSystemDirectoryHandle;
      const children = await buildFileTree(dirH, path, maxDepth, currentDepth + 1);
      nodes.push({ name, kind: 'directory', path, handle: dirH, children });
    } else {
      nodes.push({ name, kind: 'file', path, handle: handle as FileSystemFileHandle });
    }
  }
  return nodes;
}

export async function openFile() {
  const [fileHandle] = await (window as any).showOpenFilePicker({
    types: [{ description: 'Markdown files', accept: { 'text/markdown': ['.md', '.markdown'] } }],
    multiple: false,
  });

  const content = await readFileContent(fileHandle);
  await storeFileName(fileHandle.name);

  // Try to get parent directory for file tree
  let tree: FileTreeNode[] = [];
  try {
    const parentHandle = await (fileHandle as any).getParentDirectory?.();
    if (parentHandle) {
      tree = await buildFileTree(parentHandle);
      await storeHandle('lastDir', parentHandle);
    }
  } catch {
    // getParentDirectory not supported or not allowed
  }

  return { content, fileName: fileHandle.name, tree, fileHandle };
}

export async function openDirectory() {
  const dirHandle = await (window as any).showDirectoryPicker({ mode: 'read' });
  const tree = await buildFileTree(dirHandle);
  await storeHandle('lastDir', dirHandle);
  return { dirHandle, tree };
}

// Try to restore last opened directory without showing picker
export async function restoreLastDirectory() {
  const handle = await getHandle('lastDir');
  if (!handle) return null;

  // Check if permission is already granted
  const perm = await (handle as any).queryPermission?.({ mode: 'read' });
  if (perm === 'granted') {
    const tree = await buildFileTree(handle);
    return { dirHandle: handle, tree };
  }

  // Try requesting permission (may show prompt)
  const req = await (handle as any).requestPermission?.({ mode: 'read' });
  if (req === 'granted') {
    const tree = await buildFileTree(handle);
    return { dirHandle: handle, tree };
  }

  return null;
}

// Store last opened filename (used with directory handle to re-read on refresh)
export async function storeFileName(fileName: string) {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(fileName, 'lastFileName');
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Try to re-read the last opened file from disk via directory handle
// (directory handles retain permission across page refreshes, file handles don't)
export async function restoreLastFile(): Promise<{ content: string; fileName: string } | null> {
  const dirHandle = await getHandle('lastDir') as FileSystemDirectoryHandle | undefined;
  if (!dirHandle || dirHandle.kind !== 'directory') return null;

  // Get stored filename
  const db = await openDB();
  const tx = db.transaction(STORE, 'readonly');
  const req = tx.objectStore(STORE).get('lastFileName');
  const fileName = await new Promise<string | undefined>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as string | undefined);
    req.onerror = () => reject(req.error);
  });
  if (!fileName) return null;

  // Check directory permission (no prompt — directory handles retain permission)
  const perm = await (dirHandle as any).queryPermission?.({ mode: 'read' });
  if (perm !== 'granted') return null;

  try {
    const fileHandle = await dirHandle.getFileHandle(fileName);
    const content = await readFileContent(fileHandle);
    return { content, fileName };
  } catch {
    return null;
  }
}
