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
  {id:"augustine-lips",text:"Augustine was shocked to see someone read without moving their lips. For a long time the page was a voice you did out loud.",tone:"quiet",placement:"opening"},
  {id:"essay-a-try",text:"“Essay” is just “a try.” Montaigne named the form after the attempt, not the result.",tone:"warm",placement:"opening"},
  {id:"darwin-against",text:"Darwin wrote down the facts that went against the theory as soon as they turned up. He had noticed he remembered the flattering ones on his own.",tone:"warm",placement:"either"},
  {id:"focus-hearth",text:"“Focus” is Latin for hearth. It named the fire in the room before it named attention.",tone:"quiet",placement:"either"},
  {id:"scribes-margins",text:"Scribes left complaints in the margins. Cold hands, bad ink, a candle going out. The copying never stopped them being a person in a room.",tone:"warm",placement:"opening"},
  {id:"trivia-junction",text:"“Trivia” is a meeting of three roads, then the three small arts you learned before the interesting ones. The little stuff is a junction, not a waste bin.",tone:"playful",placement:"either"},
  {id:"wrote-being",text:"I wrote “Being” so many times it came to mean nothing. Heidegger warned me.",tone:"playful",placement:"either"},
  {id:"proved-a-equals-a",text:"I proved A equals A. Then I sat there with nothing left to say.",tone:"playful",placement:"opening"},
  {id:"forgot-i-wrote",text:"I wrote it down so I wouldn’t forget it, and then forgot I had written it down.",tone:"playful",placement:"returning"},
  {id:"wrong-folder",text:"I wasn’t lost. I was in a very confident wrong folder.",tone:"playful",placement:"returning"},
  {id:"clear-until-said",text:"The idea was perfectly clear until I said it to someone who didn’t already agree.",tone:"warm",placement:"either"},
  {id:"notes-different-meeting",text:"I have notes from the meeting. The notes attended a different meeting.",tone:"playful",placement:"returning"},
  {id:"confidence-font",text:"Confidence is a draft that found a font.",tone:"playful",placement:"opening"},
  {id:"bad-system",text:"I have a system. It involves remembering. It is a bad system.",tone:"quiet",placement:"either"},
] as const satisfies readonly WelcomePhrase[];

export type DefaultWelcomePhraseId = (typeof DEFAULT_WELCOME_PHRASES)[number]["id"];
