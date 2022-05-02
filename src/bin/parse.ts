import * as ts from 'typescript';
import parseProgram from './parse_program';
import createProgram, { getGlobals } from './create_program';
import { fileToString } from './print';
import { Context, AcceptableDefT } from './context';
import { isArray, isBoolean, isDate, isEnum, isLiteral, isNumber, isObject, isRecord, isString, isTuple, isUndefined, isUnknown } from './predicates';
// import log from '@jonasi/jslog';

export function generateModels(file: string): string {
    const prog = createProgram(file);
    const nodes = createModels(prog);

    const header = nodes.length ? makeHeader() : [];
    const nodeMap = nodes.reduce((map, n) => {
        const nodes = map.get(n.file) || [];
        nodes.push(n.node);
        map.set(n.file, nodes);

        return map;
    }, new Map<ts.SourceFile, ts.Node[]>());


    return fileToString(prog.getSourceFile(file) as ts.SourceFile, header) + Array.from(nodeMap).map(n => fileToString(n[0], n[1])).join('\n');
}

function createModels(prog: ts.Program): { file: ts.SourceFile, node: ts.Node }[] {
    const ctx: Context = {
        globals:              getGlobals(prog),
        checker:              prog.getTypeChecker(),
        allChecks:            new Map(),
        propertyMappers:      new Map(),
        activePropertyMapper: void 0,
    };

    const types = parseProgram(prog);
    let definitions: { file: ts.SourceFile, node: ts.Node }[] = [];
    const actions: (() => void)[] = [];

    types.forEach(t => {
        switch (t.type) {
            case 'generate_type':
                actions.push(() => {
                    const defs = makeDef(ctx, t.node).map(node => ({ file: t.file, node }));
                    definitions = [ ...definitions, ...defs ];
                });
                break;
            case 'type_options':
                if (t.propertyMapper) {
                    const typ = ctx.checker.getTypeAtLocation(t.node);
                    ctx.propertyMappers.set(typ, t.propertyMapper);
                }
                break;
        }
    });

    actions.forEach(fn => fn());

    return definitions;
}

function makeHeader(): ts.Node[] {
    return [
        ts.factory.createImportDeclaration(
            void 0,
            void 0,
            ts.factory.createImportClause(
                false,
                ts.factory.createIdentifier('* as runtime'),
                void 0,
            ),
            ts.factory.createStringLiteral('@jonasi/ts-models'),
        ),
    ];
}

function makeDef(ctx: Context, n: AcceptableDefT): ts.Node[] {
    const [ checkFn, deps ] = makeCheckFn(ctx, n.name.text, ts.isTypeAliasDeclaration(n) ? n.type : n);
    const allTypes = [ n, ...deps ].filter((t, i, arr) => arr.indexOf(t) === i);

    return [
        ...allTypes.map(n => makeType(n)),
        checkFn,
        makeFn(n),
        makeFnArr(n),
    ];
}
 
function makeType(n: AcceptableDefT): ts.Node {
    if (ts.isEnumDeclaration(n)) {
        return ts.factory.createEnumDeclaration(
            void 0,
            void 0,
            n.name,
            n.members,
        );
    }

    const al = ts.factory.createTypeAliasDeclaration(
        void 0,
        void 0,
        n.name,
        n.typeParameters,
        n.type,
    );

    return al;
}

