import {afterEach,it,expect,vi} from 'vitest';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,pathToFileURL} from './node-test-path-placeholder';
