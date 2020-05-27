import * as runtime from "@jonasi/ts-models";
type UnionT = {
    str: string;
} | {
    num: number;
};
const check_UnionT: runtime.Check<UnionT> = runtime.checkOr([
    runtime.checkShapeOf({
        str: runtime.checkString
    }),
    runtime.checkShapeOf({
        num: runtime.checkNumber
    })
])
export function jsonToUnionT(js: runtime.JSONValue): UnionT {
    return runtime.assert(js, check_UnionT);
}
export function jsonToUnionTArr(js: runtime.JSONValue): Array<UnionT> {
    return runtime.assert(js, runtime.checkArrayOf(check_UnionT));
}
