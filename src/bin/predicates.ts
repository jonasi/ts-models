import * as ts from 'typescript';
import { Context } from './context';

export function isUnknown(t: ts.Type): boolean {
    return !!(t.flags & ts.TypeFlags.Unknown);
}

export function isBoolean(t: ts.Type): boolean {
    return !!(t.flags & ts.TypeFlags.Boolean);
}

export function isString(t: ts.Type): boolean {
    return !!(t.flags & ts.TypeFlags.String);
}

export function isNumber(t: ts.Type): boolean {
    return !!(t.flags & ts.TypeFlags.Number);
}

export function isUndefined(t: ts.Type): boolean {
    return !!(t.flags & ts.TypeFlags.Undefined) || !!(t.flags & ts.TypeFlags.Void);
}

export function isArray(t: ts.Type, node: ts.Node): node is ts.ArrayTypeNode {
    return !!node && ts.isArrayTypeNode(node);
}

export function isTuple(t: ts.Type, node: ts.Node): node is ts.TupleTypeNode {
    return isTypeReference(t) && !!node && ts.isTupleTypeNode(node);
}

export function isRecord(ctx: Context, t: ts.Type): boolean {
    return !!t.aliasSymbol && t.aliasSymbol === ctx.globals.Record.aliasSymbol;
}

export function isDate(ctx: Context, t: ts.Type): boolean {
    return t === ctx.globals.Date;
}

export function isObject(t: ts.Type): t is ts.ObjectType {
    return !!(t.flags & ts.TypeFlags.Object);
}

export function isEnum(t: ts.Type): t is ts.EnumType {
    return !!(t.flags & ts.TypeFlags.EnumLike);
}


export function isLiteral(ch: ts.TypeChecker, t: ts.Type): boolean {
    if (!!(t.flags & ts.TypeFlags.StringLiteral)) {
        return true;
    }
    if (!!(t.flags & ts.TypeFlags.NumberLiteral)) {
        return true;
    }
    if (!!(t.flags & ts.TypeFlags.BooleanLiteral)) {
        // this is cool
        // https://github.com/microsoft/TypeScript/issues/22269
        return true;
    }
    if (!!(t.flags & ts.TypeFlags.Undefined)) {
        return true;
    }
    if (!!(t.flags & ts.TypeFlags.Null)) {
        return true;
    }

    return false;
}

export function isTypeReference(t: ts.Type): t is ts.TypeReference {
    return isObject(t) && !!(t.objectFlags & ts.ObjectFlags.Reference);
}
