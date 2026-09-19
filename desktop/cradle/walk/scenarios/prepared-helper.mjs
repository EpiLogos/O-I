/** Prepared-context walk helpers (owner direction 2026-09-19): the large
 * context-selection modal is gone from the ordinary path. A selection stages
 * directly; the prepared item lives in the right region's Context plane, and
 * the delivery acts are explicit controls on the item. */
export async function openContextPlane(page){
  const toggle=page.getByRole("button",{name:"Toggle agents and context region"});
  if(await toggle.getAttribute("aria-expanded")!=="true")await toggle.click();
  await page.locator(".agent-planes").getByRole("button",{name:"Context",exact:true}).click();
  return page.locator("[data-prepared-host]");
}
export function preparedItem(page,index=0){
  return page.locator("[data-prepared-id]").nth(index);
}
/** Open the item's secondary-destination menu (idempotent across repeats). */
export async function openItemMenu(page,index=0){
  const item=preparedItem(page,index);
  const menu=item.locator(".prepared-more");
  if(await menu.getAttribute("open")===null)await menu.locator("summary").click();
  return item;
}
export async function itemMenuAction(page,action,index=0){
  const item=await openItemMenu(page,index);
  await item.getByRole("button",{name:action,exact:true}).click();
}
/** Choose a conversation as the right region's accompanying agent. */
export async function chooseAccompanying(page,title){
  const toggle=page.getByRole("button",{name:"Toggle agents and context region"});
  if(await toggle.getAttribute("aria-expanded")!=="true")await toggle.click();
  await page.locator(".agent-layer").getByRole("button",{name:title,exact:true}).first().click();
}
