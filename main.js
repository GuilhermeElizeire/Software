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
    mainWindow.webContents.on('did-finish-load', () => iniciarRadar());
}

function iniciarRadar() {
    if (browser) browser.stop();
    browser = bonjour.find({ type: 'http' });

    browser.on('up', (service) => {
        if (!service || !service.addresses) return;

        // Converte TXT binário para String e limpa as chaves
        const txt = {};
        if (service.txt) {
            for (const key in service.txt) {
                const valor = service.txt[key];
                txt[key.toLowerCase()] = Buffer.isBuffer(valor) ? valor.toString().trim() : valor;
            }
        }

        const name = service.name ? service.name.toLowerCase() : "";
        const isChavi = name.includes('chavi') || txt.app === 'chavi';

        if (isChavi) {
            const ipv4 = service.addresses.find(addr => addr.includes('.') && !addr.includes(':'));
            if (ipv4 && mainWindow) {
                mainWindow.webContents.send('dispositivo-encontrado', {
                    nome: service.name,
                    ip: ipv4,
                    hw: txt.hw || "1.51",
                    fw: txt.fw || "1.51"
                });
            }
        }
    });
}

ipcMain.on('pedir-rescan', () => {
    if (browser) browser.stop();
    setTimeout(() => iniciarRadar(), 300);
});

ipcMain.on('fechar-aplicacao', () => {
    bonjour.destroy();
    app.quit();
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
    bonjour.destroy();
    if (process.platform !== 'darwin') app.quit();
});