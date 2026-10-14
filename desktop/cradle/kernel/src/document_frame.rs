//! The native document frame: the page a Central document face's iframe
//! loads under Tauri (the Flow, the Day die), served by the host's
//! `oi-material://` protocol at [`PATH`].
//!
//! Why it exists: a `srcdoc` document inherits its parent's Content-Security-
//! Policy, and the shell window's `script-src` names a hash with no
//! `'unsafe-inline'` — so every inline script of a hosted Central form is
//! refused natively and the pane stays blank. This page is a document of its
//! own origin and carries no policy. It asks its parent once for the
//! document, writes exactly what the parent sends — the same projection a
//! `srcdoc` frame carries (`desktop/cradle/src/document/frame.ts`
//! `useDocumentFrame`), payload seam and document-host scripts included —
//! and is gone.
//!
//! Laws: the page is candidate-owned code compiled into the binary; it reads
//! no file and calls no owner. Every byte it writes reached the face through
//! the owners' own reads (`central.files.read`, the receiving contract), as
//! the `srcdoc` path's bytes do. It grants the frame nothing: no native
//! bridge, and it answers only its own parent window.

/// The one path this module answers (under the `/__application/` prefix the
/// protocol reserves for candidate-owned code).
pub const PATH: &str = "/__application/document/frame.html";
/// The frame's question to its parent: send the document.
pub const READY: &str = "oi:document-frame-ready";
/// The parent's answer: `{type: WRITE, html}`.
pub const WRITE: &str = "oi:document-frame-write";
/// The page itself.
pub const PAGE: &str = include_str!("document_frame.html");

const HTML: &str = "text/html; charset=utf-8";

/// A response for the protocol to send: status, content type and body.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FramePage {
    pub status: u16,
    pub content_type: &'static str,
    pub body: Vec<u8>,
}

impl FramePage {
    fn refuse(status: u16, message: &str) -> Self {
        Self {
            status,
            content_type: "text/plain; charset=utf-8",
            body: message.as_bytes().to_vec(),
        }
    }
}

/// Answer a request for the document frame. `None` for every other path —
/// the protocol's other routes (material, World, application assets) keep
/// them, byte for byte as before. The host and method are admitted as the
/// application asset route admits them.
pub fn serve(host: Option<&str>, method: &str, path: &str) -> Option<FramePage> {
    if path != PATH {
        return None;
    }
    if !matches!(host, Some("localhost" | "oi-material.localhost")) {
        return Some(FramePage::refuse(
            403,
            "This webview cannot load the document frame",
        ));
    }
    let body = match method {
        "GET" => PAGE.as_bytes().to_vec(),
        "HEAD" => Vec::new(),
        _ => return Some(FramePage::refuse(405, "The document frame is read-only")),
    };
    Some(FramePage {
        status: 200,
        content_type: HTML,
        body,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serves_the_page_at_its_one_path() {
        for host in ["localhost", "oi-material.localhost"] {
            let page = serve(Some(host), "GET", PATH).expect("the frame path is answered");
            assert_eq!(page.status, 200);
            assert_eq!(page.content_type, "text/html; charset=utf-8");
            assert_eq!(page.body, PAGE.as_bytes());
        }
        let head = serve(Some("localhost"), "HEAD", PATH).expect("HEAD is answered");
        assert_eq!((head.status, head.body.len()), (200, 0));
    }

    #[test]
    fn every_other_path_is_left_to_the_other_routes() {
        for path in [
            "/__application/document/frame.html/",
            "/__application/document/",
            "/__application/document/frame.htm",
            "/__application/document/frame%2Ehtml",
            "/__application/expressions/index.html",
            "/x/__application/document/frame.html",
            "/%7B%22schema%22%3A%22central.path-ref%2Fv1%22%7D/",
            "/__world/w/r/index.html",
            "/",
        ] {
            assert_eq!(serve(Some("localhost"), "GET", path), None, "{path}");
        }
    }

    #[test]
    fn foreign_hosts_and_writes_are_refused() {
        for host in [None, Some("example.com"), Some("tauri.localhost")] {
            assert_eq!(serve(host, "GET", PATH).map(|page| page.status), Some(403));
        }
        for method in ["POST", "PUT", "DELETE"] {
            let page = serve(Some("localhost"), method, PATH).expect("answered");
            assert_eq!(page.status, 405);
            assert_eq!(page.content_type, "text/plain; charset=utf-8");
        }
    }

    #[test]
    fn the_page_asks_its_parent_once_and_writes_only_what_its_parent_sends() {
        assert!(PAGE.starts_with("<!doctype html>"));
        assert!(PAGE.contains(&format!("parent.postMessage({{type: '{READY}'}}, '*')")));
        assert!(PAGE.contains(&format!("data.type !== '{WRITE}'")));
        assert!(
            PAGE.contains("event.source !== parent"),
            "only its own parent writes"
        );
        assert!(PAGE.contains("if (written ||"), "it writes once");
        assert!(PAGE.contains("removeEventListener('message', write)"));
        assert!(PAGE
            .contains("document.open();\n    document.write(data.html);\n    document.close();"));
        assert!(
            PAGE.contains("if (parent === window) return;"),
            "a top-level load writes nothing"
        );
    }

    #[test]
    fn the_page_carries_no_policy_and_no_bridge() {
        let lower = PAGE.to_ascii_lowercase();
        for policy in ["content-security-policy", "http-equiv"] {
            assert!(
                !lower.contains(policy),
                "the written form keeps its own scripts: {policy}"
            );
        }
        for absent in [
            "__tauri",
            "invoke(",
            "fetch(",
            "xmlhttprequest",
            "oi-material://localhost/%7b",
            "src=",
        ] {
            assert!(
                !lower.contains(absent),
                "the frame page reaches nothing: {absent}"
            );
        }
        assert_eq!(
            PAGE.matches("<script>").count(),
            1,
            "one script, inline, its own"
        );
    }
}
