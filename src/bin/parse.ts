import * as ts from 'typescript';
import parseProgram from './parse_program';
import createProgram, { getGlobals } from './create_program';
import { fileToString } from './print';
import { Context, AcceptableDefT } from './context';
import { makeCheck, makeCheckDeferred } from './checks';
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

type NodeWithFile = { file: ts.SourceFile, node: AcceptableDefT };

function createModels(prog: ts.Program): { node: ts.Node, file: ts.SourceFile }[] {
    const ctx: Context = {
        globals:              getGlobals(prog),
        checker:              prog.getTypeChecker(),
        allChecks:            new Map(),
        propertyMappers:      new Map(),
        activePropertyMapper: void 0,
    };

    const types = parseProgram(prog);
    const togen: NodeWithFile[] = [];

    types.forEach(t => {
        switch (t.type) {
            case 'generate_type':
                togen.push(t);
                break;
            case 'type_options':
                if (t.propertyMapper) {
                    const typ = ctx.checker.getTypeAtLocation(t.node);
                    ctx.propertyMappers.set(typ, t.propertyMapper);
                }
                break;
        }
    });

    return makeDefs(ctx, togen).map(n => n.nodes.map(node => ({ node, file: n.node.file }))).flat();
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

function makeDefs(ctx: Context, nodes: NodeWithFile[]): { node: NodeWithFile, nodes: ts.Node[] }[] {
    const ret = [];
    let seen: AcceptableDefT[] = [];

    for (const node of nodes) {
        const n = node.node;
        const [ checkFn, deps ] = makeCheckFn(ctx, n.name.text, ts.isTypeAliasDeclaration(n) ? n.type : n);
        const allTypes = [ n, ...deps ]
            .filter((t, i, arr) => arr.indexOf(t) === i)
            .filter(t => seen.indexOf(t) === -1);

        seen = [ ...seen, ...allTypes ];

        ret.push({
            node,
            nodes: [
                ...allTypes.map(n => makeType(n)),
                checkFn,
                makeFn(n),
                makeFnArr(n),
            ],
        });
    }

    return ret;
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
