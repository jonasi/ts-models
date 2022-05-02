import * as runtime from "@jonasi/ts-models";
enum EnumT {
    One,
    Two
}
export const checkEnumT: runtime.Check<EnumT> = runtime.checkOr([
    runtime.checkLiteralOf(EnumT.One),
    runtime.checkLiteralOf(EnumT.Two)
]);
export function toEnumT(js: runtime.JSONValue): EnumT {
    return runtime.assert(js, checkEnumT);
}
export function toEnumTArr(js: runtime.JSONValue): Array<EnumT> {
    return runtime.assert(js, runtime.checkArrayOf(checkEnumT));
}
