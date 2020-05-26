import { generateModels } from '../src/bin/parse';
import * as fs from 'fs';
import * as path from 'path';

type A = {
    x: string;
};

const bintestre = /\.(input|output)\.ts$/;

describe('model generation', () => {
    const testDir = path.join(__dirname, 'bintests');
    const files = fs.readdirSync(testDir)
        .filter(f => !f.startsWith('.'))
        .map(f => bintestre.test(f) ? f.replace(bintestre, '') : void 0)
        .filter((f, idx, arr) => f && arr.indexOf(f) === idx) as string[];

    files.forEach((f: string) => {
        test(f, () => {
            const input = path.join(testDir, f + '.input.ts');
            const expected = fs.readFileSync(path.join(testDir, f + '.output.ts'), 'utf8');

            const actual = generateModels(input);

            expect(actual).toEqual(expected);
        });
    });
});

