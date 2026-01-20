async function verificarPlaca() {
    const ip = "192.168.137.206"; 
    console.log(`Tentando conexão com: http://${ip}/api/status`);
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 segundos de timeout

        const response = await fetch(`http://${ip}/api/status`, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
            console.log("✅ Placa respondendo!");
            renderizarCard("Chavi Gateway 2.0", ip);
        } else {
            console.log("⚠️ Placa respondeu, mas com erro HTTP:", response.status);
        }
    } catch (err) {
        console.error("❌ Erro de conexão:", err.message);
        listaDiv.innerHTML = `
            <div style="color:red; padding: 20px; background: #fff; border-radius: 8px;">
                <strong>Erro ao localizar placa:</strong><br>
                O Mac não conseguiu falar com o IP ${ip}.<br>
                <small>Motivo: ${err.message}</small>
            </div>`;
    }
}