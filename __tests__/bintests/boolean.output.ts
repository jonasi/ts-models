import * as runtime from "@jonasi/ts-models";
type T = {
    b: boolean;
};
export function jsonToT(js: runtime.JSONValue): T {
    return runtime.assert(js, runtime.checkShapeOf({
        b: runtime.checkBoolean
    }));
}
