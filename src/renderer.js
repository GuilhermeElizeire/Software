const { ipcRenderer } = require('electron');

let dispositivosMap = JSON.parse(localStorage.getItem('chavi_devices')) || {};
const listaDiv = document.getElementById('lista');

// --- INICIALIZAÇÃO ---
atualizarInterface();

// Recebe dispositivos do Main Process (Radar)
ipcRenderer.on('dispositivo-encontrado', (event, dados) => {
    dispositivosMap[dados.ip] = { 
        ...dispositivosMap[dados.ip],
        ...dados,
        status: 'online', 
        ts: new Date().getTime() 
    };
    localStorage.setItem('chavi_devices', JSON.stringify(dispositivosMap));
    atualizarInterface();
});

function atualizarInterface() {
    const busca = document.getElementById('searchInput').value.toLowerCase();
    const ips = Object.keys(dispositivosMap);

    if (ips.length === 0) {
        listaDiv.innerHTML = '<div style="text-align:center; padding:40px; color:#666;">Nenhum dispositivo encontrado. Faça um Scan.</div>';
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

card.innerHTML = `
                <div class="card-main">
                    <div style="display:flex; align-items:center; gap:15px;">
                        <input type="checkbox" class="device-checkbox" value="${ip}" ${!isOnline ? 'disabled' : ''}>
                        <div>
                            <strong style="font-size: 16px;">${dev.nome}</strong> 
                            <span class="status-tag ${isOnline ? 'online' : 'offline'}">${isOnline ? 'ONLINE' : 'OFFLINE'}</span>
                            <div style="font-size: 12px; color: #555; margin-top:4px; font-family: monospace;">
                                IP: ${ip} <br>
                                MAC: ${dev.mac || 'Pendente...'}
                            </div>
                            <div style="font-size: 10px; color: #888; margin-top:2px;">
                                HW: ${dev.hw || '2.01'} | FW: ${dev.fw || '2.01'}
                            </div>
                            <button class="btn-del" onclick="remover('${ip}')" style="background:none; border:none; color:red; cursor:pointer; padding:0; font-size:11px; margin-top:5px;">🗑️ Remover Placa</button>
                        </div>
                    </div>
                    <button id="btn-abrir-${cleanId}" class="btn-primary" 
                        onclick="acionarRele('${ip}', '${cleanId}')" 
                        ${!isOnline ? 'disabled style="background:#ccc"' : ''}>Abrir Porta</button>
                </div>
                <div id="progress-cont-${cleanId}" class="progress-bar">
                    <div id="progress-fill-${cleanId}" class="progress-fill"></div>
                </div>`;
            listaDiv.appendChild(card);
        }
    });
}

// --- FUNÇÕES GLOBAIS (window. para funcionar no onclick do HTML) ---

window.remover = (ip) => {
    if (confirm("Remover dispositivo da frota?")) {
        delete dispositivosMap[ip];
        localStorage.setItem('chavi_devices', JSON.stringify(dispositivosMap));
        atualizarInterface();
    }
};

window.acionarRele = async (ip, cleanId) => {
    const btn = document.getElementById(`btn-abrir-${cleanId}`);
    if (!btn) return;

    btn.disabled = true; 
    btn.innerText = "Porta Aberta...";
    btn.style.background = "#0af31d"; // Verde

    try {
        // mode: 'no-cors' é importante para evitar erros de política de segurança com a placa
        await fetch(`http://${ip}/rele`, { method: 'POST', mode: 'no-cors' });
        
        btn.innerText = "✅ Sucesso"; 
        btn.style.background = "#283fa7"; // Verde
    } catch (e) {
        btn.innerText = "❌ Falha"; 
        btn.style.background = "#dc3545"; // Vermelho
    }

    setTimeout(() => {
        btn.disabled = false; 
        btn.innerText = "Abrir"; 
        btn.style.background = "#1a73e8"; // Cor azul padrão
    }, 2000);
};

// --- EVENTOS DE CONTROLE ---

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

document.getElementById('massFile').onchange = (e) => {
    if(e.target.files.length > 0) {
        document.getElementById('btnSelectFW').innerText = "✅ " + e.target.files[0].name;
    }
};

document.getElementById('btnMassUpdate').onclick = async () => {
    const file = document.getElementById('massFile').files[0];
    const selecionados = Array.from(document.querySelectorAll('.device-checkbox:checked')).map(cb => cb.value);
    
    if (!file) return alert("Selecione o arquivo .bin primeiro!");
    if (selecionados.length === 0) return alert("Selecione os dispositivos online!");

    document.getElementById('btnMassUpdate').innerText = "⏳ Atualizando...";
    
    // Executa as atualizações em paralelo
    await Promise.all(selecionados.map(ip => uploadIndividual(ip, ip.replace(/\./g, ''), file)));
    
    document.getElementById('btnMassUpdate').innerText = "🚀 Atualizar OTA";
    alert("Processo de atualização concluído!");
};

function uploadIndividual(ip, cleanId, file) {
    return new Promise(resolve => {
        const barCont = document.getElementById(`progress-cont-${cleanId}`);
        const barFill = document.getElementById(`progress-fill-${cleanId}`);
        if(barCont) barCont.style.display = "block";

        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = (e.loaded / e.total) * 100;
                if(barFill) barFill.style.width = percent + "%";
            }
        };
        
        xhr.onload = xhr.onerror = () => {
            // Pequeno atraso para o usuário ver os 100% antes de sumir ou resetar
            setTimeout(() => { resolve(); }, 500);
        };

        xhr.open("POST", `http://${ip}/update-file`, true);
        xhr.send(file);
    });
}