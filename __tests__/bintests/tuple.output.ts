import * as runtime from "@jonasi/ts-models";
type TupleT = {
    tuple: [string, number, boolean];
};
export const checkTupleT: runtime.Check<TupleT> = runtime.checkShapeOf({
    tuple: runtime.checkTupleOf([
        runtime.checkString,
        runtime.checkNumber,
        runtime.checkBoolean
    ])
});
export function toTupleT(js: runtime.JSONValue): TupleT {
    return runtime.assert(js, checkTupleT);
}
export function toTupleTArr(js: runtime.JSONValue): Array<TupleT> {
    return runtime.assert(js, runtime.checkArrayOf(checkTupleT));
}
