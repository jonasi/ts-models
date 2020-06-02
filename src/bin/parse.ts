import * as ts from 'typescript';
import { join, dirname } from 'path';
import { readFileSync, existsSync } from 'fs';
// import log from '@jonasi/jslog';

const virtualFile = {
    name:     '__generated__/@jonasi/ts-models/virtual_file.ts',
    contents: `
declare var date: Date;
`,
};

type Globals = {
    Date: ts.Type,
};

export function generateModels(file: string): string {
    const conf = loadConfig(file);
    const host = ts.createCompilerHost(conf.options);
    const old = host.readFile;
    host.readFile = f => {
        if (f === virtualFile.name) {
            return virtualFile.contents;
        }

        return old(f);
    };

    const prog = ts.createProgram([ file, virtualFile.name ], conf.options, host);
    const f = prog.getSourceFile(file) as ts.SourceFile;
    const nodes = createModels(prog);

    return print(f, nodes);
}

function getGlobals(prog: ts.Program): Globals {
    const ch = prog.getTypeChecker();
    const vf = prog.getSourceFile(virtualFile.name) as ts.SourceFile;

    return {
        Date: ch.getTypeFromTypeNode(
            (vf.statements[0] as ts.VariableStatement).declarationList.declarations[0].type as ts.TypeNode
        ),
    };
}

function parseModels(pr: ts.Program): ts.TypeAliasDeclaration[] {
    const nodes: ts.TypeAliasDeclaration[] = [];

    for (const f of pr.getSourceFiles()) {
        if (!f.isDeclarationFile) {
            const sl = f.getChildren(f).find(n => n.kind === ts.SyntaxKind.SyntaxList);
            if (!sl) {
                continue;
            }

            sl.getChildren(f).forEach(n => {
                if (!ts.isTypeAliasDeclaration(n)) {
                    return;
                }

                const c = comments(f, n);
                if (!c) {
                    return;
                }
                const gen = c.find(v => v.startsWith('@jonasi/ts-models generate'));
                if (!gen) {
                    return;
                }

                nodes.push(n);
            });
        }
    }

    return nodes;
}

function comments(f: ts.SourceFile, n: ts.Node): string[] | undefined {
    const parsed = ts.getLeadingCommentRanges(f.text, n.pos);
    if (!parsed) {
        return void 0;
    }

    const cm: string[] = [];
    parsed.forEach(({ kind, pos, end }) => {
        let commentText = f.text.substring(pos, end).trim();
        if (kind === ts.SyntaxKind.MultiLineCommentTrivia) {
            commentText = commentText.replace(/(^\/\*)|(\*\/$)/g, '');
        } else if (kind === ts.SyntaxKind.SingleLineCommentTrivia) {
            if (commentText.startsWith('///')) {
                // triple-slash comments are typescript specific, ignore them in the output.
                return;
            }
            commentText = commentText.replace(/(^\/\/)/g, '');
        }
        cm.push(commentText.trim());
    });

    return cm.filter(x => !!x);
}

function loadConfig(root: string): ts.ParsedCommandLine {
    let dir = dirname(root);
    while (!existsSync(join(dir, 'tsconfig.json'))) {
        const newDir = dirname(dir);
        if (dir === newDir) {
            throw new Error("No tsconfig.json found");
        }
        dir = newDir;
    }

    const { config, error } = ts.readConfigFile(join(dir, 'tsconfig.json'), file => readFileSync(file, 'utf8'));
    if (error) {
        throw error;
    }

    return ts.parseJsonConfigFileContent(config, ts.sys, dir);
}

function createModels(prog: ts.Program): ts.Node[] {
    const ch = prog.getTypeChecker();
    const globals = getGlobals(prog);
    const types = parseModels(prog);
    const header = types.length ? makeHeader() : [];
    const allChecks: Map<ts.Type, string> = new Map();
    const defs = types.map(t => makeDef(allChecks, ch, globals, t)).flat();

    return [
        ...header,
        ...defs,
    ];
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

function makeDef(allChecks: Map<ts.Type, string>, ch: ts.TypeChecker, globals: Globals, n: ts.TypeAliasDeclaration): ts.Node[] {
    const [ checkFn, deps ] = makeCheckFn(allChecks, n.name.text, ch, globals, n.type);
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

function print(sf: ts.SourceFile, nodes: ts.Node[]): string {
    const printer = ts.createPrinter();
    const l = ts.createNodeArray(nodes);

    return printer.printList(ts.ListFormat.MultiLine, l, sf);
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
    if (isTypeReference(t) && !!node && ts.isArrayTypeNode(node)) {
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

function makeCheckFn(allChecks: Map<ts.Type, string>, name: string, ch: ts.TypeChecker, globals: Globals, node: ts.TypeNode): [ ts.VariableDeclarationList, ts.TypeAliasDeclaration[] ] {
    const checkName = 'check' + ucfirst(name);
    allChecks.set(ch.getTypeFromTypeNode(node), checkName);

    const [ check, deps ] = makeCheck(allChecks, ch, globals, node, false, true);
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

function makeCheck(allChecks: Map<ts.Type, string>, ch: ts.TypeChecker, globals: Globals, node: ts.TypeNode, optional = false, skipExisting = false): [ ts.Expression, ts.TypeAliasDeclaration[] ] {
    if (optional) {
        const [ check, deps ] = makeCheck(allChecks, ch, globals, node, false);
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

    const typ = ch.getTypeAtLocation(node);

    if (!skipExisting) {
        const existing = allChecks.get(typ);
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

    if (typ === globals.Date) {
        return [ ts.createIdentifier('runtime.checkDate'), deps ];
    }

    const ok = isLiteral(ch, typ);
    if (ok) {
        const arg = ts.createIdentifier(ch.typeToString(typ));
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
            const [ t, d2 ] = makeCheck(allChecks, ch, globals, typ);
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
        const [ arg, d2 ] = makeCheck(allChecks, ch, globals, eltyp);
        return [
            ts.createCall(
                ts.createIdentifier('runtime.checkArrayOf'), [], [ arg ],
            ),
            [ ...deps, ...d2 ],
        ];
    } 

    if (isObject(typ)) {
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

            const [ check, d2 ] = makeCheck(allChecks, ch, globals, subnode, optional);
            deps = [ ...deps, ...d2 ];

            assignments.push(ts.createPropertyAssignment(props[k].name, check));
        }

        const arg = ts.createObjectLiteral(assignments, true);
        return [
            ts.createCall(
                ts.createIdentifier('runtime.checkShapeOf'), [], [ arg ],
            ),
            deps,
        ];
    }

    if (ts.isUnionTypeNode(node)) {
        const args = node.types.map(t => {
            const [ check, d2 ] = makeCheck(allChecks, ch, globals, t);
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
            const [ check, d2 ] = makeCheck(allChecks, ch, globals, t);
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

    throw new Error("Invalid type at " + ch.typeToString(typ));
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function printNode(n: ts.Node): string {
    const printer = ts.createPrinter();
    return printer.printNode(ts.EmitHint.Unspecified, n, ts.createSourceFile('', '', ts.ScriptTarget.ES2015, void 0, void 0));
}
