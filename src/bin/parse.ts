import * as ts from 'typescript';
import parseProgram from './parse_program';
import createProgram, { getGlobals, Globals } from './create_program';
import { fileToString } from './print';
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

type Context = {
    checker: ts.TypeChecker,
    globals: Globals,
    allChecks: Map<ts.Type, [ ts.Expression, ts.TypeAliasDeclaration[] ]>;
    propertyMappers: Map<ts.Type, string>;
    activePropertyMapper: string | undefined;
};

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
                    const typ = ctx.checker.getTypeFromTypeNode(t.node.type);
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
        ts.createImportDeclaration(
            void 0,
            void 0,
            ts.createImportClause(
                ts.createIdentifier('* as runtime'),
                void 0,
            ),
            ts.createLiteral('@jonasi/ts-models'),
        ),
    ];
}

function makeDef(ctx: Context, n: ts.TypeAliasDeclaration): ts.Node[] {
    const [ checkFn, deps ] = makeCheckFn(ctx, n.name.text, n.type);
    const allTypes = [ n, ...deps ].filter((t, i, arr) => arr.indexOf(t) === i);

    return [
        ...allTypes.map(n => makeType(n)),
        checkFn,
        makeFn(n),
        makeFnArr(n),
    ];
}
 
function makeType(n: ts.TypeAliasDeclaration): ts.Node {
    const al = ts.createTypeAliasDeclaration(
        void 0,
        void 0,
        n.name,
        n.typeParameters,
        n.type,
    );

    return al;
}

function makeFn(n: ts.TypeAliasDeclaration): ts.Node {
    if (n.typeParameters && n.typeParameters.length) {
        const params: ts.ParameterDeclaration[] = [];
        const args: ts.Expression[] = [];
        const nodes: ts.TypeNode[] = [];
        n.typeParameters.forEach(typArg => {
            nodes.push(
                ts.createTypeReferenceNode(typArg.name.text)
            );
            params.push(
                ts.createParameter(void 0, void 0, void 0, `check${ typArg.name.text }`, void 0, ts.createTypeReferenceNode('runtime.Check', [ ts.createTypeReferenceNode(typArg.name.text, void 0) ])),
            );
            args.push(ts.createIdentifier(`check${ typArg.name.text }`));
        });

        return ts.createFunctionDeclaration(
            void 0,
            [ ts.createToken(ts.SyntaxKind.ExportKeyword) ],
            void 0,
            'to' + ucfirst(n.name.text),
            n.typeParameters,
            params,
            ts.createFunctionTypeNode(
                void 0,
                [ ts.createParameter(void 0, void 0, void 0, 'js', void 0, ts.createTypeReferenceNode('runtime.JSONValue', void 0)) ],
                ts.createTypeReferenceNode(n.name.text, nodes),
            ),
            ts.createBlock([
                ts.createVariableStatement(void 0, ts.createVariableDeclarationList([
                    ts.createVariableDeclaration('check', void 0, ts.createCall(ts.createIdentifier(`check${ n.name.text }`), [], args)),
                ], ts.NodeFlags.Const)),
                ts.createReturn(ts.createFunctionExpression(
                    void 0,
                    void 0,
                    void 0,
                    void 0,
                    [ ts.createParameter(void 0, void 0, void 0, 'js', void 0, ts.createTypeReferenceNode('runtime.JSONValue', void 0)) ],
                    ts.createTypeReferenceNode(n.name.text, nodes),
                    ts.createBlock([
                        ts.createReturn(makeAssert('js', ts.createIdentifier('check'))),
                    ], true),
                )),
            ], true),
        );
    }

    const fn = ts.createFunctionDeclaration(
        void 0,
        [ ts.createToken(ts.SyntaxKind.ExportKeyword) ],
        void 0,
        'to' + ucfirst(n.name.text),
        void 0,
        [ ts.createParameter(void 0, void 0, void 0, 'js', void 0, ts.createTypeReferenceNode('runtime.JSONValue', void 0)) ],
        ts.createTypeReferenceNode(n.name.text, void 0),
        ts.createBlock([
            ts.createReturn(makeAssert('js', ts.createIdentifier('check' + ucfirst(n.name.text)))),
        ], true),
    );

    return fn;
}

