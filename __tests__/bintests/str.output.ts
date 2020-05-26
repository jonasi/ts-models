import * as runtime from "@jonasi/ts-models";
type T = {
    str: string;
};
export function jsonToT(js: runtime.JSONValue): T {
    return runtime.assert(js, runtime.checkShapeOf({
        str: runtime.checkString
    }));
}