function makeFn(n: AcceptableDefT): ts.Node {
    if (ts.isTypeAliasDeclaration(n) && n.typeParameters && n.typeParameters.length) {
        const params: ts.ParameterDeclaration[] = [];
        const args: ts.Expression[] = [];
        const nodes: ts.TypeNode[] = [];
        n.typeParameters.forEach(typArg => {
            nodes.push(
                ts.factory.createTypeReferenceNode(typArg.name.text)
            );
            params.push(
                ts.factory.createParameterDeclaration(void 0, void 0, void 0, `check${ typArg.name.text }`, void 0, ts.factory.createTypeReferenceNode('runtime.Check', [ ts.factory.createTypeReferenceNode(typArg.name.text, void 0) ])),
            );
            args.push(ts.factory.createIdentifier(`check${ typArg.name.text }`));
        });

        return ts.factory.createFunctionDeclaration(
            void 0,
            [ ts.factory.createToken(ts.SyntaxKind.ExportKeyword) ],
            void 0,
            'to' + ucfirst(n.name.text),
            n.typeParameters,
            params,
            ts.factory.createFunctionTypeNode(
                void 0,
                [ ts.factory.createParameterDeclaration(void 0, void 0, void 0, 'js', void 0, ts.factory.createTypeReferenceNode('runtime.JSONValue', void 0)) ],
                ts.factory.createTypeReferenceNode(n.name.text, nodes),
            ),
            ts.factory.createBlock([
                ts.factory.createVariableStatement(void 0, ts.factory.createVariableDeclarationList([
                    ts.factory.createVariableDeclaration('check', void 0, void 0, ts.factory.createCallExpression(ts.factory.createIdentifier(`check${ n.name.text }`), [], args)),
                ], ts.NodeFlags.Const)),
                ts.factory.createReturnStatement(ts.factory.createFunctionExpression(
                    void 0,
                    void 0,
                    void 0,
                    void 0,
                    [ ts.factory.createParameterDeclaration(void 0, void 0, void 0, 'js', void 0, ts.factory.createTypeReferenceNode('runtime.JSONValue', void 0)) ],
                    ts.factory.createTypeReferenceNode(n.name.text, nodes),
                    ts.factory.createBlock([
                        ts.factory.createReturnStatement(makeAssert('js', ts.factory.createIdentifier('check'))),
                    ], true),
                )),
            ], true),
        );
    }

    const fn = ts.factory.createFunctionDeclaration(
        void 0,
        [ ts.factory.createToken(ts.SyntaxKind.ExportKeyword) ],
        void 0,
        'to' + ucfirst(n.name.text),
        void 0,
        [ ts.factory.createParameterDeclaration(void 0, void 0, void 0, 'js', void 0, ts.factory.createTypeReferenceNode('runtime.JSONValue', void 0)) ],
        ts.factory.createTypeReferenceNode(n.name.text, void 0),
        ts.factory.createBlock([
            ts.factory.createReturnStatement(makeAssert('js', ts.factory.createIdentifier('check' + ucfirst(n.name.text)))),
        ], true),
    );

    return fn;
}

function makeFnArr(n: AcceptableDefT): ts.Node {
    if (ts.isTypeAliasDeclaration(n) && n.typeParameters && n.typeParameters.length) {
        const params: ts.ParameterDeclaration[] = [];
        const args: ts.Expression[] = [];
        const nodes: ts.TypeNode[] = [];
        n.typeParameters.forEach(typArg => {
            nodes.push(
                ts.factory.createTypeReferenceNode(typArg.name.text)
            );
            params.push(
                ts.factory.createParameterDeclaration(void 0, void 0, void 0, `check${ typArg.name.text }`, void 0, ts.factory.createTypeReferenceNode('runtime.Check', [ ts.factory.createTypeReferenceNode(typArg.name.text, void 0) ])),
            );
            args.push(ts.factory.createIdentifier(`check${ typArg.name.text }`));
        });

        return ts.factory.createFunctionDeclaration(
            void 0,
            [ ts.factory.createToken(ts.SyntaxKind.ExportKeyword) ],
            void 0,
            'to' + ucfirst(n.name.text) + 'Arr',
            n.typeParameters,
            params,
            ts.factory.createFunctionTypeNode(
                void 0,
                [ ts.factory.createParameterDeclaration(void 0, void 0, void 0, 'js', void 0, ts.factory.createTypeReferenceNode('runtime.JSONValue', void 0)) ],
                ts.factory.createTypeReferenceNode('Array', [
                    ts.factory.createTypeReferenceNode(n.name.text, nodes),
                ]),
            ),
            ts.factory.createBlock([
                ts.factory.createVariableStatement(void 0, ts.factory.createVariableDeclarationList([
                    ts.factory.createVariableDeclaration('check', void 0, void 0, ts.factory.createCallExpression(ts.factory.createIdentifier(`check${ n.name.text }`), [], args)),
                ], ts.NodeFlags.Const)),
                ts.factory.createReturnStatement(ts.factory.createFunctionExpression(
                    void 0,
                    void 0,
                    void 0,
                    void 0,
                    [ ts.factory.createParameterDeclaration(void 0, void 0, void 0, 'js', void 0, ts.factory.createTypeReferenceNode('runtime.JSONValue', void 0)) ],
                    ts.factory.createTypeReferenceNode('Array', [
                        ts.factory.createTypeReferenceNode(n.name.text, nodes),
                    ]),
                    ts.factory.createBlock([
                        ts.factory.createReturnStatement(makeAssert('js', ts.factory.createCallExpression(
                            ts.factory.createIdentifier('runtime.checkArrayOf'),
                            void 0,
                            [ ts.factory.createIdentifier('check') ]
                        ))),
                    ], true),
                )),
            ], true),
        );
    }

    const fn = ts.factory.createFunctionDeclaration(
        void 0,
        [ ts.factory.createToken(ts.SyntaxKind.ExportKeyword) ],
        void 0,
        'to' + ucfirst(n.name.text) + 'Arr',
        void 0,
        [ ts.factory.createParameterDeclaration(void 0, void 0, void 0, 'js', void 0, ts.factory.createTypeReferenceNode('runtime.JSONValue', void 0)) ],
        ts.factory.createTypeReferenceNode('Array', [
            ts.factory.createTypeReferenceNode(n.name.text, void 0),
        ]),
        ts.factory.createBlock([
            ts.factory.createReturnStatement(
                makeAssert('js', ts.factory.createCallExpression(
                    ts.factory.createIdentifier('runtime.checkArrayOf'),
                    void 0,
                    [ ts.factory.createIdentifier('check' + ucfirst(n.name.text)) ]
                ))
            ),
        ], true),
    );

    return fn;
}

