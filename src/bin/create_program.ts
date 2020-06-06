import * as ts from 'typescript';
import { join, dirname } from 'path';
import { readFileSync, existsSync } from 'fs';
// import log from '@jonasi/jslog';

export type Globals = {
    Date: ts.Type,
    Record: ts.Type,
};

export const virtualFile = {
    name:     '__generated__/@jonasi/ts-models/virtual_file.ts',
    contents: `
declare var date: Date;
declare var rec: Record<string, unknown>;
`,
};

export default function createProgram(file: string): ts.Program {
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
    const diagnostics = ts.getPreEmitDiagnostics(prog);

    if (diagnostics.length) {
        const hasError = !!diagnostics.find(d => d.category === ts.DiagnosticCategory.Error);
        if (hasError) {
            // throw new Error('Errors found in program: \n' + ts.formatDiagnosticsWithColorAndContext(diagnostics, host));
        }

        // log.warn('Program diagnostics', ts.formatDiagnosticsWithColorAndContext(diagnostics, host));
    }

    return prog;
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

export function getGlobals(prog: ts.Program): Globals {
    const ch = prog.getTypeChecker();
    const vf = prog.getSourceFile(virtualFile.name) as ts.SourceFile;

    return {
        Date: ch.getTypeFromTypeNode(
            (vf.statements[0] as ts.VariableStatement).declarationList.declarations[0].type as ts.TypeNode
        ),
        Record: ch.getTypeFromTypeNode(
            (vf.statements[1] as ts.VariableStatement).declarationList.declarations[0].type as ts.TypeNode
        ),
    };
}
