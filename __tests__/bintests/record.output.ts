import * as runtime from "@jonasi/ts-models";
type RecordT = {
    rec: Record<string, number>;
};
const checkRecordT: runtime.Check<RecordT> = runtime.checkShapeOf({
    rec: runtime.checkRecordOf(runtime.checkNumber)
})
export function toRecordT(js: runtime.JSONValue): RecordT {
    return runtime.assert(js, checkRecordT);
}
export function toRecordTArr(js: runtime.JSONValue): Array<RecordT> {
    return runtime.assert(js, runtime.checkArrayOf(checkRecordT));
}
