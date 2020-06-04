import * as ts from 'typescript';
import * as arg from 'arg';
import * as shellquote from 'shell-quote';

const commentPrefix = '@jonasi/ts-models ';

export type ParsedNode = 
    | { type: 'generate_type', node: ts.TypeAliasDeclaration }
    | { type: 'type_options', node: ts.TypeAliasDeclaration, propertyMapper: string | undefined };

const optionsArgs = {
    '--property-mapper': String,
};

export default function parseProgram(pr: ts.Program): ParsedNode[] {
    const nodes: ParsedNode[] = [];

    for (const f of pr.getSourceFiles()) {
        if (!f.isDeclarationFile) {
            const sl = f.getChildren(f).find(n => n.kind === ts.SyntaxKind.SyntaxList);
            if (!sl) {
                continue;
            }

            sl.getChildren(f).forEach(node => {
                if (!ts.isTypeAliasDeclaration(node)) {
                    return;
                }

                const c = comments(f, node);
                if (!c) {
                    return;
                }
                const gen = c.find(v => v.startsWith(commentPrefix));
                if (!gen) {
                    return;
                }

                const [ action, ...rest ] = shellquote.parse(gen.substr(commentPrefix.length).trim());
                const argv = rest.filter(f => typeof f === 'string') as string[];

                switch (action) {
                    case 'generate': {
                        const opts = arg(optionsArgs, { argv });
                        nodes.push({ 
                            type: 'generate_type', 
                            node,
                        });
                        nodes.push({
                            type:           'type_options', 
                            node,
                            propertyMapper: opts['--property-mapper'],
                        });
                        break;
                    }
                    case 'options': {
                        const opts = arg(optionsArgs, { argv });
                        nodes.push({
                            type:           'type_options', 
                            node,
                            propertyMapper: opts['--property-mapper'],
                        });
                        break;
                    }
                    default:
                        throw new Error('Invalid pragma found: ' + gen);
                }
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

