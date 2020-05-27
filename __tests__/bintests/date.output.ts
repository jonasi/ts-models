import * as runtime from "@jonasi/ts-models";
type DateT = {
    d: Date;
};
const check_DateT: runtime.Check<DateT> = runtime.checkShapeOf({
    d: runtime.checkDate
})
export function jsonToDateT(js: runtime.JSONValue): DateT {
    return runtime.assert(js, check_DateT);
}
export function jsonToDateTArr(js: runtime.JSONValue): Array<DateT> {
    return runtime.assert(js, runtime.checkArrayOf(check_DateT));
}
