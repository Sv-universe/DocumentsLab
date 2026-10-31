import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { DoclabApi, SaveFileRequest, ReplaceDocumentRequest, UpdateDocumentPatch } from '@shared/types'

const api: DoclabApi = {
  getLibrary: () => ipcRenderer.invoke('doclab:library:list'),
  importDocuments: () => ipcRenderer.invoke('doclab:library:import'),
  importPaths: (paths) => ipcRenderer.invoke('doclab:library:importPaths', paths),
  readDocument: (id) => ipcRenderer.invoke('doclab:library:read', id),
  replaceDocument: (request: ReplaceDocumentRequest) =>
    ipcRenderer.invoke('doclab:library:replace', request),
  saveThumbnail: (id, dataUrl) => ipcRenderer.invoke('doclab:library:thumbnail', id, dataUrl),
  updateDocument: (id, patch: UpdateDocumentPatch) =>
    ipcRenderer.invoke('doclab:library:update', id, patch),
  deleteDocument: (id) => ipcRenderer.invoke('doclab:library:delete', id),
  revealDocument: (id) => ipcRenderer.invoke('doclab:library:reveal', id),
  openFileDialog: () => ipcRenderer.invoke('doclab:file:openDialog'),
  readExternal: (path) => ipcRenderer.invoke('doclab:file:readExternal', path),
  saveFile: (request: SaveFileRequest) => ipcRenderer.invoke('doclab:file:save', request),
  getPathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file as File)
    } catch {
      return ''
    }
  },
  getAppVersion: () => ipcRenderer.invoke('doclab:app:version'),
  minimizeWindow: () => ipcRenderer.send('doclab:window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.send('doclab:window:toggleMaximize'),
  closeWindow: () => ipcRenderer.send('doclab:window:close'),
  isWindowMaximized: () => ipcRenderer.invoke('doclab:window:isMaximized'),
  onWindowMaximizedChange: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, maximized: boolean) => callback(maximized)
    ipcRenderer.on('doclab:window:maximized', listener)
    return () => ipcRenderer.removeListener('doclab:window:maximized', listener)
  }
}

contextBridge.exposeInMainWorld('doclab', api)
