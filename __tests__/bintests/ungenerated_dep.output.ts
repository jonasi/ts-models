import * as runtime from "@jonasi/ts-models";
type GeneratedT = {
    dep: UngeneratedT;
    depArr: UngeneratedT2[];
};
type UngeneratedT = {
    str: string;
};
type UngeneratedT2 = {
    ok: string;
};
export const checkGeneratedT: runtime.Check<GeneratedT> = runtime.checkShapeOf({
    dep: runtime.checkShapeOf({
        str: runtime.checkString
    }),
    depArr: runtime.checkArrayOf(runtime.checkShapeOf({
        ok: runtime.checkString
    }))
});
export function toGeneratedT(js: runtime.JSONValue): GeneratedT {
    return runtime.assert(js, checkGeneratedT);
}
export function toGeneratedTArr(js: runtime.JSONValue): Array<GeneratedT> {
    return runtime.assert(js, runtime.checkArrayOf(checkGeneratedT));
}
