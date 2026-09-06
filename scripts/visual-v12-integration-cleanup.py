from pathlib import Path
p=Path('src/explore/world.ts')
s=p.read_text()
# A prior CI retry applied the bookkeeping insertion twice. Collapse it to one canonical AbstractMesh-safe version.
duplicate="""  const heroProxyMeshes=shopRoot?shopRoot.getChildMeshes(false):[];
  const belongsToReceipt=(mesh:Mesh)=>{let node:any=mesh.parent;while(node){if(node===receiptBag)return true;node=node.parent;}return false;};
  const heroProxyMeshes=shopRoot?shopRoot.getChildMeshes(false):[];
  const belongsToReceipt=(mesh:any)=>{let node:any=mesh.parent;while(node){if(node===receiptBag)return true;node=node.parent;}return false;};
"""
canonical="""  const heroProxyMeshes=shopRoot?shopRoot.getChildMeshes(false):[];
  const belongsToReceipt=(mesh:any)=>{let node:any=mesh.parent;while(node){if(node===receiptBag)return true;node=node.parent;}return false;};
"""
if duplicate in s:s=s.replace(duplicate,canonical)
s=s.replace("const belongsToReceipt=(mesh:Mesh)=>","const belongsToReceipt=(mesh:any)=>")
s=s.replace("m=>Boolean(m.metadata?.blocker)&&m.isVisible","m=>Boolean(m.metadata?.blocker)")
assert s.count("const heroProxyMeshes=shopRoot?shopRoot.getChildMeshes(false):[];")==1
assert s.count("const belongsToReceipt=")==1
p.write_text(s)
