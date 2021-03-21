import * as runtime from "@jonasi/ts-models";
type OptionalT = {
    str?: string;
};
export const checkOptionalT: runtime.Check<OptionalT> = runtime.checkShapeOf({
    str: runtime.checkOr([
        runtime.checkEmpty,
        runtime.checkString
    ])
});
export function toOptionalT(js: runtime.JSONValue): OptionalT {
    return runtime.assert(js, checkOptionalT);
}
export function toOptionalTArr(js: runtime.JSONValue): Array<OptionalT> {
    return runtime.assert(js, runtime.checkArrayOf(checkOptionalT));
}
