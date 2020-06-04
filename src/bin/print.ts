import * as ts from 'typescript';

export function fileToString(sf: ts.SourceFile, nodes: ts.Node[]): string {
    const printer = ts.createPrinter();
    const l = ts.createNodeArray(nodes);

    return printer.printList(ts.ListFormat.MultiLine, l, sf);
}

export function nodeToString(n: ts.Node): string {
    const printer = ts.createPrinter();
    return printer.printNode(ts.EmitHint.Unspecified, n, ts.createSourceFile('', '', ts.ScriptTarget.ES2015, void 0, void 0));
}
