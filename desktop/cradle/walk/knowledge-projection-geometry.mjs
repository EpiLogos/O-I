/** Read pixels from the actual browser-rendered field, not a substituted
 * renderer. The detached 2D canvas only decodes the screenshot for bounds. */
export async function renderedBounds(page,host){
  const png=(await host.screenshot()).toString('base64');
  return page.evaluate(async png=>{
    const image=new Image();image.src=`data:image/png;base64,${png}`;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const context=canvas.getContext('2d');context.drawImage(image,0,0);const {data}=context.getImageData(0,0,canvas.width,canvas.height);
    const corner=(5*canvas.width+5)*4,background=data.slice(corner,corner+3);
    const luminance=rgb=>{const channels=Array.from(rgb).map(value=>{const c=value/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;};
    const backgroundLuminance=luminance(background);
    let minX=canvas.width,minY=canvas.height,maxX=-1,maxY=-1,count=0,lightInkPixels=0,darkInkPixels=0,maxContrast=1;
    for(let y=3;y<canvas.height-3;y++)for(let x=3;x<canvas.width-3;x++){
      const i=(y*canvas.width+x)*4;
      if(Math.max(Math.abs(data[i]-background[0]),Math.abs(data[i+1]-background[1]),Math.abs(data[i+2]-background[2]))<35)continue;
      minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);count++;
      const inkLuminance=luminance(data.subarray(i,i+3)),contrast=(Math.max(inkLuminance,backgroundLuminance)+.05)/(Math.min(inkLuminance,backgroundLuminance)+.05);
      maxContrast=Math.max(maxContrast,contrast);
      if(contrast>=3){if(inkLuminance>backgroundLuminance)lightInkPixels++;else darkInkPixels++;}
    }
    return {width:canvas.width,height:canvas.height,minX,minY,maxX,maxY,count,background:Array.from(background),lightInkPixels,darkInkPixels,maxContrast};
  },png);
}
