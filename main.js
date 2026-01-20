const { app, BrowserWindow, ipcMain } = require('electron');
const { Bonjour } = require('bonjour-service');
const bonjour = new Bonjour();

let mainWindow;
let browser;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000, 
        height: 800,
        webPreferences: { 
            nodeIntegration: true, 
            contextIsolation: false 
        }
    });

    mainWindow.loadFile('src/index.html');
    
    // Inicia o radar assim que a janela estiver pronta
    mainWindow.webContents.on('did-finish-load', () => {
        iniciarRadar();
    });
}

function iniciarRadar() {
    if (browser) browser.stop();

    browser = bonjour.find({ type: 'http' });

    browser.on('up', (service) => {
        validarEEnviar(service);
    });
}

function validarEEnviar(service) {
    if (!service || !service.addresses) return;

    const name = service.name ? service.name.toLowerCase() : "";
    const isChavi = name.includes('chavi') || (service.txt && service.txt.app === 'chavi');

    if (isChavi) {
        const ipv4 = service.addresses.find(addr => addr.includes('.') && !addr.includes(':'));
        
        if (ipv4 && mainWindow) {
            console.log(`✅ Enviando: ${service.name} -> ${ipv4}`);
            mainWindow.webContents.send('dispositivo-encontrado', {
                nome: service.name,
                ip: ipv4,
                hw: (service.txt && service.txt.hw) ? service.txt.hw : '1.51',
                fw: (service.txt && service.txt.fw) ? service.txt.fw : '1.51'
            });
        }
    }
}

// --- COMUNICAÇÃO IPC ---

// 1. Pedido de Rescan
ipcMain.on('pedir-rescan', () => {
    console.log("🔄 Rescan solicitado...");
    if (browser && browser.services) {
        browser.services.forEach(s => validarEEnviar(s));
    }
    setTimeout(() => iniciarRadar(), 300);
});

// 2. Fechar Aplicação (Acionado pelo seu botão vermelho)
ipcMain.on('fechar-aplicacao', () => {
    console.log("🛑 Recebido comando para encerrar processo...");
    try {
        bonjour.destroy();
    } catch (err) {
        console.error("Erro ao destruir bonjour:", err);
    }
    
    // Encerramento forçado para garantir que o processo suma do Gerenciador de Tarefas
    if (process.platform === 'darwin') {
        app.exit(0);
    } else {
        app.quit();
    }
});

// --- CICLO DE VIDA DO APP ---

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    try { bonjour.destroy(); } catch(e){}
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    try { bonjour.destroy(); } catch(e){}
});