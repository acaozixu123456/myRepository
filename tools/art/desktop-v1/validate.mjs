// Requires the official npm gltf-validator package, installed outside the repository.
import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const validator=await import(process.env.GLTF_VALIDATOR_MODULE||'gltf-validator');
for(const name of ['shop','keeper']){const file=path.join(root,`public/explore/assets/desktop-v1/yorimichi-${name}.glb`);const b=await fs.readFile(file);const r=await validator.validateBytes(new Uint8Array(b),{uri:path.basename(file),maxIssues:200});await fs.writeFile(path.join(root,`docs/art/desktop-v1/evidence/${name}-gltf-validation.json`),JSON.stringify(r,null,2)+'\n');console.log(name,{errors:r.issues.numErrors,warnings:r.issues.numWarnings,infos:r.issues.numInfos});if(r.issues.numErrors)process.exitCode=1;}
