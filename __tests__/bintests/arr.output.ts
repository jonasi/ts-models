import * as runtime from "@jonasi/ts-models";
type ArrT = {
    arr: string[];
};
const checkArrT: runtime.Check<ArrT> = runtime.checkShapeOf({
    arr: runtime.checkArrayOf(runtime.checkString)
})
export function toArrT(js: runtime.JSONValue): ArrT {
    return runtime.assert(js, checkArrT);
}
export function toArrTArr(js: runtime.JSONValue): Array<ArrT> {
    return runtime.assert(js, runtime.checkArrayOf(checkArrT));
}