function makeCheckFn(ctx: Context, name: string, node: ts.Node): [ ts.Node, AcceptableDefT[] ] {
    const checkName = 'check' + ucfirst(name);
    const typ = ctx.checker.getTypeAtLocation(node);
    ctx.allChecks.set(typ, makeCheckDeferred(ctx, checkName, []));

    if (typ.aliasTypeArguments && typ.aliasTypeArguments.length) {
        const params: ts.ParameterDeclaration[] = [];
        const typArgs: ts.TypeParameterDeclaration[] = [];
        const typNodes: ts.TypeNode[] = [];

        typ.aliasTypeArguments.forEach(typArg => {
            typNodes.push(
                ts.factory.createTypeReferenceNode(typArg.symbol.name)
            );
            typArgs.push(
                ts.factory.createTypeParameterDeclaration(typArg.symbol.name),
            );
            params.push(
                ts.factory.createParameterDeclaration(void 0, void 0, void 0, `check${ typArg.symbol.name}`, void 0, ts.factory.createTypeReferenceNode('runtime.Check', [ ts.factory.createTypeReferenceNode(typArg.symbol.name, void 0) ])),
            );

            ctx.allChecks.set(typArg, [ ts.factory.createIdentifier(`check${ typArg.symbol.name}`), [] ]);
        });

        const [ check, deps ] = makeCheck(ctx, node, false, true);
        return [
            ts.factory.createFunctionDeclaration(
                void 0,
                [ ts.factory.createToken(ts.SyntaxKind.ExportKeyword) ],
                void 0,
                checkName,
                typArgs,
                params,
                ts.factory.createTypeReferenceNode('runtime.Check', [ ts.factory.createTypeReferenceNode(name, typNodes) ]),
                ts.factory.createBlock([
                    ts.factory.createReturnStatement(check),
                ], true),
            ),
            deps,
        ];
    }

    const [ check, deps ] = makeCheck(ctx, node, false, true);
    return [
        ts.factory.createVariableStatement(
            [ ts.factory.createToken(ts.SyntaxKind.ExportKeyword) ],
            ts.factory.createVariableDeclarationList([
                ts.factory.createVariableDeclaration(
                    checkName,
                    void 0,
                    ts.factory.createTypeReferenceNode('runtime.Check', [ ts.factory.createTypeReferenceNode(name, void 0) ]),
                    check,
                ),
            ], ts.NodeFlags.Const),
        ),
        deps,
    ];
}

function makeCheck(ctx: Context, node: ts.Node, optional = false, skipExisting = false): [ ts.Expression, AcceptableDefT[] ] {
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

function makeAssert(arg: ts.Expression | string, check: ts.Expression): ts.CallExpression {
    return ts.factory.createCallExpression(
        ts.factory.createIdentifier('runtime.assert'), 
        [], 
        [ typeof arg === 'string' ? ts.factory.createIdentifier(arg) : arg, check ],
    );
}

function ucfirst(str: string): string {
    return str[0].toUpperCase() + str.substr(1);
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

function makeCheckShapeOf(ctx: Context, typ: ts.Type, deps: AcceptableDefT[]): [ ts.Expression, AcceptableDefT[] ] {
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

function makeCheckDeferred(ctx: Context, existing: string, deps: AcceptableDefT[]): [ ts.Expression, AcceptableDefT[] ] {
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
