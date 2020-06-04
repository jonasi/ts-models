import * as ts from 'typescript';
import parseProgram from './parse_program';
import createProgram, { getGlobals, Globals } from './create_program';
import { fileToString } from './print';

export function generateModels(file: string): string {
    const prog = createProgram(file);
    const f = prog.getSourceFile(file) as ts.SourceFile;
    const nodes = createModels(prog);

    return fileToString(f, nodes);
}

type Context = {
    checker: ts.TypeChecker,
    globals: Globals,
    allChecks: Map<ts.Type, string>;
    propertyMappers: Map<ts.Type, string>;
    activePropertyMapper: string | undefined;
};

function createModels(prog: ts.Program): ts.Node[] {
    const ctx: Context = {
        globals:              getGlobals(prog),
        checker:              prog.getTypeChecker(),
        allChecks:            new Map(),
        propertyMappers:      new Map(),
        activePropertyMapper: void 0,
    };

    const types = parseProgram(prog);
    const header = types.length ? makeHeader() : [];
    let definitions: ts.Node[] = [ ...header ];
    const actions: (() => void)[] = [];

    types.forEach(t => {
        switch (t.type) {
            case 'generate_type':
                actions.push(() => {
                    const defs = makeDef(ctx, t.node);
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

function isArray(t: ts.Type, node: ts.Node): ts.TypeNode | undefined {
    if (!!node && ts.isArrayTypeNode(node)) {
        return node.elementType;
    }

    return void 0;
}

function isTuple(t: ts.Type, node: ts.TypeNode): readonly ts.TypeNode[] | undefined {
    if (isTypeReference(t) && !!node && ts.isTupleTypeNode(node)) {
        return node.elementTypes;
    }

    return void 0;
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

function makeCheckFn(ctx: Context, name: string, node: ts.TypeNode): [ ts.VariableDeclarationList, ts.TypeAliasDeclaration[] ] {
    const checkName = 'check' + ucfirst(name);
    ctx.allChecks.set(ctx.checker.getTypeFromTypeNode(node), checkName);

    const [ check, deps ] = makeCheck(ctx, node, false, true);
    return [
        ts.createVariableDeclarationList([
            ts.createVariableDeclaration(
                checkName,
                ts.createTypeReferenceNode('runtime.Check', [ ts.createTypeReferenceNode(name, void 0) ]),
                check,
            ),
        ], ts.NodeFlags.Const),
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

    if (!skipExisting) {
        const existing = ctx.allChecks.get(typ);
        if (existing) {
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
                [],
            ];
        }
    }

    let deps: ts.TypeAliasDeclaration[] = [];
    if (typ.aliasSymbol) {
        deps = [ typ.aliasSymbol.declarations[0] as ts.TypeAliasDeclaration ];
    }

    if (isBoolean(typ)) {
        return [ ts.createIdentifier('runtime.checkBoolean'), deps ];
    }
    if (isString(typ)) {
        return [ ts.createIdentifier('runtime.checkString'), deps ];
    }
    if (isNumber(typ)) {
        return [ ts.createIdentifier('runtime.checkNumber'), deps ];
    }
    if (isUndefined(typ)) {
        return [ ts.createIdentifier('runtime.checkEmpty'), deps ];
    }

    if (typ === ctx.globals.Date) {
        return [ ts.createIdentifier('runtime.checkDate'), deps ];
    }

    const ok = isLiteral(ctx.checker, typ);
    if (ok) {
        const arg = ts.createIdentifier(ctx.checker.typeToString(typ));
        return [ 
            ts.createCall(
                ts.createIdentifier('runtime.checkLiteralOf'), [], [ arg ],
            ), 
            deps, 
        ];
    }
    const eltyps = isTuple(typ, node);
    if (eltyps) {
        const arg = ts.createArrayLiteral(eltyps.map(typ => {
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

    const eltyp = isArray(typ, node);
    if (eltyp) {
        const [ arg, d2 ] = makeCheck(ctx, eltyp);
        return [
            ts.createCall(
                ts.createIdentifier('runtime.checkArrayOf'), [], [ arg ],
            ),
            [ ...deps, ...d2 ],
        ];
    } 

    if (isObject(typ)) {
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

    if (ts.isUnionTypeNode(node)) {
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

    if (ts.isIntersectionTypeNode(node)) {
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