function makeFnArr(n: ts.TypeAliasDeclaration): ts.Node {
    if (n.typeParameters && n.typeParameters.length) {
        const params: ts.ParameterDeclaration[] = [];
        const args: ts.Expression[] = [];
        const nodes: ts.TypeNode[] = [];
        n.typeParameters.forEach(typArg => {
            nodes.push(
                ts.createTypeReferenceNode(typArg.name.text)
            );
            params.push(
                ts.createParameter(void 0, void 0, void 0, `check${ typArg.name.text }`, void 0, ts.createTypeReferenceNode('runtime.Check', [ ts.createTypeReferenceNode(typArg.name.text, void 0) ])),
            );
            args.push(ts.createIdentifier(`check${ typArg.name.text }`));
        });

        return ts.createFunctionDeclaration(
            void 0,
            [ ts.createToken(ts.SyntaxKind.ExportKeyword) ],
            void 0,
            'to' + ucfirst(n.name.text) + 'Arr',
            n.typeParameters,
            params,
            ts.createFunctionTypeNode(
                void 0,
                [ ts.createParameter(void 0, void 0, void 0, 'js', void 0, ts.createTypeReferenceNode('runtime.JSONValue', void 0)) ],
                ts.createTypeReferenceNode('Array', [
                    ts.createTypeReferenceNode(n.name.text, nodes),
                ]),
            ),
            ts.createBlock([
                ts.createVariableStatement(void 0, ts.createVariableDeclarationList([
                    ts.createVariableDeclaration('check', void 0, ts.createCall(ts.createIdentifier(`check${ n.name.text }`), [], args)),
                ], ts.NodeFlags.Const)),
                ts.createReturn(ts.createFunctionExpression(
                    void 0,
                    void 0,
                    void 0,
                    void 0,
                    [ ts.createParameter(void 0, void 0, void 0, 'js', void 0, ts.createTypeReferenceNode('runtime.JSONValue', void 0)) ],
                    ts.createTypeReferenceNode('Array', [
                        ts.createTypeReferenceNode(n.name.text, nodes),
                    ]),
                    ts.createBlock([
                        ts.createReturn(makeAssert('js', ts.createCall(
                            ts.createIdentifier('runtime.checkArrayOf'),
                            void 0,
                            [ ts.createIdentifier('check') ]
                        ))),
                    ], true),
                )),
            ], true),
        );
    }

    const fn = ts.createFunctionDeclaration(
        void 0,
        [ ts.createToken(ts.SyntaxKind.ExportKeyword) ],
        void 0,
        'to' + ucfirst(n.name.text) + 'Arr',
        void 0,
        [ ts.createParameter(void 0, void 0, void 0, 'js', void 0, ts.createTypeReferenceNode('runtime.JSONValue', void 0)) ],
        ts.createTypeReferenceNode('Array', [
            ts.createTypeReferenceNode(n.name.text, void 0),
        ]),
        ts.createBlock([
            ts.createReturn(
                makeAssert('js', ts.createCall(
                    ts.createIdentifier('runtime.checkArrayOf'),
                    void 0,
                    [ ts.createIdentifier('check' + ucfirst(n.name.text)) ]
                ))
            ),
        ], true),
    );

    return fn;
}

function isUnknown(t: ts.Type): boolean {
    return !!(t.flags & ts.TypeFlags.Unknown);
}

function isBoolean(t: ts.Type): boolean {
    return !!(t.flags & ts.TypeFlags.Boolean);
}

function isString(t: ts.Type): boolean {
    return !!(t.flags & ts.TypeFlags.String);
}

