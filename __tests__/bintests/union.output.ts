import * as runtime from "@jonasi/ts-models";
type UnionT = {
    str: string;
} | {
    num: number;
};
export const checkUnionT: runtime.Check<UnionT> = runtime.checkOr([
    runtime.checkShapeOf({
        str: runtime.checkString
    }),
    runtime.checkShapeOf({
        num: runtime.checkNumber
    })
]);
export function toUnionT(js: runtime.JSONValue): UnionT {
    return runtime.assert(js, checkUnionT);
}
export function toUnionTArr(js: runtime.JSONValue): Array<UnionT> {
    return runtime.assert(js, runtime.checkArrayOf(checkUnionT));
}
