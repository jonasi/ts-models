import * as runtime from "@jonasi/ts-models";
type DateT = {
    d: Date;
};
export const checkDateT: runtime.Check<DateT> = runtime.checkShapeOf({
    d: runtime.checkDate
});
export function toDateT(js: runtime.JSONValue): DateT {
    return runtime.assert(js, checkDateT);
}
export function toDateTArr(js: runtime.JSONValue): Array<DateT> {
    return runtime.assert(js, runtime.checkArrayOf(checkDateT));
}
