import * as runtime from "@jonasi/ts-models";
type IntersectionT = {
    str: string;
} & {
    num: number;
};
export const checkIntersectionT: runtime.Check<IntersectionT> = runtime.checkAnd([
    runtime.checkShapeOf({
        str: runtime.checkString
    }),
    runtime.checkShapeOf({
        num: runtime.checkNumber
    })
]);
export function toIntersectionT(js: runtime.JSONValue): IntersectionT {
    return runtime.assert(js, checkIntersectionT);
}
export function toIntersectionTArr(js: runtime.JSONValue): Array<IntersectionT> {
    return runtime.assert(js, runtime.checkArrayOf(checkIntersectionT));
}
