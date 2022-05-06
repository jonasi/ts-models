import * as ts from 'typescript';
import { Context, AcceptableDefT } from './context';
import { isArray, isBoolean, isDate, isEnum, isLiteral, isNumber, isObject, isRecord, isString, isTuple, isUndefined, isUnknown } from './predicates';

export function makeCheck(ctx: Context, node: ts.Node, optional = false, skipExisting = false): [ ts.Expression, AcceptableDefT[] ] {
    while (ts.isParenthesizedTypeNode(node)) {
        node = node.type;
    }

    if (optional) {
        const [ check, deps ] = makeCheck(ctx, node, false);
        const arg = ts.factory.createArrayLiteralExpression([
            ts.factory.createIdentifier('runtime.checkEmpty'),
            check,
        ], true);
        return [ 
            ts.factory.createCallExpression(
                ts.factory.createIdentifier('runtime.checkOr'), [], [ arg ],
            ),
            deps,
        ];
    }

    const typ = ctx.checker.getTypeAtLocation(node);
    let deps: AcceptableDefT[] = [];

    if (!skipExisting) {
        const existing = ctx.allChecks.get(typ);
        if (existing) {
            return existing;
        }
    }

    if (isRecord(ctx, typ)) {
        return makeCheckRecordOf(ctx, node, deps);
    }

    if (typ.aliasSymbol?.declarations?.length) {
        deps = [ typ.aliasSymbol.declarations[0] as AcceptableDefT ];
    }

    if (isUnknown(typ)) {
        return makeCheckUnknown(deps);
    }
    if (isBoolean(typ)) {
        return makeCheckBoolean(deps);
    }
    if (isString(typ)) {
        return makeCheckString(deps);
    }
    if (isNumber(typ)) {
        return makeCheckNumber(deps);
    }
    if (isUndefined(typ)) {
        return makeCheckEmpty(deps);
    }
    if (isDate(ctx, typ)) {
        return makeCheckDate(deps);
    }
    if (isLiteral(ctx.checker, typ)) {
        return makeCheckLiteral(ctx, typ, deps);
    }
    if (isTuple(typ, node)) {
        return makeCheckTupleOf(ctx, node, typ, deps);
    }
    if (isArray(typ, node)) {
        return makeCheckArrayOf(ctx, node, typ, deps);
    } 
    if (isObject(typ)) {
        return makeCheckShapeOf(ctx, typ, deps);
    }
    if (ts.isUnionTypeNode(node)) {
        return makeCheckOr(ctx, node.types, typ, deps);
    }
    if (ts.isIntersectionTypeNode(node)) {
        return makeCheckAnd(ctx, node, typ, deps);
    }
    if (isEnum(typ)) {
        return makeCheckOr(ctx, (typ.aliasSymbol?.valueDeclaration as ts.EnumDeclaration).members, typ, deps);
    }

    throw new Error("Invalid type at " + ctx.checker.typeToString(typ));
}


function makeCheckUnknown(deps: AcceptableDefT[]): [ ts.Expression, AcceptableDefT[] ] {
    return [ ts.factory.createIdentifier('runtime.checkUnknown'), deps ];
}

function makeCheckBoolean(deps: AcceptableDefT[]): [ ts.Expression, AcceptableDefT[] ] {
    return [ ts.factory.createIdentifier('runtime.checkBoolean'), deps ];
}

function makeCheckString(deps: AcceptableDefT[]): [ ts.Expression, AcceptableDefT[] ] {
    return [ ts.factory.createIdentifier('runtime.checkString'), deps ];
}

function makeCheckNumber(deps: AcceptableDefT[]): [ ts.Expression, AcceptableDefT[] ] {
    return [ ts.factory.createIdentifier('runtime.checkNumber'), deps ];
}

function makeCheckEmpty(deps: AcceptableDefT[]): [ ts.Expression, AcceptableDefT[] ] {
    return [ ts.factory.createIdentifier('runtime.checkEmpty'), deps ];
}

function makeCheckDate(deps: AcceptableDefT[]): [ ts.Expression, AcceptableDefT[] ] {
    return [ ts.factory.createIdentifier('runtime.checkDate'), deps ];
}

function makeCheckRecordOf(ctx: Context, node: ts.Node, deps: AcceptableDefT[]): [ ts.Expression, AcceptableDefT[] ] {
    const eltyp = ((node as ts.NodeWithTypeArguments).typeArguments as ts.NodeArray<ts.TypeNode>)[1];

    const [ arg, d2 ] = makeCheck(ctx, eltyp);
    return [ 
        ts.factory.createCallExpression(
            ts.factory.createIdentifier('runtime.checkRecordOf'), [], [ arg ],
        ),
        [ ...deps, ...d2 ],
    ];
}

