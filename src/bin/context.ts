import * as ts from 'typescript';
import { Globals } from './create_program';

export type AcceptableDefT = ts.TypeAliasDeclaration | ts.EnumDeclaration;

export type Context = {
    checker: ts.TypeChecker,
    globals: Globals,
    allChecks: Map<ts.Type, [ ts.Expression, AcceptableDefT[] ]>;
    propertyMappers: Map<ts.Type, string>;
    activePropertyMapper: string | undefined;
};
