import * as runtime from "@jonasi/ts-models";
type LiteralT = {
    str: 'string';
    num: 4;
    bool: false;
    null: null;
    undef: undefined;
};
export const checkLiteralT: runtime.Check<LiteralT> = runtime.checkShapeOf({
    str: runtime.checkLiteralOf("string"),
    num: runtime.checkLiteralOf(4),
    bool: runtime.checkLiteralOf(false),
    null: runtime.checkLiteralOf(null),
    undef: runtime.checkEmpty
});
export function toLiteralT(js: runtime.JSONValue): LiteralT {
    return runtime.assert(js, checkLiteralT);
}
export function toLiteralTArr(js: runtime.JSONValue): Array<LiteralT> {
    return runtime.assert(js, runtime.checkArrayOf(checkLiteralT));
}
