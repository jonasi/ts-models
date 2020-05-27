import { assert, checkShapeOf, checkString, checkNumber, JSONValue, Check, checkDate } from '../src/index';

const valueTests: { type: string, it: string, input: JSONValue | undefined, check: Check<unknown>, output?: unknown, error?: boolean }[] = [
    { type: 'string', it: 'should pass through', check: checkString, input: 'str', output: 'str' },
    { type: 'string', it: 'should default to empty string (undefined)', check: checkString, input: void 0, output: '' },
    { type: 'string', it: 'should default to empty string (null)', check: checkString, input: null, output: '' },
    { type: 'string', it: 'should throw on non-string', check: checkString, input: false, error: true },
    { type: 'number', it: 'should pass through', check: checkNumber, input: 4, output: 4 },
    { type: 'number', it: 'should throw on non-number', check: checkNumber, input: '4', error: true },
    { type: 'date', it: 'should handle numbers', check: checkDate, input: 1590541512706, output: new Date(1590541512706) },
    { type: 'date', it: 'should handle strings', check: checkDate, input: 'Tue May 26 2020 20:05:12 GMT-0500', output: new Date('Tue May 26 2020 20:05:12 GMT-0500') },
    { type: 'date', it: 'should throw on non-numbers or non-strings', check: checkDate, input: {}, error: true },
];

valueTests.forEach(t => {
    describe(t.type, () => {
        it(t.it, () => {
            if (t.error) {
                expect(() => assert(t.input, t.check)).toThrow();
            } else {
                expect(assert(t.input, t.check)).toEqual(t.output);
            }
        });
    });
});

describe('shape', () => {
    it('should only include listed properties', () => {
        expect(assert({ a: 'string', b: 'string' }, checkShapeOf({
            a: checkString,
        }))).toEqual({ a: 'string' });
    });
});
