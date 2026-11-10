import {oneLineText} from "../shared/plainText";

/** Titles are human-authored labels. Native refs remain locators, never titles. A title is someone's words, shown on one line, plain
 * (shared/plainText.ts oneLineText; be2j ruling 2), so no bidi control reorders the row it names and nothing invisible stands in it. */
export function readableSessionTitle(title?:string|null,project?:string|null):string {
 const value=oneLineText(title??"");
 if(value&&!/^(?:agent-session|session-space|session|encounter)[/:]/i.test(value)&&!/^\S+:\/\//.test(value)&&!/^\S+-chat-\d{8,}/.test(value))return value;
 const place=oneLineText(project??"");
 return place?`${place} conversation`:"Conversation";
}
