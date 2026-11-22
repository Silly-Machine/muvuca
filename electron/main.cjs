// Aplicativo de mesa da Muvuca: sobe o mesmo servidor local dentro do Electron e mostra a tela numa janela.
// O servidor continua atendendo só em 127.0.0.1, numa porta livre escolhida na hora.
const { app, BrowserWindow, dialog, ipcMain, shell, Menu } = require('electron');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const RAIZ = path.join(__dirname, '..');
let janela = null;
let endereco = '';

// Aplicativo aberto pelo ícone, no macOS e no Linux, não herda o PATH do terminal: sem isto o "claude" não seria achado.
function completarPath() {
  if (process.platform === 'win32') return;
  const casa = os.homedir();
  const extras = [path.join(casa, '.local', 'bin'), path.join(casa, '.claude', 'local'), path.join(casa, '.npm-global', 'bin'),
    path.join(casa, '.bun', 'bin'), path.join(casa, '.volta', 'bin'), '/opt/homebrew/bin', '/usr/local/bin'];
  const atual = (process.env.PATH || '').split(path.delimiter);
  process.env.PATH = [...atual, ...extras.filter((p) => !atual.includes(p))].join(path.delimiter);
}

// O aplicativo prefere sempre a mesma porta: o que a tela guarda no navegador (pasta escolhida, conversa recolhida)
// vale por endereço, e com porta sorteada tudo se perdia a cada abertura. Se ela estiver ocupada, usa uma livre.
const PORTA_DO_APP = 43170;
function portaDoApp() {
  return new Promise((resolve) => {
    const s = require('node:net').createServer();
    s.once('error', () => resolve(0));
    s.once('listening', () => s.close(() => resolve(PORTA_DO_APP)));
    s.listen(PORTA_DO_APP, '127.0.0.1');
  });
}

async function subirServidor() {
  completarPath();
  if (!process.env.MUVUCA_PORTA) process.env.MUVUCA_PORTA = String(await portaDoApp());
  const { pronto } = await import(pathToFileURL(path.join(RAIZ, 'src', 'servidor.js')).href);
  return pronto;
}

async function trabalhando() {
  try { return (await (await fetch(`${endereco}/api/config`)).json()).rodando === true; } catch { return false; }
}

function abrirJanela() {
  janela = new BrowserWindow({
    width: 1480, height: 920, minWidth: 980, minHeight: 640, show: false,
    backgroundColor: '#241c22', title: 'Muvuca', autoHideMenuBar: true,
    icon: path.join(__dirname, 'recursos', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  janela.once('ready-to-show', () => { if (!process.env.MUVUCA_CAPTURA) janela.show(); });
  // Só a própria Muvuca abre dentro da janela; qualquer outro endereço vai para o navegador do sistema.
  janela.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  janela.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(endereco)) { e.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url); } });
  // Fechar com o time trabalhando interrompe o pedido: confirma antes.
  let confirmado = false;
  janela.on('close', async (e) => {
    if (confirmado || process.env.MUVUCA_CAPTURA) return;
    e.preventDefault();
    if (await trabalhando()) {
      const r = await dialog.showMessageBox(janela, { type: 'warning', buttons: ['Continuar trabalhando', 'Fechar mesmo assim'], defaultId: 0, cancelId: 0,
        message: 'O time está no meio de um pedido.', detail: 'Fechar agora interrompe o trabalho. O que já foi escrito fica esperando a sua decisão na próxima abertura.' });
      if (r.response !== 1) return;
    }
    confirmado = true; janela.close();
  });
  janela.on('closed', () => { janela = null; });
  return janela.loadURL(endereco + '/');
}

// Modo de captura (só para gerar as imagens da documentação): MUVUCA_CAPTURA=pasta tira as fotos e sai.
async function capturar(pasta) {
  fs.mkdirSync(pasta, { recursive: true });
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const foto = async (nome) => { await espera(1800); fs.writeFileSync(path.join(pasta, nome), (await janela.webContents.capturePage()).toPNG()); };
  const js = (codigo) => janela.webContents.executeJavaScript(codigo);
  janela.setContentSize(1440, 860); janela.showInactive();
  await foto('palco.png');
  await js(`document.getElementById('navConstrutor').click(); setTimeout(() => document.querySelectorAll('#galeria > *')[3]?.click(), 300)`);
  await foto('construtor.png');
  await js(`document.getElementById('navTime').click(); boasVindas(true).then(() => { document.getElementById('bvPasta').value = 'C:\\\\Projetos\\\\meu-projeto'; })`);
  await foto('boas-vindas.png');
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (janela) { if (janela.isMinimized()) janela.restore(); janela.focus(); } });
  app.whenReady().then(async () => {
    Menu.setApplicationMenu(process.platform === 'darwin' ? Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' }]) : null);
    ipcMain.handle('muvuca:escolher-pasta', async (_e, inicial) => {
      const r = await dialog.showOpenDialog(janela, { title: 'Pasta do projeto', defaultPath: typeof inicial === 'string' && inicial ? inicial : os.homedir(), properties: ['openDirectory', 'createDirectory'] });
      return r.canceled ? '' : r.filePaths[0] || '';
    });
    try {
      endereco = `http://127.0.0.1:${await subirServidor()}`;
      await abrirJanela();
      if (process.env.MUVUCA_CAPTURA) { await capturar(path.resolve(process.env.MUVUCA_CAPTURA)); app.exit(0); }
    } catch (e) {
      dialog.showErrorBox('A Muvuca não conseguiu abrir', String(e && e.message || e));
      app.exit(1);
    }
  });
  app.on('window-all-closed', () => app.quit());
}
