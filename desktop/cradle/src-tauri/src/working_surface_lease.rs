//! Thin native adapter: the kernel resolves identity; the existing PTY owner
//! hosts only that provider's attachment client. A renderer never supplies argv.
use crate::{KernelHost,terminal::{BoundClient,Size,Batch}};
use oi_cradle_kernel::events::KERNEL_EVENT_TOPIC;
use serde_json::{json,Value};
use std::{collections::BTreeMap,sync::{Arc,Mutex,OnceLock,atomic::{AtomicU64,AtomicBool,Ordering}},time::{SystemTime,UNIX_EPOCH}};
use tauri::{AppHandle,Manager,Emitter,WebviewWindow};
use tauri_plugin_dialog::{DialogExt,MessageDialogButtons};
struct Lease {client:BoundClient,host:String,session:String,binding:String,last_seen:AtomicU64,closed:AtomicBool}
static NEXT:AtomicU64=AtomicU64::new(1);
static LEASES:OnceLock<Mutex<BTreeMap<String,Arc<Lease>>>>=OnceLock::new();
fn leases()->&'static Mutex<BTreeMap<String,Arc<Lease>>> {LEASES.get_or_init(||Mutex::new(BTreeMap::new()))}
fn now()->u64 {SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64}
fn lookup(id:&str,host:&str)->Result<Arc<Lease>,String> {
    let lease=leases().lock().map_err(|_|"Attachment leases unavailable")?.get(id).cloned().ok_or("Attachment lease ended")?;
    if lease.host!=host||lease.closed.load(Ordering::SeqCst) {return Err("Attachment belongs to another view or has ended".into());}
    lease.last_seen.store(now(),Ordering::Relaxed);Ok(lease)
}
fn event(app:&AppHandle,id:&str,lease:&Lease,driving:bool)->Result<(),String> {
    let receipt=app.state::<KernelHost>().0.lock().map_err(|_|"Kernel unavailable")?.record_working_surface_driving(lease.session.clone(),lease.binding.clone(),id.to_owned(),driving);
    app.emit(KERNEL_EVENT_TOPIC,&receipt).map_err(|e|e.to_string())
}
fn release(app:&AppHandle,id:&str,host:&str)->Result<(),String> {
    let lease={let guard=leases().lock().map_err(|_|"Attachment leases unavailable")?;let Some(lease)=guard.get(id).cloned() else{return Ok(());};if lease.host!=host{return Err("Attachment belongs to another view".into());}lease};
    if lease.closed.swap(true,Ordering::SeqCst) {return Ok(());}
    if let Err(reason)=lease.client.release() {lease.closed.store(false,Ordering::SeqCst);return Err(reason);}
    leases().lock().map_err(|_|"Attachment leases unavailable")?.remove(id);
    event(app,id,&lease,false)
}
fn reading(app:&AppHandle,project:String,agent_session:String,binding:String)->Result<Value,String> {
    let prepared=app.state::<KernelHost>().0.lock().map_err(|_|"Kernel unavailable")?.prepare_working_surface_read(&project,agent_session,Some(binding),true)?;
    prepared.execute()
}
#[tauri::command]
pub async fn working_surface_takeover(app:AppHandle,window:WebviewWindow,project:String,agent_session:String,binding:String,dimensions:Size)->Result<Value,String> {
    if window.label()!="main" {return Err("Take over a run from the main desktop window".into());}
    tauri::async_runtime::spawn_blocking(move||{
        let initial=reading(&app,project.clone(),agent_session.clone(),binding.clone())?;
        if initial["attachment"]["outcome"]!="attach" {return Err(initial["attachment"]["reason"].as_str().unwrap_or("This provider has no terminal attachment").into());}
        if !app.dialog().message("Your keyboard input will go to the run's existing terminal. The agent may also be using it. Release returns this view to read-only; it does not stop the run.")
            .title("Take over this terminal?").buttons(MessageDialogButtons::OkCancelCustom("Take over".into(),"Cancel".into())).blocking_show() {return Err("Takeover cancelled".into());}
        let current=reading(&app,project,agent_session.clone(),binding.clone())?;
        if current["attachment"]!=initial["attachment"] {return Err("The bound terminal changed while confirmation was open".into());}
        let argv:Vec<String>=serde_json::from_value(current["attachment"]["argv"].clone()).map_err(|e|e.to_string())?;
        let cwd=current["cwd"].as_str().ok_or("Native project directory absent")?.to_owned();
        let id=format!("working-client-{}",NEXT.fetch_add(1,Ordering::Relaxed));
        let host=window.label().to_owned();
        let lease=Arc::new(Lease{client:BoundClient::start(cwd,argv,host.clone(),dimensions)?,host:host.clone(),session:agent_session,binding,last_seen:AtomicU64::new(now()),closed:AtomicBool::new(false)});
        leases().lock().map_err(|_|"Attachment leases unavailable")?.insert(id.clone(),lease.clone());
        if let Err(reason)=event(&app,&id,&lease,true) {let _=release(&app,&id,&host);return Err(reason);}
        let watch_id=id.clone();let watch_app=app.clone();
        std::thread::spawn(move||loop {
            std::thread::sleep(std::time::Duration::from_secs(1));
            if lease.closed.load(Ordering::SeqCst) {break;}
            // A closed/reloaded view cannot leave a live input client behind.
            if now().saturating_sub(lease.last_seen.load(Ordering::Relaxed))>15_000 {
                let _=release(&watch_app,&watch_id,&host);break;
            }
        });
        Ok(json!({"client_id":id,"seq":0}))
    }).await.map_err(|e|e.to_string())?
}
#[tauri::command]
pub async fn working_surface_client_poll(window:WebviewWindow,client_id:String,seq:u64)->Result<Batch,String> {
    lookup(&client_id,window.label())?.client.poll(seq)
}
#[tauri::command]
pub async fn working_surface_client_input(window:WebviewWindow,client_id:String,data:String)->Result<(),String> {
    lookup(&client_id,window.label())?.client.input(&data)
}
#[tauri::command]
pub async fn working_surface_client_resize(window:WebviewWindow,client_id:String,dimensions:Size)->Result<(),String> {
    lookup(&client_id,window.label())?.client.resize(dimensions)
}
#[tauri::command]
pub async fn working_surface_release(app:AppHandle,window:WebviewWindow,client_id:String)->Result<(),String> {
    tauri::async_runtime::spawn_blocking(move||release(&app,&client_id,window.label())).await.map_err(|e|e.to_string())?
}
