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
 const focus=JSON.stringify((await channel('read.focus')).data);
 // The Wave 5 native mount (`oi.product-settings-disclosure/v2` per owner)
 // reads independently of the census and replaces a position's section
 // with its own axes the moment a descriptor is mounted.
 await panel.locator(':scope > details.native-product-section, :scope > details.product-section').first().waitFor({timeout:30000});
 check(JSON.stringify((await channel('read.focus')).data)===focus,'Inspecting System never reassigns semantic focus');
 await shot('native-six-owner-composition');
}
