//! Minimal XML element tree for Live documents.
//!
//! Live's XML is attribute/value oriented and machine-generated (stable
//! ordering not required for correctness — the real writer rewrites the
//! whole document on save), so a small ordered tree with string values is
//! sufficient and keeps the crate honest about what it knows.

#[derive(Debug, Clone)]
pub struct Element {
    pub name: String,
    pub attrs: Vec<(String, String)>,
    pub children: Vec<Element>,
    pub text: String,
}

impl Element {
    pub fn new(name: &str) -> Element {
        Element { name: name.to_string(), attrs: Vec::new(), children: Vec::new(), text: String::new() }
    }

    pub fn attr(&self, name: &str) -> Option<&str> {
        self.attrs.iter().find(|(k, _)| k == name).map(|(_, v)| v.as_str())
    }

    pub fn set_attr(&mut self, name: &str, value: &str) {
        if let Some(slot) = self.attrs.iter_mut().find(|(k, _)| k == name) {
            slot.1 = value.to_string();
        } else {
            self.attrs.push((name.to_string(), value.to_string()));
        }
    }

    /// First child with this tag name (non-recursive).
    pub fn child(&self, name: &str) -> Option<&Element> {
        self.children.iter().find(|c| c.name == name)
    }

    pub fn child_mut(&mut self, name: &str) -> Option<&mut Element> {
        self.children.iter_mut().find(|c| c.name == name)
    }

    /// First descendant with this tag name (document order, depth-first).
    pub fn find(&self, name: &str) -> Option<&Element> {
        if self.name == name {
            return Some(self);
        }
        for c in &self.children {
            if let Some(found) = c.find(name) {
                return Some(found);
            }
        }
        None
    }

    pub fn find_mut(&mut self, name: &str) -> Option<&mut Element> {
        if self.name == name {
            return Some(self);
        }
        for c in &mut self.children {
            if let Some(found) = c.find_mut(name) {
                return Some(found);
            }
        }
        None
    }

    /// Value of `<Manual Value="…"/>` under the named parameter element.
    pub fn manual_of(&self, param: &str) -> Option<&str> {
        self.find(param).and_then(|p| p.child("Manual")).and_then(|m| m.attr("Value"))
    }

    pub fn children_named<'a>(&'a self, name: &'a str) -> impl Iterator<Item = &'a Element> {
        self.children.iter().filter(move |c| c.name == name)
    }
}

/// Parse a Live XML document (the string after gunzip) into a tree whose
/// root is `<Ableton>`.
pub fn parse(xml: &str) -> Result<Element, ParseError> {
    let mut reader = quick_xml::Reader::from_str(xml);
    reader.config_mut().trim_text(true);
    let mut stack: Vec<Element> = Vec::new();
    let mut root: Option<Element> = None;
    let mut buf = Vec::new();
    loop {
        buf.clear();
        match reader.read_event_into(&mut buf) {
            Ok(quick_xml::events::Event::Start(e)) => {
                let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                let mut el = Element::new(&name);
                for a in e.attributes().flatten() {
                    el.attrs.push((
                        String::from_utf8_lossy(a.key.as_ref()).to_string(),
                        String::from_utf8_lossy(&a.value).to_string(),
                    ));
                }
                stack.push(el);
            }
            Ok(quick_xml::events::Event::Empty(e)) => {
                let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                let mut el = Element::new(&name);
                for a in e.attributes().flatten() {
                    el.attrs.push((
                        String::from_utf8_lossy(a.key.as_ref()).to_string(),
                        String::from_utf8_lossy(&a.value).to_string(),
                    ));
                }
                if let Some(top) = stack.last_mut() {
                    top.children.push(el);
                }
            }
            Ok(quick_xml::events::Event::End(_)) => {
                let el = stack.pop().ok_or_else(|| ParseError("unbalanced end tag".into()))?;
                if let Some(top) = stack.last_mut() {
                    top.children.push(el);
                } else {
                    root = Some(el);
                }
            }
            Ok(quick_xml::events::Event::Text(t)) => {
                if let Some(top) = stack.last_mut() {
                    if let Ok(s) = t.unescape() {
                        top.text.push_str(&s);
                    }
                }
            }
            Ok(quick_xml::events::Event::Eof) => break,
            Err(e) => return Err(ParseError(format!("xml: {e}"))),
            _ => {}
        }
    }
    root.ok_or_else(|| ParseError("no root element".into()))
}

/// Serialize a tree back to XML with Live's declaration.
pub fn serialize(root: &Element) -> String {
    let mut out = String::from("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
    write_el(root, &mut out);
    out.push('\n');
    out
}

fn write_el(el: &Element, out: &mut String) {
    out.push('<');
    out.push_str(&el.name);
    for (k, v) in &el.attrs {
        out.push(' ');
        out.push_str(k);
        out.push_str("=\"");
        out.push_str(&escape(v));
        out.push('"');
    }
    if el.children.is_empty() && el.text.is_empty() {
        out.push_str(" />");
        return;
    }
    out.push('>');
    out.push_str(&escape(&el.text));
    for c in &el.children {
        write_el(c, out);
    }
    out.push_str("</");
    out.push_str(&el.name);
    out.push('>');
}

fn escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

#[derive(Debug)]
pub struct ParseError(pub String);

impl std::fmt::Display for ParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::error::Error for ParseError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_small_tree() {
        let src = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<Ableton MajorVersion=\"5\"><LiveSet><Tempo><Manual Value=\"120\" /></Tempo></LiveSet></Ableton>";
        let tree = parse(src).unwrap();
        assert_eq!(tree.name, "Ableton");
        let t = tree.find("Tempo").unwrap();
        assert_eq!(t.child("Manual").unwrap().attr("Value"), Some("120"));
        let out = serialize(&tree);
        let again = parse(&out).unwrap();
        assert_eq!(serialize(&again), out);
    }
}
