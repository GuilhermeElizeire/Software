use mdns_sd::{ServiceDaemon, ServiceEvent};
use tauri::Emitter;
use serde::Serialize;

#[derive(Serialize, Clone)]
struct Dispositivo {
    nome: String,
    ip: String,
}

#[tauri::command]
fn iniciar_radar(window: tauri::Window) {
    let mdns = ServiceDaemon::new().expect("Erro ao iniciar daemon mDNS");
    let receiver = mdns.browse("_http._tcp.local.").expect("Erro ao iniciar browse");

    std::thread::spawn(move || {
        println!("🔍 Radar Rust: Procurando dispositivos...");
        
        while let Ok(event) = receiver.recv() {
            if let ServiceEvent::ServiceResolved(info) = event {
                let fullname = info.get_fullname();
                
                // 1. Limpa o nome removendo o sufixo do protocolo
                let nome_limpo = fullname.replace("._http._tcp.local.", "");
                
                // 2. Filtro: Só envia se contiver "CH" ou "CHAVI" (case-insensitive)
                if nome_limpo.to_lowercase().contains("ch") {
                    let ip = info.get_addresses()
                        .iter()
                        .next()
                        .map(|a| a.to_string())
                        .unwrap_or_else(|| "0.0.0.0".to_string());

                    println!("📡 Enviando para Interface: {} | IP: {}", nome_limpo, ip);

                    let _ = window.emit("dispositivo-encontrado", Dispositivo {
                        nome: nome_limpo,
                        ip,
                    });
                }
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![iniciar_radar])
        .run(tauri::generate_context!())
        .expect("erro ao rodar tauri");
}