function isNumber(t: ts.Type): boolean {
    return !!(t.flags & ts.TypeFlags.Number);
}

function isUndefined(t: ts.Type): boolean {
    return !!(t.flags & ts.TypeFlags.Undefined);
}

function isArray(t: ts.Type, node: ts.Node): node is ts.ArrayTypeNode {
    return !!node && ts.isArrayTypeNode(node);
}

function isTuple(t: ts.Type, node: ts.TypeNode): node is ts.TupleTypeNode {
    return isTypeReference(t) && !!node && ts.isTupleTypeNode(node);
}

function isRecord(ctx: Context, t: ts.Type): boolean {
    return !!t.aliasSymbol && t.aliasSymbol === ctx.globals.Record.aliasSymbol;
}

function isDate(ctx: Context, t: ts.Type): boolean {
    return t === ctx.globals.Date;
}

function isObject(t: ts.Type): t is ts.ObjectType {
    return !!(t.flags & ts.TypeFlags.Object);
}

function isLiteral(ch: ts.TypeChecker, t: ts.Type): boolean {
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

function isTypeReference(t: ts.Type): t is ts.TypeReference {
    return isObject(t) && !!(t.objectFlags & ts.ObjectFlags.Reference);
}

function makeCheckFn(ctx: Context, name: string, node: ts.TypeNode): [ ts.Node, ts.TypeAliasDeclaration[] ] {
    const checkName = 'check' + ucfirst(name);
    const typ = ctx.checker.getTypeFromTypeNode(node);
    ctx.allChecks.set(typ, makeCheckDeferred(ctx, checkName, []));

    if (typ.aliasTypeArguments && typ.aliasTypeArguments.length) {
        const params: ts.ParameterDeclaration[] = [];
        const typArgs: ts.TypeParameterDeclaration[] = [];
        const typNodes: ts.TypeNode[] = [];

        typ.aliasTypeArguments.forEach(typArg => {
            typNodes.push(
                ts.createTypeReferenceNode(typArg.symbol.name)
            );
            typArgs.push(
                ts.createTypeParameterDeclaration(typArg.symbol.name),
            );
            params.push(
                ts.createParameter(void 0, void 0, void 0, `check${ typArg.symbol.name}`, void 0, ts.createTypeReferenceNode('runtime.Check', [ ts.createTypeReferenceNode(typArg.symbol.name, void 0) ])),
            );

            ctx.allChecks.set(typArg, [ ts.createIdentifier(`check${ typArg.symbol.name}`), [] ]);
        });

        const [ check, deps ] = makeCheck(ctx, node, false, true);
        return [
            ts.createFunctionDeclaration(
                void 0,
                [ ts.createToken(ts.SyntaxKind.ExportKeyword) ],
                void 0,
                checkName,
                typArgs,
                params,
                ts.createTypeReferenceNode('runtime.Check', [ ts.createTypeReferenceNode(name, typNodes) ]),
                ts.createBlock([
                    ts.createReturn(check),
                ], true),
            ),
            deps,
        ];
    }

    const [ check, deps ] = makeCheck(ctx, node, false, true);
    return [
        ts.createVariableStatement(
            [ ts.createToken(ts.SyntaxKind.ExportKeyword) ],
            ts.createVariableDeclarationList([
                ts.createVariableDeclaration(
                    checkName,
                    ts.createTypeReferenceNode('runtime.Check', [ ts.createTypeReferenceNode(name, void 0) ]),
                    check,
                ),
            ], ts.NodeFlags.Const),
        ),
        deps,
    ];
}

function makeCheck(ctx: Context, node: ts.TypeNode, optional = false, skipExisting = false): [ ts.Expression, ts.TypeAliasDeclaration[] ] {
    if (optional) {
        const [ check, deps ] = makeCheck(ctx, node, false);
        const arg = ts.createArrayLiteral([
            ts.createIdentifier('runtime.checkEmpty'),
            check,
        ], true);
        return [ 
            ts.createCall(
                ts.createIdentifier('runtime.checkOr'), [], [ arg ],
            ),
            deps,
        ];
    }

    const typ = ctx.checker.getTypeFromTypeNode(node);
    let deps: ts.TypeAliasDeclaration[] = [];

    if (!skipExisting) {
        const existing = ctx.allChecks.get(typ);
        if (existing) {
            return existing;
        }
    }

    if (isRecord(ctx, typ)) {
        return makeCheckRecordOf(ctx, node, deps);
    }

    if (typ.aliasSymbol) {
        deps = [ typ.aliasSymbol.declarations[0] as ts.TypeAliasDeclaration ];
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
        return makeCheckOr(ctx, node, typ, deps);
    }
    if (ts.isIntersectionTypeNode(node)) {
        return makeCheckAnd(ctx, node, typ, deps);
    }

    throw new Error("Invalid type at " + ctx.checker.typeToString(typ));
}

function makeAssert(arg: ts.Expression | string, check: ts.Expression): ts.CallExpression {
    return ts.createCall(
        ts.createIdentifier('runtime.assert'), 
        [], 
        [ typeof arg === 'string' ? ts.createIdentifier(arg) : arg, check ],
    );
}

function ucfirst(str: string): string {
    return str[0].toUpperCase() + str.substr(1);
}

function makeCheckUnknown(deps: ts.TypeAliasDeclaration[]): [ ts.Expression, ts.TypeAliasDeclaration[] ] {
    return [ ts.createIdentifier('runtime.checkUnknown'), deps ];
}

function makeCheckBoolean(deps: ts.TypeAliasDeclaration[]): [ ts.Expression, ts.TypeAliasDeclaration[] ] {
    return [ ts.createIdentifier('runtime.checkBoolean'), deps ];
}

function makeCheckString(deps: ts.TypeAliasDeclaration[]): [ ts.Expression, ts.TypeAliasDeclaration[] ] {
    return [ ts.createIdentifier('runtime.checkString'), deps ];
}

function makeCheckNumber(deps: ts.TypeAliasDeclaration[]): [ ts.Expression, ts.TypeAliasDeclaration[] ] {
    return [ ts.createIdentifier('runtime.checkNumber'), deps ];
}

function makeCheckEmpty(deps: ts.TypeAliasDeclaration[]): [ ts.Expression, ts.TypeAliasDeclaration[] ] {
    return [ ts.createIdentifier('runtime.checkEmpty'), deps ];
}

function makeCheckDate(deps: ts.TypeAliasDeclaration[]): [ ts.Expression, ts.TypeAliasDeclaration[] ] {
    return [ ts.createIdentifier('runtime.checkDate'), deps ];
}

function makeCheckRecordOf(ctx: Context, node: ts.TypeNode, deps: ts.TypeAliasDeclaration[]): [ ts.Expression, ts.TypeAliasDeclaration[] ] {
    const eltyp = ((node as ts.NodeWithTypeArguments).typeArguments as ts.NodeArray<ts.TypeNode>)[1];

    const [ arg, d2 ] = makeCheck(ctx, eltyp);
    return [ 
        ts.createCall(
            ts.createIdentifier('runtime.checkRecordOf'), [], [ arg ],
        ),
        [ ...deps, ...d2 ],
    ];
}

function makeCheckShapeOf(ctx: Context, typ: ts.Type, deps: ts.TypeAliasDeclaration[]): [ ts.Expression, ts.TypeAliasDeclaration[] ] {
    const oldPm = ctx.activePropertyMapper;
    const pm = ctx.propertyMappers.get(typ);
    if (pm) {
        ctx.activePropertyMapper = pm;
    }

    const assignments: ts.ObjectLiteralElementLike[] = [];
    const props = typ.getProperties();
    for (const k in props) {
        if (props[k].valueDeclaration.kind !== ts.SyntaxKind.PropertySignature) {
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

        assignments.push(ts.createPropertyAssignment(props[k].name, check));
    }

    const arg = ts.createObjectLiteral(assignments, true);
    const args = [ arg ];

    if (ctx.activePropertyMapper) {
        args.push(ts.createObjectLiteral([
            ts.createPropertyAssignment('propertyMapper', ts.createIdentifier('runtime.' + ctx.activePropertyMapper)),
        ], true));
    }

    ctx.activePropertyMapper = oldPm;

    return [
        ts.createCall(
            ts.createIdentifier('runtime.checkShapeOf'), [], args,
        ),
        deps,
    ];
}

function makeCheckLiteral(ctx: Context, typ: ts.Type, deps: ts.TypeAliasDeclaration[]): [ ts.Expression, ts.TypeAliasDeclaration[] ] {
    const arg = ts.createIdentifier(ctx.checker.typeToString(typ));
    return [ 
        ts.createCall(
            ts.createIdentifier('runtime.checkLiteralOf'), [], [ arg ],
        ), 
        deps, 
    ];
}

function makeCheckTupleOf(ctx: Context, node: ts.TupleTypeNode, typ: ts.Type, deps: ts.TypeAliasDeclaration[]): [ ts.Expression, ts.TypeAliasDeclaration[] ] {
    const arg = ts.createArrayLiteral(node.elements.map(typ => {
        const [ t, d2 ] = makeCheck(ctx, typ);
        deps = [ ...deps, ...d2 ];
        return t;
    }), true);
    return [
        ts.createCall(
            ts.createIdentifier('runtime.checkTupleOf'), [], [ arg ]
        ),
        deps,
    ];
}

function makeCheckArrayOf(ctx: Context, node: ts.ArrayTypeNode, typ: ts.Type, deps: ts.TypeAliasDeclaration[]): [ ts.Expression, ts.TypeAliasDeclaration[] ] {
    const [ arg, d2 ] = makeCheck(ctx, node.elementType);
    return [
        ts.createCall(
            ts.createIdentifier('runtime.checkArrayOf'), [], [ arg ],
        ),
        [ ...deps, ...d2 ],
    ];
}

function makeCheckDeferred(ctx: Context, existing: string, deps: ts.TypeAliasDeclaration[]): [ ts.Expression, ts.TypeAliasDeclaration[] ] {
    return [ 
        ts.createCall(
            ts.createIdentifier('runtime.checkDeferred'), [], [ 
                ts.createArrowFunction(
                    void 0,
                    void 0,
                    [],
                    void 0,
                    void 0,
                    ts.createIdentifier(existing),
                ),
            ]
        ),
        deps,
    ];
}

function makeCheckOr(ctx: Context, node: ts.UnionTypeNode, typ: ts.Type, deps: ts.TypeAliasDeclaration[]): [ ts.Expression, ts.TypeAliasDeclaration[] ] {
    const args = node.types.map(t => {
        const [ check, d2 ] = makeCheck(ctx, t);
        deps = [ ...deps, ...d2 ];
        return check;
    });
    const arg = ts.createArrayLiteral(args as ts.Expression[], true);

    return [
        ts.createCall(
            ts.createIdentifier('runtime.checkOr'), [], [ arg ],
        ),
        deps,
    ];
}

function makeCheckAnd(ctx: Context, node: ts.IntersectionTypeNode, typ: ts.Type, deps: ts.TypeAliasDeclaration[]): [ ts.Expression, ts.TypeAliasDeclaration[] ] {
    const args = node.types.map(t => {
        const [ check, d2 ] = makeCheck(ctx, t);
        deps = [ ...deps, ...d2 ];
        return check;
    });

    const arg = ts.createArrayLiteral(args as ts.Expression[], true);
    return [
        ts.createCall(
            ts.createIdentifier('runtime.checkAnd'), [], [ arg ],
        ),
        deps,
    ];
}
