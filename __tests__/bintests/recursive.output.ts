import * as runtime from "@jonasi/ts-models";
type RecursiveT = {
    recurse?: RecursiveT;
};
export const checkRecursiveT: runtime.Check<RecursiveT> = runtime.checkShapeOf({
    recurse: runtime.checkOr([
        runtime.checkEmpty,
        runtime.checkDeferred(() => checkRecursiveT)
    ])
});
export function toRecursiveT(js: runtime.JSONValue): RecursiveT {
    return runtime.assert(js, checkRecursiveT);
}
export function toRecursiveTArr(js: runtime.JSONValue): Array<RecursiveT> {
    return runtime.assert(js, runtime.checkArrayOf(checkRecursiveT));
}
