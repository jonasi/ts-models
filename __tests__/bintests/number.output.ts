import * as runtime from "@jonasi/ts-models";
type T = {
    num: number;
};
export function jsonToT(js: runtime.JSONValue): T {
    return runtime.assert(js, runtime.checkShapeOf({
        num: runtime.checkNumber
    }));
}
