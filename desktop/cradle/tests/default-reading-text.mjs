import {execFileSync} from 'node:child_process';

/** Observe native closed-details semantics, text and announced names. Optional
 * srcdoc traversal reads actual saved iframe documents, without running them. */
export function defaultReadingText(html,{includeFrames=false}={}) {
  return execFileSync('python3',['-c',String.raw`
from html.parser import HTMLParser
import sys
class Reading(HTMLParser):
    def __init__(self,depth=0): super().__init__(); self.details=[]; self.output=[]; self.depth=depth
    def visible(self): return all(item[0] or item[1] for item in self.details)
    def handle_starttag(self,tag,attributes):
        attrs=dict(attributes)
        if tag=='details': self.details.append(['open' in attrs,False])
        if tag=='summary' and self.details: self.details[-1][1]=True
        if self.visible():
            self.output.extend(attrs[key] for key in ['aria-label','title'] if attrs.get(key))
            if tag=='iframe' and attrs.get('srcdoc') and sys.argv[1]=='true' and self.depth<4:
                frame=Reading(self.depth+1); frame.feed(attrs['srcdoc']); self.output.extend(frame.output)
    def handle_endtag(self,tag):
        if tag=='summary' and self.details: self.details[-1][1]=False
        if tag=='details': self.details.pop()
    def handle_data(self,text):
        if self.visible(): self.output.append(text)
reading=Reading(); reading.feed(sys.stdin.read()); print(' '.join(reading.output))
`,String(includeFrames)],{input:html,encoding:'utf8',maxBuffer:8*1024*1024});
}
