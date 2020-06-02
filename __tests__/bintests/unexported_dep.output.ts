import * as runtime from "@jonasi/ts-models";
type ExportedT = {
    dep: UnexportedT;
    depArr: UnexportedT2[];
};
type UnexportedT = {
    str: string;
};
type UnexportedT2 = {
    ok: string;
};
const checkExportedT: runtime.Check<ExportedT> = runtime.checkShapeOf({
    dep: runtime.checkShapeOf({
        str: runtime.checkString
    }),
    depArr: runtime.checkArrayOf(runtime.checkShapeOf({
        ok: runtime.checkString
    }))
})
export function toExportedT(js: runtime.JSONValue): ExportedT {
    return runtime.assert(js, checkExportedT);
}
export function toExportedTArr(js: runtime.JSONValue): Array<ExportedT> {
    return runtime.assert(js, runtime.checkArrayOf(checkExportedT));
}
