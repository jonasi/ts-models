import * as runtime from "@jonasi/ts-models";
type T = {
    b: boolean;
};
const check_T: runtime.Check<T> = runtime.checkShapeOf({
    b: runtime.checkBoolean
})
export function jsonToT(js: runtime.JSONValue): T {
    return runtime.assert(js, check_T);
}
export function jsonToTArr(js: runtime.JSONValue): Array<T> {
    return runtime.assert(js, runtime.checkArrayOf(check_T));
}
