import * as runtime from "@jonasi/ts-models";
type T = {
    subobj: {
        str: string;
    };
};
export function jsonToT(js: runtime.JSONValue): T {
    return runtime.assert(js, runtime.checkShapeOf({
        subobj: runtime.checkShapeOf({
            str: runtime.checkString
        })
    }));
}
