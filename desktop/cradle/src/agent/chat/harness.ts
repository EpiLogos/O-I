/**
 * Harness, connection and model are three different things (10-SIDEBARS
 * §4.1, amendment A1). A connection (an AIKit encounter provider) runs one
 * HARNESS — Pi, Hermes, Gemini CLI, Codex, Claude Code — named here from the
 * connection's own protocol and command, never from its free-text label.
 * The label (often a campaign note) is a second line inside the picker only;
 * a variant such as "sandboxed" is a quiet badge. Pure.
 */
export interface ConnectionFacts {
 id:string;
 label:string;
 /** Owner facts (AIKit providers / the session's binding): the wire protocol,
  *  the basename of the launched command and of its script entry, if any. */
 protocol?:string|null;
 command?:string|null;
 entry?:string|null;
 sandboxed?:boolean|null;
}

const KNOWN:[RegExp,string][]=[
 [/^claude(-code)?(-acp)?$|^claude-agent-acp$|claude-code-acp/i,"Claude Code"],
 [/codex/i,"Codex"],
 [/^gemini(-cli)?$/i,"Gemini CLI"],
 // A launcher named after its harness (hermes-acp, hermes-glm) is that harness.
 [/^hermes([-_].+)?$/i,"Hermes"],
 [/^opencode$/i,"OpenCode"],
 [/^kimi(-cli)?$/i,"Kimi"],
 [/^goose$/i,"Goose"],
 [/^pi([-_].+)?$/i,"Pi"],
];
const strip=(name:string)=>name.replace(/\.(m?js|cjs|ts|py)$/i,"").replace(/^index$/,"");
const RUNTIMES=/^(node|nodejs|bun|deno|python3?(\.\d+)?|uv|uvx|npx)$/i;

/** The harness name, or undefined when the owner gave no command to read it from. */
export function harnessName(facts:ConnectionFacts):string|undefined {
 const command=facts.command?strip(facts.command):undefined;
 const entry=facts.entry?strip(facts.entry):undefined;
 const candidates=[command&&!RUNTIMES.test(command)?command:undefined,entry].filter((value):value is string=>!!value);
 for(const candidate of candidates)for(const [pattern,name] of KNOWN)if(pattern.test(candidate))return name;
 if(facts.protocol==="pi-rpc"&&!candidates.some(candidate=>/codex|claude|gemini|hermes/i.test(candidate)))return "Pi";
 if(facts.protocol==="prime-rpc")return "Epi Prime";
 const plain=candidates[0];
 return plain?plain.replace(/[-_]+/g," ").replace(/\b\w/g,letter=>letter.toUpperCase()):undefined;
}

/** The chip's words: the harness name, never the label. Without owner facts
 *  the chip says what kind of connection it is, not what someone named it. */
export function harnessChip(facts:ConnectionFacts):string {
 return harnessName(facts)??(facts.protocol==="acp"?"ACP agent":"Harness");
}
export function harnessVariant(facts:ConnectionFacts):string|undefined {
 return facts.sandboxed?"sandboxed":undefined;
}

export interface HarnessGroup {name:string;connections:ConnectionFacts[]}
/** Connections grouped by harness name, in first-seen order. */
export function groupByHarness(connections:ConnectionFacts[]):HarnessGroup[] {
 const groups:HarnessGroup[]=[];
 for(const connection of connections){
  const name=harnessChip(connection);
  let group=groups.find(entry=>entry.name===name);
  if(!group){group={name,connections:[]};groups.push(group);}
  group.connections.push(connection);
 }
 return groups;
}

/** Owner facts read from the session's own journal binding (`effective_launch_argv`,
 *  `protocol`) — used when the providers listing predates the protocol/command facts. */
export function factsFromBinding(binding:{protocol?:unknown;effective_launch_argv?:unknown;provider?:unknown}|undefined):Partial<ConnectionFacts> {
 if(!binding)return {};
 const argv=Array.isArray(binding.effective_launch_argv)?binding.effective_launch_argv.filter((part):part is string=>typeof part==="string"):[];
 const base=(path:string|undefined)=>path?path.split("/").pop():undefined;
 const entry=argv.slice(1).find(part=>/\.(m?js|cjs|ts|py)$/i.test(part));
 return {protocol:typeof binding.protocol==="string"?binding.protocol:undefined,command:base(argv[0])??null,entry:base(entry)??null};
}
