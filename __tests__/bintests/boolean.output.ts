import * as runtime from "@jonasi/ts-models";
type T = {
    b: boolean;
};
const checkT: runtime.Check<T> = runtime.checkShapeOf({
    b: runtime.checkBoolean
})
export function toT(js: runtime.JSONValue): T {
    return runtime.assert(js, checkT);
}
export function toTArr(js: runtime.JSONValue): Array<T> {
    return runtime.assert(js, runtime.checkArrayOf(checkT));
}
