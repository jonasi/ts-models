import { argv } from 'process';
import { resolve } from 'path';
import { generateModels } from './parse';

const root = resolve(argv[2]);
const out = generateModels(root);
process.stdout.write(out);
