import * as runtime from "@jonasi/ts-models";
type T = {
    arr: string[];
};
export function jsonToT(js: runtime.JSONValue): T {
    return runtime.assert(js, runtime.checkShapeOf({
        arr: runtime.checkArrayOf(runtime.checkString)
    }));
}
