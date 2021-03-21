import * as runtime from "@jonasi/ts-models";
type ShapeT = {
    subobj: {
        str: string;
    };
};
export const checkShapeT: runtime.Check<ShapeT> = runtime.checkShapeOf({
    subobj: runtime.checkShapeOf({
        str: runtime.checkString
    })
});
export function toShapeT(js: runtime.JSONValue): ShapeT {
    return runtime.assert(js, checkShapeT);
}
export function toShapeTArr(js: runtime.JSONValue): Array<ShapeT> {
    return runtime.assert(js, runtime.checkArrayOf(checkShapeT));
}
