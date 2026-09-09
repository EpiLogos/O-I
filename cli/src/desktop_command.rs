/// M′ exposes the same application readers as the desktop, over S dispatch.
/// Window arrangement requires the running application's native window service.
fn command_desktop(args: &[OsString]) -> Result<i32, String> {
    let values: Vec<&str> = args
        .iter()
        .map(|s| s.to_str().ok_or("desktop arguments must be UTF-8"))
        .collect::<Result<_, _>>()?;
    if values.is_empty() || matches!(values.as_slice(), ["--help"] | ["help"] | ["-h"]) {
        println!(
            "O:I M′ desktop application operations\n\
  oi desktop capabilities [--json]\n\
  oi desktop files list ROOT_RELATIVE_PATH\n\
  oi desktop files read LOCATION_JSON\n\
  oi desktop knowledge CWD REQUEST_JSON\n\
  oi desktop session-spaces CWD PROJECT_REF\n\
All operation results are JSON. Knowledge accepts the kernel Request contract.\n\
Window, tab and workspace arrangement remain in the running app's native menu."
        );
        return Ok(0);
    }
    if matches!(
        values.as_slice(),
        ["capabilities"] | ["capabilities", "--json"]
    ) {
        println!("{}", include_str!("../../suite/desktop-projection.json"));
        return Ok(0);
    }
    // Select this exact S implementation for calls made by the shared kernel.
    // Native owner overrides and registered contribution selection remain intact.
    env::set_var("OI_BIN", env::current_exe().map_err(|e| e.to_string())?);
    let data = match values.as_slice() {
        ["files", "list", path] => serde_json::to_value(oi_cradle_kernel::files::list(
            &oi_cradle_kernel::flow::CentralClient::discover(),
            path,
        )?)
        .map_err(|e| e.to_string())?,
        ["files", "read", location] => {
            let location =
                serde_json::from_str(location).map_err(|e| format!("invalid Location: {e}"))?;
            serde_json::to_value(oi_cradle_kernel::files::read(
                &oi_cradle_kernel::flow::CentralClient::discover(),
                &location,
            )?)
            .map_err(|e| e.to_string())?
        }
        ["knowledge", cwd, request] => {
            let request = serde_json::from_str(request)
                .map_err(|e| format!("invalid Knowledge Request: {e}"))?;
            oi_cradle_kernel::knowledge::call(Path::new(cwd), &request)?
        }
        ["session-spaces", cwd, project] => {
            oi_cradle_kernel::agency::Client::discover().read_project(Path::new(cwd), project)?
        }
        _ => return Err("usage: oi desktop --help".into()),
    };
    println!(
        "{}",
        serde_json::to_string(&data).map_err(|e| e.to_string())?
    );
    Ok(0)
}
