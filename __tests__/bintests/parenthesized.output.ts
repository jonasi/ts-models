import * as runtime from "@jonasi/ts-models";
type ParenthesizedBooleanT = {
    b: (boolean);
};
export const checkParenthesizedBooleanT: runtime.Check<ParenthesizedBooleanT> = runtime.checkShapeOf({
    b: runtime.checkBoolean
});
export function toParenthesizedBooleanT(js: runtime.JSONValue): ParenthesizedBooleanT {
    return runtime.assert(js, checkParenthesizedBooleanT);
}
export function toParenthesizedBooleanTArr(js: runtime.JSONValue): Array<ParenthesizedBooleanT> {
    return runtime.assert(js, runtime.checkArrayOf(checkParenthesizedBooleanT));
}
