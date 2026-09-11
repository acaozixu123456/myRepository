from pathlib import Path
p=Path('public/app-entry.js');s=p.read_text()
needle='  window.location.replace(`/companion.html${url.search}`);'
replacement="  document.documentElement.dataset.appEntry = 'companion';\n"+needle
assert s.count(needle)==1
if replacement not in s:p.write_text(s.replace(needle,replacement))
p=Path('src/main.tsx');s=p.read_text()
guard="if (document.documentElement.dataset.appEntry !== 'companion') {"
if guard not in s:
 assert s.count('let recoveryOK = true;')==1
 p.write_text(s.replace('let recoveryOK = true;',guard+'\nlet recoveryOK = true;',1)+'\n}\n')
p=Path('src/appEntry.test.ts');s=p.read_text()
s=s.replace("document={title:''};","document={title:'',documentElement:{dataset:{}}};")
p.write_text(s)
