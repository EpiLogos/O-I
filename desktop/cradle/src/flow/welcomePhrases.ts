export type WelcomeTone = "warm" | "playful" | "quiet";
export type WelcomePlacement = "opening" | "returning" | "either";

/** Stable copy records: IDs are composition keys, while text can be replaced. */
export interface WelcomePhrase {
  id: string;
  text: string;
  tone: WelcomeTone;
  placement: WelcomePlacement;
}

export const DEFAULT_WELCOME_PHRASES = [
  {id:"what-is-on-your-mind",text:"What’s on your mind?",tone:"warm",placement:"opening"},
  {id:"where-shall-we-begin",text:"Where shall we begin?",tone:"warm",placement:"opening"},
  {id:"what-needs-a-little-space",text:"What needs a little space?",tone:"quiet",placement:"opening"},
  {id:"bring-me-a-question",text:"Bring me a question.",tone:"playful",placement:"opening"},
  {id:"start-anywhere",text:"Start anywhere.",tone:"quiet",placement:"opening"},
  {id:"what-are-you-noticing",text:"What are you noticing?",tone:"warm",placement:"either"},
  {id:"what-feels-worth-following",text:"What feels worth following?",tone:"quiet",placement:"either"},
  {id:"what-are-we-making",text:"What are we making today?",tone:"playful",placement:"opening"},
  {id:"give-me-the-rough-version",text:"Give me the rough version.",tone:"warm",placement:"opening"},
  {id:"what-would-help",text:"What would help right now?",tone:"warm",placement:"either"},
  {id:"pick-up-the-thread",text:"Shall we pick up the thread?",tone:"warm",placement:"returning"},
  {id:"where-were-we",text:"Where were we?",tone:"playful",placement:"returning"},
  {id:"what-changed",text:"What changed since last time?",tone:"quiet",placement:"returning"},
  {id:"ready-when-you-are",text:"Ready when you are.",tone:"quiet",placement:"either"},
  {id:"take-your-time",text:"Take your time.",tone:"quiet",placement:"either"},
  {id:"try-a-first-line",text:"Try a first line.",tone:"playful",placement:"opening"},
  {id:"what-is-the-shape-of-it",text:"What’s the shape of it?",tone:"playful",placement:"either"},
  {id:"what-deserves-attention",text:"What deserves your attention?",tone:"quiet",placement:"either"},
  {id:"tell-me-what-you-have",text:"Tell me what you have so far.",tone:"warm",placement:"returning"},
  {id:"lets-see-where-this-goes",text:"Let’s see where this goes.",tone:"playful",placement:"either"},
] as const satisfies readonly WelcomePhrase[];

export type DefaultWelcomePhraseId = (typeof DEFAULT_WELCOME_PHRASES)[number]["id"];
