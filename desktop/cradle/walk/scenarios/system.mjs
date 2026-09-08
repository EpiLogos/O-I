export {setup} from './editor.mjs';
export default async function run({page,baseUrl,check,shot,channel}) {
 await page.goto(baseUrl);await channel('info');
 await page.getByRole('button',{name:'System',exact:true}).click();
 const panel=page.getByRole('region',{name:'System composition'});
 await panel.locator(':scope > details').first().waitFor();
 // Sections render immediately with an honest not-disclosed placeholder;
 // wait for the native read before asserting census facts.
 await panel.locator(':scope > details > summary > span').filter({hasText:'discovered'}).first().waitFor({timeout:30000});
 check(await panel.locator(':scope > details > summary > strong').count()===7,'System projects all seven positions (O:I + six native products)');
 check(await panel.locator(':scope > details > summary > span').filter({hasText:'discovered'}).count()===6,'Registered products are discovered, not invented runtime-ready');
 const focus=JSON.stringify((await channel('read.focus')).data);
 await panel.getByRole('button',{name:'Read owner capabilities',exact:true}).click();
 await panel.getByText('Owner capabilities and effective context',{exact:true}).waitFor({timeout:60000});
 check((await panel.locator('pre').last().innerText()).includes('oi.owner-disclosure/v1'),'Native owner capability aggregate reaches System');
 check(JSON.stringify((await channel('read.focus')).data)===focus,'Inspecting System never reassigns semantic focus');
 await shot('native-six-owner-composition');
}
