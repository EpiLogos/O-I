import type {HTMLAttributes, ReactNode} from "react";
import "./refusal.css";

/**
 * A refusal, said plainly (packages/oi-design-system/DESKTOP-LANGUAGE.md ruling 2; DLW.md §16.14). The main line says what
 * happened in the place's own words, and what the person can do; the owner's own words follow when they are plain words; the
 * raw cause (a thrown error, a path, an owner code, JSON) sits behind "Why", verbatim, never in the open. The place keeps its
 * own class, role and data attributes, and its actions (Retry, Reopen) follow as children.
 *
 * `refusalWords` is the same line for a place that cannot hold a disclosure: a workspace message, a strip, a live region.
 * tests/plain-refusals.test.mjs holds the reader and ratchets the product against raw errors in a main line.
 */
export function Refusal({said, error, ownWords = false, className = "oi-refusal", role = "alert", children, ...rest}: {
  /** What happened, in the place's words: "Couldn't read the Desk." Never a reason the owner did not give. */
  said: ReactNode;
  /** The owner's answer or the caught error, as it came. */
  error?: unknown;
  /** The place keeps its own designed sentences in the same state as caught errors ("The file changed. Your draft is retained…"):
   * when the words are plain they say what happened on their own, and `said` stands only for a cause that is not plain words. */
  ownWords?: boolean;
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, "children">) {
  const reason = plainReason(error);
  const detail = refusalDetail(error);
  const disclosed = !!detail && !(reason && same(detail, reason));
  return <div className={className} role={role} {...rest}>
    <p className="oi-refusal-line">{ownWords && reason ? reason : typeof said === "string" ? refusalWords(said, error) : <>{said}{reason ? ` ${reason}` : null}</>}</p>
    {disclosed ? <details className="oi-refusal-detail"><summary>Why</summary><p>{detail}</p></details> : null}
    {children}
  </div>;
}

/** The refusal as one line of words: what happened, the owner's plain words when there are some, then what the person can do.
 * The raw cause is left out. */
export function refusalWords(said: string, error?: unknown, next?: string): string {
  const reason = plainReason(error);
  return [said, reason, next].filter(Boolean).join(" ");
}

/** The owner's words as they came, for the disclosure: an Error's message, a string, an answer's message, else its JSON. */
export function refusalDetail(error: unknown): string {
  if (error === undefined || error === null) return "";
  if (error instanceof Error) return (RUNTIME.test(error.name) ? `${error.name}: ${error.message}` : error.message).trim();
  if (typeof error === "string") return error.trim();
  if (typeof error === "object") {
    const message = (error as {message?: unknown}).message;
    if (typeof message === "string") return message.trim();
    try { return JSON.stringify(error); } catch { /* a cycle */ }
  }
  return String(error).trim();
}

/** A thrown error's class before its words ("Error: ", "TypeError: "). */
const THROWN = /^(?:Uncaught\s+)?(?:[A-Z][A-Za-z]*Error|Error|DOMException|Exception)\s*:\s*/;
/** The runtime's own faults: its words are about the code, not a reason a person can act on. */
const RUNTIME = /^(?:Uncaught\s+)?(?:TypeError|SyntaxError|ReferenceError|RangeError|EvalError|URIError|InternalError|AggregateError)\b/;
/** A part of an owner's words that names a place in the machine, not a reason: a path, a URL, a file. */
const LOCATION = /^(?:~?\/|[A-Za-z]:\\|file:|https?:|\w[\w.-]*\.(?:json|md|html|toml|ya?ml|db|sqlite|ts|tsx|mjs|js|rs|py)\b)/;
/** Marks of code in what is left: an identifier, a hash, a structure, a missing value. */
const CODE = /[{}[\]<>`=|\\]|=>|(?:^|[\s'"(])(?:~|\/(?:Users|home|private|tmp|var|opt|Volumes|mnt|usr|etc))\/|https?:\/\/|\b[a-z]+[A-Z]\w*|\b[A-Z][a-z]+[A-Z]\w*|\b\w+_\w+\b|\bE[A-Z]{3,}\b|\b[0-9a-f]{8,}\b|\bundefined\b|\bnull\b|\bNaN\b|\[object|\(\)|\w\.\w+\(/;
/** Causes said in plain words when the owner's own words are not: each restates what the words say, none adds a reason. */
const CAUSES: [RegExp, string][] = [
  [/\bnot found\b|\bno such file\b|\bENOENT\b|\bdoes not exist\b/i, "It was not found."],
  [/\bpermission denied\b|\bEACCES\b|\bEPERM\b|\bnot permitted\b|\bforbidden\b/i, "Permission was refused."],
  [/\btimed? ?out\b|\bETIMEDOUT\b|\bdeadline exceeded\b/i, "No answer came in time."],
  [/\bfailed to fetch\b|\bECONNREFUSED\b|\bECONNRESET\b|\bnetworkerror\b|\bnetwork error\b|\bconnection refused\b|\bcould not connect\b|\bunreachable\b/i, "The owner could not be reached."],
];

/** The owner's reason in plain words, or nothing: the first line, without a thrown-error prefix, a location, JSON or code. */
export function plainReason(error: unknown): string | undefined {
  const detail = refusalDetail(error);
  if (!detail) return undefined;
  let line = detail.split(/\r?\n/)[0]!.trim();
  if (!RUNTIME.test(line)) {
    for (let stripped = line.replace(THROWN, ""); stripped !== line; stripped = line.replace(THROWN, "")) line = stripped;
    if (line.startsWith("{")) {
      try {
        const message = (JSON.parse(line) as {message?: unknown}).message;
        return typeof message === "string" && !message.trim().startsWith("{") ? plainReason(message) : causeOf(detail);
      } catch { /* not one JSON document */ }
    }
    const dump = line.search(/:\s*[{[]/);
    if (dump >= 0) line = line.slice(0, dump);
    line = line.replace(OWNER_CODE, "");
    const words = line.split(/:\s+/).map(part => part.trim()).filter(part => part && !LOCATION.test(part)).join(": ");
    if (words && words.length <= 240 && words.split(/\s+/).length > 1 && /^[\p{L}"'‘“(]/u.test(words) && !CODE.test(words)) {
      const said = `${words[0]!.toUpperCase()}${words.slice(1)}`;
      return /[.!?…]["'’”)]?$/.test(said) ? said : `${said}.`;
    }
  }
  return causeOf(detail);
}

/** An owner's code after its words, as the kernel carries it ("… [encounter.not_attached]"): it goes behind Why. */
const OWNER_CODE = /\s*\[[a-z0-9_.-]+\]\s*$/i;
const causeOf = (detail: string) => CAUSES.find(([pattern]) => pattern.test(detail))?.[1];
/** Whether the disclosure would only repeat the open line: the same words, give or take the prefix, the case and the full stop. */
const same = (detail: string, reason: string) => {
  const bare = (text: string) => text.replace(THROWN, "").replace(/[.!?…\s]+$/, "").trim().toLowerCase();
  return bare(detail) === bare(reason);
};