export function makeCheckShapeOf(ctx: Context, typ: ts.Type, deps: AcceptableDefT[]): [ ts.Expression, AcceptableDefT[] ] {
    const oldPm = ctx.activePropertyMapper;
    const pm = ctx.propertyMappers.get(typ);
    if (pm) {
        ctx.activePropertyMapper = pm;
    }

    const assignments: ts.ObjectLiteralElementLike[] = [];
    const props = typ.getProperties();
    for (const k in props) {
        if (props[k].valueDeclaration?.kind !== ts.SyntaxKind.PropertySignature) {
            continue;
        }

        const ps = props[k].valueDeclaration as ts.PropertySignature;
        const subnode = ps.type;
        if (!subnode) {
            throw new Error("WTF");
        }

        const optional = !!(props[k].flags & ts.SymbolFlags.Optional);

        const [ check, d2 ] = makeCheck(ctx, subnode, optional);
        deps = [ ...deps, ...d2 ];

        assignments.push(ts.factory.createPropertyAssignment(props[k].name, check));
    }

    const arg = ts.factory.createObjectLiteralExpression(assignments, true);
    const args = [ arg ];

    if (ctx.activePropertyMapper) {
        args.push(ts.factory.createObjectLiteralExpression([
            ts.factory.createPropertyAssignment('propertyMapper', ts.factory.createIdentifier('runtime.' + ctx.activePropertyMapper)),
        ], true));
    }

    ctx.activePropertyMapper = oldPm;

    return [
        ts.factory.createCallExpression(
            ts.factory.createIdentifier('runtime.checkShapeOf'), [], args,
        ),
        deps,
    ];
}

function makeCheckLiteral(ctx: Context, typ: ts.Type, deps: AcceptableDefT[]): [ ts.Expression, AcceptableDefT[] ] {
    const arg = ts.factory.createIdentifier(ctx.checker.typeToString(typ));
    return [ 
        ts.factory.createCallExpression(
            ts.factory.createIdentifier('runtime.checkLiteralOf'), [], [ arg ],
        ), 
        deps, 
    ];
}

function makeCheckTupleOf(ctx: Context, node: ts.TupleTypeNode, typ: ts.Type, deps: AcceptableDefT[]): [ ts.Expression, AcceptableDefT[] ] {
    const arg = ts.factory.createArrayLiteralExpression(node.elements.map(typ => {
        const [ t, d2 ] = makeCheck(ctx, typ);
        deps = [ ...deps, ...d2 ];
        return t;
    }), true);
    return [
        ts.factory.createCallExpression(
            ts.factory.createIdentifier('runtime.checkTupleOf'), [], [ arg ]
        ),
        deps,
    ];
}

function makeCheckArrayOf(ctx: Context, node: ts.ArrayTypeNode, typ: ts.Type, deps: AcceptableDefT[]): [ ts.Expression, AcceptableDefT[] ] {
    const [ arg, d2 ] = makeCheck(ctx, node.elementType);
    return [
        ts.factory.createCallExpression(
            ts.factory.createIdentifier('runtime.checkArrayOf'), [], [ arg ],
        ),
        [ ...deps, ...d2 ],
    ];
}

export function makeCheckDeferred(ctx: Context, existing: string, deps: AcceptableDefT[]): [ ts.Expression, AcceptableDefT[] ] {
    return [ 
        ts.factory.createCallExpression(
            ts.factory.createIdentifier('runtime.checkDeferred'), [], [ 
                ts.factory.createArrowFunction(
                    void 0,
                    void 0,
                    [],
                    void 0,
                    void 0,
                    ts.factory.createIdentifier(existing),
                ),
            ]
        ),
        deps,
    ];
}

function makeCheckOr(ctx: Context, types: ts.NodeArray<ts.Node>, typ: ts.Type, deps: AcceptableDefT[]): [ ts.Expression, AcceptableDefT[] ] {
    const args = types.map(t => {
        const [ check, d2 ] = makeCheck(ctx, t);
        deps = [ ...deps, ...d2 ];
        return check;
    });
    const arg = ts.factory.createArrayLiteralExpression(args as ts.Expression[], true);

    return [
        ts.factory.createCallExpression(
            ts.factory.createIdentifier('runtime.checkOr'), [], [ arg ],
        ),
        deps,
    ];
}

function makeCheckAnd(ctx: Context, node: ts.IntersectionTypeNode, typ: ts.Type, deps: AcceptableDefT[]): [ ts.Expression, AcceptableDefT[] ] {
    const args = node.types.map(t => {
        const [ check, d2 ] = makeCheck(ctx, t);
        deps = [ ...deps, ...d2 ];
        return check;
    });

    const arg = ts.factory.createArrayLiteralExpression(args as ts.Expression[], true);
    return [
        ts.factory.createCallExpression(
            ts.factory.createIdentifier('runtime.checkAnd'), [], [ arg ],
        ),
        deps,
    ];
}
