import * as runtime from "@jonasi/ts-models";
type UnknownT = {
    val: unknown;
};
export const checkUnknownT: runtime.Check<UnknownT> = runtime.checkShapeOf({
    val: runtime.checkUnknown
});
export function toUnknownT(js: runtime.JSONValue): UnknownT {
    return runtime.assert(js, checkUnknownT);
}
export function toUnknownTArr(js: runtime.JSONValue): Array<UnknownT> {
    return runtime.assert(js, runtime.checkArrayOf(checkUnknownT));
}
