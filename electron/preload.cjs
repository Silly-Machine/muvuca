// Ponte mínima entre a tela e o sistema: só o seletor de pasta. A tela não ganha acesso ao Node.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('muvucaDesktop', {
  escolherPasta: (inicial) => ipcRenderer.invoke('muvuca:escolher-pasta', inicial || ''),
});
