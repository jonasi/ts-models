import * as runtime from "@jonasi/ts-models";
type StringT = {
    str: string;
};
export const checkStringT: runtime.Check<StringT> = runtime.checkShapeOf({
    str: runtime.checkString
});
export function toStringT(js: runtime.JSONValue): StringT {
    return runtime.assert(js, checkStringT);
}
export function toStringTArr(js: runtime.JSONValue): Array<StringT> {
    return runtime.assert(js, runtime.checkArrayOf(checkStringT));
}
