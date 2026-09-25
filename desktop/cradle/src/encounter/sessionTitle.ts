/** Titles are human-authored labels. Native refs remain locators, never titles. */
export function readableSessionTitle(title?:string|null,project?:string|null):string {
 const value=title?.trim();
 if(value&&!/^(?:agent-session|session-space|session|encounter)[/:]/i.test(value)&&!/^\S+:\/\//.test(value)&&!/^\S+-chat-\d{8,}/.test(value))return value;
 return project?.trim()?`${project.trim()} conversation`:"Conversation";
}
