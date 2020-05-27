import * as runtime from "@jonasi/ts-models";
type IntersectionT = {
    str: string;
} & {
    num: number;
};
const check_IntersectionT: runtime.Check<IntersectionT> = runtime.checkAnd([
    runtime.checkShapeOf({
        str: runtime.checkString
    }),
    runtime.checkShapeOf({
        num: runtime.checkNumber
    })
])
export function jsonToIntersectionT(js: runtime.JSONValue): IntersectionT {
    return runtime.assert(js, check_IntersectionT);
}
export function jsonToIntersectionTArr(js: runtime.JSONValue): Array<IntersectionT> {
    return runtime.assert(js, runtime.checkArrayOf(check_IntersectionT));
}
