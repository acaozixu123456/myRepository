from pathlib import Path
import subprocess
p=Path('src/immersion/immersion.css');s=p.read_text()
if 'A fr track must be allowed' not in s:
 s+='''\n/* A fr track must be allowed to shrink below intrinsic label widths on narrow phones. */
@media(max-width:600px){.kc-root[data-immersion-release] .kc-shell{width:100%;min-width:0;max-width:100%;grid-template-columns:minmax(0,1fr)!important}.kc-root[data-immersion-release] .kc-header{gap:8px;padding-left:14px;padding-right:14px;box-sizing:border-box;min-width:0}.kc-root[data-immersion-release] .kc-brand{min-width:0;flex-shrink:1}.kc-root[data-immersion-release] .kc-brand>span{font-size:18px}.kc-root[data-immersion-release] .kc-brand small{font-size:7px;letter-spacing:.08em}.imm-edition{font-size:8px;line-height:1.4;max-width:86px;white-space:normal}.imm-header-scene{font-size:10px;padding:7px;flex-shrink:0}.kc-root[data-immersion-release] .kc-home,.kc-root[data-immersion-release] .kc-conversation,.kc-root[data-immersion-release] .kc-chat-bottom{min-width:0;max-width:100%;box-sizing:border-box}.kc-root[data-immersion-release] .kc-chat-heading{min-width:0;flex:1}.imm-study-sheet .imm-study-inner{min-width:0}.imm-study-inner h2,.imm-study-inner p,.imm-study-inner small{overflow-wrap:anywhere}}
'''
 p.write_text(s)
p=Path('scripts/hitokoto-neon-phone.mjs');s=subprocess.check_output(['git','show','93fdda50cf86b1f72068056adc04614301a95189:scripts/hitokoto-neon-phone.mjs']).decode()
marker=" await page.getByRole('button',{name:'聊一会儿'}).click();`);"
assert marker in s
s=s.replace(marker," await page.getByRole('button',{name:'聊一会儿'}).click();\n if(await page.getByRole('button',{name:'对话与历史',exact:true}).count())await page.getByRole('button',{name:'对话与历史',exact:true}).click();`);",1)
p.write_text(s)
for name in ['scripts/hitokoto-neon-phone.mjs','scripts/teacher-v2-phone.mjs','scripts/companion-phone.mjs','scripts/immersion/browser.mjs']:
 subprocess.run(['node','--check',name],check=True)
