from pathlib import Path
p=Path('scripts/desktop04/browser.mjs');s=p.read_text()
old="await page.getByRole('button',{name:'关闭',exact:true}).filter({hasNot:page.locator('.df-atmosphere-controls')}).last().click().catch(async()=>{await page.locator('dialog[open] .kc-close').click();});"
new="await page.locator('dialog[open] .kc-close').click();"
if old in s:s=s.replace(old,new)
else:assert new in s
if 'let lastPage;' not in s:
 s=s.replace('let browser;','let browser;let lastPage;')
 s=s.replace('const page=await context.newPage();page.setDefaultTimeout(20000);','const page=await context.newPage();lastPage=page;page.setDefaultTimeout(20000);')
 s=s.replace("}catch(e){report.failure=String(e.stack||e);process.exitCode=1;}","}catch(e){report.failure=String(e.stack||e);if(lastPage&&!lastPage.isClosed()){await lastPage.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});report.failureLayout=await lastPage.evaluate(()=>({url:location.pathname,text:document.body.innerText.slice(-9000),overflow:document.documentElement.scrollWidth-innerWidth})).catch(()=>null);}process.exitCode=1;}")
 # Thumbnails are resized real screenshots, never reconstructed or model-generated UI.
 needle="  await page.screenshot({path:`${out}/${engine}-${viewport.width}-review.jpg`,type:'jpeg',quality:40,fullPage:true});"
 assert s.count(needle)==1
 s=s.replace(needle,needle+"\n  const captured=await page.screenshot({type:'jpeg',quality:60,fullPage:true});\n  const thumbnail=await page.evaluate(async data=>{const image=new Image();image.src=data;await image.decode();const c=document.createElement('canvas');c.width=720;c.height=Math.round(image.naturalHeight*720/image.naturalWidth);c.getContext('2d').drawImage(image,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.38).split(',')[1];},'data:image/jpeg;base64,'+captured.toString('base64'));\n  await writeFile(`${out}/${engine}-${viewport.width}-review.b64`,thumbnail.match(/.{1,100}/g).join('\\n'));" )
p.write_text(s)
print('Browser checks retain all assertions; dialog targeting and failure evidence improved.')
