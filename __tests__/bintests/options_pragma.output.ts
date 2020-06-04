import * as runtime from "@jonasi/ts-models";
type OptionsPragmaT = {
    sub: SubOptionsPragmaT;
};
type SubOptionsPragmaT = {
    str: string;
};
const checkOptionsPragmaT: runtime.Check<OptionsPragmaT> = runtime.checkShapeOf({
    sub: runtime.checkShapeOf({
        str: runtime.checkString
    }, {
        propertyMapper: runtime.toLower
    })
})
export function toOptionsPragmaT(js: runtime.JSONValue): OptionsPragmaT {
    return runtime.assert(js, checkOptionsPragmaT);
}
export function toOptionsPragmaTArr(js: runtime.JSONValue): Array<OptionsPragmaT> {
    return runtime.assert(js, runtime.checkArrayOf(checkOptionsPragmaT));
}
