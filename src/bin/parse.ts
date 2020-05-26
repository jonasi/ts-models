import * as ts from 'typescript';
import { join, dirname } from 'path';
import { readFileSync, existsSync } from 'fs';
// import log from '@jonasi/jslog';

export function generateModels(file: string): string {
    const conf = loadConfig(file);
    const prog = ts.createProgram([ file ], conf.options);
    const nodes = createModels(prog);
    const f = prog.getSourceFile(file) as ts.SourceFile;
    return print(f, nodes);
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
    const types = parseModels(prog);
    const header = types.length ? makeHeader() : [];
    const defs = types.map(t => makeDef(ch, t)).flat();

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

function makeDef(ch: ts.TypeChecker, n: ts.TypeAliasDeclaration): ts.Node[] {
    return [
        makeType(n),
        makeCheckFn(n.name.text, ch, ch.getTypeAtLocation(n.type)),
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

function makeFn( n: ts.TypeAliasDeclaration): ts.Node {
    const fn = ts.createFunctionDeclaration(
        void 0,
        [ ts.createToken(ts.SyntaxKind.ExportKeyword) ],
        void 0,
        'jsonTo' + n.name.text,
        void 0,
        [ ts.createParameter(void 0, void 0, void 0, 'js', void 0, ts.createTypeReferenceNode('runtime.JSONValue', void 0)) ],
        ts.createTypeReferenceNode(n.name.text, void 0),
        ts.createBlock([
            ts.createReturn(makeAssert('js', ts.createIdentifier('check_' + n.name.text))),
        ], true),
    );

    return fn;
}

function makeFnArr( n: ts.TypeAliasDeclaration): ts.Node {
    const fn = ts.createFunctionDeclaration(
        void 0,
        [ ts.createToken(ts.SyntaxKind.ExportKeyword) ],
        void 0,
        'jsonTo' + n.name.text + 'Arr',
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
                    [ ts.createIdentifier('check_' + n.name.text) ]
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

function isArray(ch: ts.TypeChecker, t: ts.Type): ts.Type | undefined {
    const node = ch.typeToTypeNode(t);
    if (isTypeReference(t) && !!node && ts.isArrayTypeNode(node)) {
        return ch.getTypeArguments(t)[0];
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

function makeCheckFn(name: string, ch: ts.TypeChecker, typ: ts.Type): ts.VariableDeclarationList {
    const check = makeCheck(ch, typ);
    return ts.createVariableDeclarationList([
        ts.createVariableDeclaration(
            'check_' + name,
            ts.createTypeReferenceNode('runtime.Check', [ ts.createTypeReferenceNode(name, void 0) ]),
            check,
        ),
    ], ts.NodeFlags.Const);
}

function makeCheck(ch: ts.TypeChecker, typ: ts.Type): ts.Expression {
    if (isBoolean(typ)) {
        return ts.createIdentifier('runtime.checkBoolean');
    }
    if (isString(typ)) {
        return ts.createIdentifier('runtime.checkString');
    }
    if (isNumber(typ)) {
        return ts.createIdentifier('runtime.checkNumber');
    }
    if (isUndefined(typ)) {
        return ts.createIdentifier('runtime.checkEmpty');
    }

    const ok = isLiteral(ch, typ);
    if (ok) {
        const arg = ts.createIdentifier(ch.typeToString(typ));
        return ts.createCall(
            ts.createIdentifier('runtime.checkLiteralOf'), [], [ arg ],
        );
    }

    const eltyp = isArray(ch, typ);
    if (eltyp) {
        const arg = makeCheck(ch, eltyp);
        return ts.createCall(
            ts.createIdentifier('runtime.checkArrayOf'), [], [ arg ],
        );
    } 

    if (isObject(typ)) {
        const node = ch.typeToTypeNode(typ);
        if (!node) {
            throw new Error("Error converting type to node");
        }

        const assignments: ts.ObjectLiteralElementLike[] = [];
        const props = typ.getProperties();
        for (const k in props) {
            const elT = ch.getTypeAtLocation(props[k].valueDeclaration);
            const check = makeCheck(ch, elT);

            assignments.push(ts.createPropertyAssignment(props[k].name, check));
        }

        const arg = ts.createObjectLiteral(assignments, true);
        return ts.createCall(
            ts.createIdentifier('runtime.checkShapeOf'), [], [ arg ],
        );
    }

    if (typ.isUnion()) {
        const args = typ.types.map(t => makeCheck(ch, t));
        const arg = ts.createArrayLiteral(args as ts.Expression[], true);

        return ts.createCall(
            ts.createIdentifier('runtime.checkOr'), [], [ arg ],
        );
    }

    if (typ.isIntersection()) {
        const args = typ.types.map(t => makeCheck(ch, t));

        const arg = ts.createArrayLiteral(args as ts.Expression[], true);
        return ts.createCall(
            ts.createIdentifier('runtime.checkAnd'), [], [ arg ],
        );
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

// function printNode(n: ts.Node): string {
//     const printer = ts.createPrinter();
//     return printer.printNode(ts.EmitHint.Unspecified, n, ts.createSourceFile('', '', ts.ScriptTarget.ES2015, void 0, void 0));
// }
