import * as runtime from "@jonasi/ts-models";
type VoidT = {
    val: void;
};
export const checkVoidT: runtime.Check<VoidT> = runtime.checkShapeOf({
    val: runtime.checkEmpty
});
export function toVoidT(js: runtime.JSONValue): VoidT {
    return runtime.assert(js, checkVoidT);
}
export function toVoidTArr(js: runtime.JSONValue): Array<VoidT> {
    return runtime.assert(js, runtime.checkArrayOf(checkVoidT));
}
