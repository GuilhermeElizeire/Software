const { ipcRenderer } = require('electron');

let dispositivosMap = JSON.parse(localStorage.getItem('chavi_devices')) || {};
const listaDiv = document.getElementById('lista');

// --- INICIALIZAÇÃO ---
atualizarInterface();

// --- ESCUTAS DO PROCESSO PRINCIPAL ---
ipcRenderer.on('dispositivo-encontrado', (event, dados) => {
    dispositivosMap[dados.ip] = { ...dados, status: 'online', ts: new Date().getTime() };
    localStorage.setItem('chavi_devices', JSON.stringify(dispositivosMap));
    atualizarInterface();
});

// --- FUNÇÕES DE INTERFACE ---
function atualizarInterface() {
    const busca = document.getElementById('searchInput').value.toLowerCase();
    const ips = Object.keys(dispositivosMap);

    if (ips.length === 0) {
        listaDiv.innerHTML = '<div style="text-align:center; padding:40px; color:#666;">Nenhum dispositivo na frota. Clique em "Escanear Rede".</div>';
        return;
    }

    listaDiv.innerHTML = "";
    ips.forEach(ip => {
        const dev = dispositivosMap[ip];
        if (dev.nome.toLowerCase().includes(busca) || ip.includes(busca)) {
            const cleanId = ip.replace(/\./g, '');
            const isOnline = dev.status === 'online';

            const card = document.createElement('div');
            card.className = 'card';
            card.style.borderLeft = `6px solid ${isOnline ? '#28a745' : '#ccc'}`;
            card.style.opacity = isOnline ? '1' : '0.7';

            card.innerHTML = `
                <div class="card-main">
                    <div class="info-group">
                        <input type="checkbox" class="device-checkbox" value="${ip}" ${!isOnline ? 'disabled' : ''}>
                        <div>
                            <strong>${dev.nome}</strong> 
                            <span class="status-tag ${isOnline ? 'online' : 'offline'}">${isOnline ? 'ONLINE' : 'OFFLINE'}</span>
                            <div style="font-size: 0.8em; color: #666; margin-top:4px;">IP: ${ip} | FW: ${dev.fw || '1.51'}</div>
                            <button class="btn-delete" data-ip="${ip}">🗑️ Remover Dispositivo</button>
                        </div>
                    </div>
                    <button id="btn-abrir-${cleanId}" class="btn-abrir" data-ip="${ip}" data-id="${cleanId}" 
                        ${!isOnline ? 'disabled style="background:#ccc; cursor:not-allowed;"' : ''}>
                        ${isOnline ? 'Abrir' : 'Offline'}
                    </button>
                </div>
                <div id="progress-cont-${cleanId}" class="progress-bar">
                    <div id="progress-fill-${cleanId}" class="progress-fill"></div>
                </div>
            `;
            listaDiv.appendChild(card);
        }
    });

    // Re-atribuir eventos para botões dinâmicos
    atribuirEventosDinamicos();
}

function atribuirEventosDinamicos() {
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.onclick = () => {
            const ip = btn.getAttribute('data-ip');
            if (confirm(`Remover dispositivo ${ip}?`)) {
                delete dispositivosMap[ip];
                localStorage.setItem('chavi_devices', JSON.stringify(dispositivosMap));
                atualizarInterface();
            }
        };
    });

    document.querySelectorAll('.btn-abrir').forEach(btn => {
        btn.onclick = () => acionarRele(btn.getAttribute('data-ip'), btn.getAttribute('data-id'));
    });
}

// --- EVENTOS DE BOTÕES FIXOS ---
document.getElementById('btnRescan').onclick = () => {
    Object.keys(dispositivosMap).forEach(ip => dispositivosMap[ip].status = 'offline');
    atualizarInterface();
    ipcRenderer.send('pedir-rescan');
};

document.getElementById('btnFechar').onclick = () => ipcRenderer.send('fechar-aplicacao');

document.getElementById('searchInput').oninput = () => atualizarInterface();

document.getElementById('selectAll').onclick = (e) => {
    const checkboxes = document.querySelectorAll('.device-checkbox:not(:disabled)');
    checkboxes.forEach(cb => cb.checked = e.target.checked);
};

document.getElementById('btnSelectFW').onclick = () => document.getElementById('massFile').click();

document.getElementById('btnMassUpdate').onclick = async () => {
    const file = document.getElementById('massFile').files[0];
    const selecionados = Array.from(document.querySelectorAll('.device-checkbox:checked')).map(cb => cb.value);
    if (!file || selecionados.length === 0) return alert("Selecione o arquivo e os dispositivos!");

    document.getElementById('btnMassUpdate').innerText = "⏳ Atualizando...";
    await Promise.all(selecionados.map(ip => uploadIndividual(ip, ip.replace(/\./g, ''), file)));
    document.getElementById('btnMassUpdate').innerText = "🚀 Atualizar OTA";
    alert("Processo concluído!");
};

// --- AÇÕES DE REDE ---
async function acionarRele(ip, cleanId) {
    const btn = document.getElementById(`btn-abrir-${cleanId}`);
    btn.disabled = true; btn.innerText = "⏳...";
    try {
        await fetch(`http://${ip}/rele`, { method: 'POST', mode: 'no-cors' });
        btn.innerText = "✅ Aberto"; btn.style.background = "#28a745";
    } catch (e) {
        btn.innerText = "❌ Falha"; btn.style.background = "#dc3545";
    }
    setTimeout(() => {
        btn.disabled = false; btn.innerText = "Abrir"; btn.style.background = "#1a73e8";
    }, 2000);
}

function uploadIndividual(ip, cleanId, file) {
    return new Promise(resolve => {
        const barCont = document.getElementById(`progress-cont-${cleanId}`);
        const barFill = document.getElementById(`progress-fill-${cleanId}`);
        barCont.style.display = "block";
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) barFill.style.width = (e.loaded / e.total * 100) + "%"; };
        xhr.onload = xhr.onerror = () => resolve();
        xhr.open("POST", `http://${ip}/update-file`, true);
        xhr.send(file);
    });
}