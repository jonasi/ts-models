import * as runtime from "@jonasi/ts-models";
type GenericT<T, U> = {
    valueT: T;
    valueU: U;
};
export function checkGenericT<T, U>(checkT: runtime.Check<T>, checkU: runtime.Check<U>): runtime.Check<GenericT<T, U>> {
    return runtime.checkShapeOf({
        valueT: checkT,
        valueU: checkU
    });
}
export function toGenericT<T, U>(checkT: runtime.Check<T>, checkU: runtime.Check<U>): (js: runtime.JSONValue) => GenericT<T, U> {
    const check = checkGenericT(checkT, checkU);
    return function (js: runtime.JSONValue): GenericT<T, U> {
        return runtime.assert(js, check);
    };
}
export function toGenericTArr<T, U>(checkT: runtime.Check<T>, checkU: runtime.Check<U>): (js: runtime.JSONValue) => Array<GenericT<T, U>> {
    const check = checkGenericT(checkT, checkU);
    return function (js: runtime.JSONValue): Array<GenericT<T, U>> {
        return runtime.assert(js, runtime.checkArrayOf(check));
    };
}
