import * as runtime from "@jonasi/ts-models";
type NumberT = {
    num: number;
};
const checkNumberT: runtime.Check<NumberT> = runtime.checkShapeOf({
    num: runtime.checkNumber
})
export function toNumberT(js: runtime.JSONValue): NumberT {
    return runtime.assert(js, checkNumberT);
}
export function toNumberTArr(js: runtime.JSONValue): Array<NumberT> {
    return runtime.assert(js, runtime.checkArrayOf(checkNumberT));
}
