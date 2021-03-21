import * as runtime from "@jonasi/ts-models";
type GeneratedT2 = {
    dep: UngeneratedT3;
    depArr: GeneratedT3[];
};
type UngeneratedT3 = {
    ok: string;
};
type GeneratedT3 = {
    str: string;
};
export const checkGeneratedT2: runtime.Check<GeneratedT2> = runtime.checkShapeOf({
    dep: runtime.checkShapeOf({
        ok: runtime.checkString
    }),
    depArr: runtime.checkArrayOf(runtime.checkShapeOf({
        str: runtime.checkString
    }))
});
export function toGeneratedT2(js: runtime.JSONValue): GeneratedT2 {
    return runtime.assert(js, checkGeneratedT2);
}
export function toGeneratedT2Arr(js: runtime.JSONValue): Array<GeneratedT2> {
    return runtime.assert(js, runtime.checkArrayOf(checkGeneratedT2));
}
type GeneratedT3 = {
    str: string;
};
export const checkGeneratedT3: runtime.Check<GeneratedT3> = runtime.checkShapeOf({
    str: runtime.checkString
});
export function toGeneratedT3(js: runtime.JSONValue): GeneratedT3 {
    return runtime.assert(js, checkGeneratedT3);
}
export function toGeneratedT3Arr(js: runtime.JSONValue): Array<GeneratedT3> {
    return runtime.assert(js, runtime.checkArrayOf(checkGeneratedT3));
}
