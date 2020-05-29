import * as runtime from "@jonasi/ts-models";
type BooleanT = {
    b: boolean;
};
const checkBooleanT: runtime.Check<BooleanT> = runtime.checkShapeOf({
    b: runtime.checkBoolean
})
export function toBooleanT(js: runtime.JSONValue): BooleanT {
    return runtime.assert(js, checkBooleanT);
}
export function toBooleanTArr(js: runtime.JSONValue): Array<BooleanT> {
    return runtime.assert(js, runtime.checkArrayOf(checkBooleanT));
}
