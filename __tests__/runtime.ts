import { assert, checkShapeOf, checkString, checkNumber, JSONValue, Check, checkDate, checkArray, checkArrayOf, CheckError, checkTupleOf, toLowerSnake } from '../src/index';

const valueTests: { type: string, it: string, input: JSONValue | undefined, check: Check<unknown>, output?: unknown, error?: string }[] = [
    { type: 'string', it: 'should pass through', check: checkString, input: 'str', output: 'str' },
    { type: 'string', it: 'should default to empty string (undefined)', check: checkString, input: void 0, output: '' },
    { type: 'string', it: 'should default to empty string (null)', check: checkString, input: null, output: '' },
    { type: 'string', it: 'should throw on non-string', check: checkString, input: false, error: '' },
    { type: 'number', it: 'should pass through', check: checkNumber, input: 4, output: 4 },
    { type: 'number', it: 'should throw on non-number', check: checkNumber, input: '4', error: '' },
    { type: 'date', it: 'should handle numbers', check: checkDate, input: 1590541512706, output: new Date(1590541512706) },
    { type: 'date', it: 'should handle strings', check: checkDate, input: 'Tue May 26 2020 20:05:12 GMT-0500', output: new Date('Tue May 26 2020 20:05:12 GMT-0500') },
    { type: 'date', it: 'should throw on non-numbers or non-strings', check: checkDate, input: {}, error: '' },
    { type: 'array', it: 'should default to empty array (undefined)', check: checkArray, input: void 0, output: [] },
    { type: 'array', it: 'should default to empty array (null)', check: checkArray, input: null, output: [] },
    { type: 'array', it: 'should handle empty array', check: checkArray, input: [], output: [] },
    { type: 'shapeOf', it: 'should handle empty object', check: checkShapeOf({}), input: {}, output: {} },
    { type: 'shapeOf', it: 'should throw on null', check: checkShapeOf({}), input: null, error: '' },
    { type: 'shapeOf', it: 'should throw on undefined', check: checkShapeOf({}), input: void 0, error: '' },
    { type: 'shapeOf', it: 'should skip extra data', check: checkShapeOf({}), input: { a: 'string' }, output: {} },
    { type: 'shapeOf', it: 'should throw on missing data', check: checkShapeOf({ a: checkNumber }), input: { }, error: '.a' },
    { type: 'shapeOf', it: 'should accept missing data for string', check: checkShapeOf({ a: checkString }), input: { }, output: { a: '' } },
    { type: 'arrayOf', it: 'should handle an empty array', check: checkArrayOf(checkString), input: [], output: [] },
    { type: 'arrayOf', it: 'should default to an empty array (undefined)', check: checkArrayOf(checkString), input: void 0, output: [] },
    { type: 'arrayOf', it: 'should default to an empty array (null)', check: checkArrayOf(checkString), input: null, output: [] },
    { type: 'arrayOf', it: 'should work (strings)', check: checkArrayOf(checkString), input: [ 'str', 'str' ], output: [ 'str', 'str' ] },
    { type: 'arrayOf', it: 'should throw (strings)', check: checkArrayOf(checkString), input: [ 3, 'str' ], error: '[0]' },
    { type: 'tupleOf', it: 'should work string', check: checkTupleOf([ checkString ]), input: [ 'nice' ], output: [ 'nice' ] },
    { type: 'tupleOf', it: 'should throw on length mismatch', check: checkTupleOf([ checkString ]), input: [ 'nice', 'one' ], error: '' },
    { type: 'tupleOf', it: 'should throw on type mismatch', check: checkTupleOf([ checkString ]), input: [ 3 ], error: '[0]' },
    { type: 'propertyMappers', it: 'should map properties', check: checkShapeOf({ obj_id: checkString }, { propertyMapper: toLowerSnake }), input: { ObjID: 'id' }, output: { obj_id: 'id' } },
];

valueTests.forEach(t => {
    describe(t.type, () => {
        it(t.it, () => {
            if (typeof t.error === 'string') {
                let err: Error | undefined;
                try {
                    assert(t.input, t.check);
                } catch(e) { err = e; }

                expect(err).toBeInstanceOf(CheckError);
                expect((err as CheckError).path).toBe(t.error);
            } else {
                expect(assert(t.input, t.check)).toEqual(t.output);
            }
        });
    });
});
