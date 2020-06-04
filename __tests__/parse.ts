import { generateModels } from '../src/bin/parse';
import * as fs from 'fs';
import * as path from 'path';

describe('model generation', () => {
    const testDir = path.join(__dirname, 'bintests');
    const files = fs.readdirSync(testDir)
        .filter(f => !f.startsWith('.'))
        .map(f => f.endsWith('.input.ts') ? f.substr(0, f.length - 9) : void 0)
        .filter((f, idx, arr) => f && arr.indexOf(f) === idx) as string[];

    files.forEach((f: string) => {
        test(f, () => {
            const input = path.join(testDir, f + '.input.ts');
            let expected: string | undefined;
            let error: string | undefined;

            try {
                expected = fs.readFileSync(path.join(testDir, f + '.output.ts'), 'utf8');
            } catch(_err) { }
            try {
                error = fs.readFileSync(path.join(testDir, f + '.error.txt'), 'utf8').trim();
            } catch(_err) { }

            if (typeof expected === 'string') {
                const actual = generateModels(input);
                expect(actual).toEqual(expected);
            } else if (typeof error === 'string') {
                expect(() => generateModels(input)).toThrowError(error);
            } else {
                throw new Error("Could not find output or error file for test: " + input);
            }
        });
    });
});

