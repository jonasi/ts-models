import * as runtime from "@jonasi/ts-models";
type MapperT = {
    str: string;
    sub: SubMapperT;
};
type SubMapperT = {
    str: string;
};
const checkMapperT: runtime.Check<MapperT> = runtime.checkShapeOf({
    str: runtime.checkString,
    sub: runtime.checkShapeOf({
        str: runtime.checkString
    }, {
        propertyMapper: runtime.toLower
    })
}, {
    propertyMapper: runtime.toLower
})
export function toMapperT(js: runtime.JSONValue): MapperT {
    return runtime.assert(js, checkMapperT);
}
export function toMapperTArr(js: runtime.JSONValue): Array<MapperT> {
    return runtime.assert(js, runtime.checkArrayOf(checkMapperT));
}
