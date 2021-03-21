// undefined isn't really a json type, but we often encounter it with missing keys
export type JSONValue = undefined | null | string | number | boolean | JSONValue[] | { [prop: string]: JSONValue };

export interface Check<T> {
    (js: JSONValue, path: string): T;
    id: string;
}

export class CheckError extends Error {
    path: string;
    constructor(message: string, path: string) {
        message = `Check error at ${ path }: ${ message }`;
        super(message);
        this.path = path;

        // https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
        Object.setPrototypeOf(this, CheckError.prototype);
    }
}

type CheckArr<T extends [ unknown ] | unknown[]> = { [P in keyof T]: Check<T[P]> };

export type PropertyMapper = (property: string) => string;

export function assert<T>(js: JSONValue, check: Check<T>): T {
    return check(js, '');
}

function makeCheck<T>(id: string, fn: (js: JSONValue, path: string) => T): Check<T> {
    const ch = (js: JSONValue, path: string): T => fn(js, path);
    ch.id = id;

    return ch;
}

function isEmpty(v: unknown): boolean {
    return v === void 0 || v === null;
}

export const checkEmpty = makeCheck('empty', (js, path) => {
    if (isEmpty(js)) {
        return void 0;
    }

    throw new CheckError('Expected null or undefined and found ' + (typeof js), path);
});

export const checkUnknown = makeCheck('unknown', js => js);

export const checkString = makeCheck('string', (js, path) => {
    if (typeof js === 'string') {
        return js;
    } else if (isEmpty(js)) {
        return '';
    }

    throw new CheckError('Expected a string and found ' + (typeof js), path);
});

export const checkBoolean = makeCheck('boolean', (js, path) => {
    if (typeof js === 'boolean') {
        return js;
    }

    throw new CheckError('Expected a boolean and found ' + (typeof js), path);
});

export const checkNumber = makeCheck('number', (js, path) => {
    if (typeof js === 'number') {
        return js;
    }

    throw new CheckError('Expected a number and found ' + (typeof js), path);
});

export const checkObject = makeCheck('object', (js, path) => {
    if (typeof js === 'object' && js && !Array.isArray(js)) {
        return js;
    }

    throw new CheckError('Expected an object and found ' + (typeof js), path);
});

export const checkArray = makeCheck('array', (js, path) => {
    if (Array.isArray(js)) {
        return js;
    } else if (isEmpty(js)) {
        return [];
    }

    throw new CheckError('Expected an array and found ' + (typeof js), path);
});

export const checkDate = makeCheck('date', (js, path) => {
    if (typeof js === 'string' || typeof js === 'number') {
        return new Date(js);
    }

    throw new CheckError('Expected a string or number and found ' + (typeof js), path);
});

export function checkOr<T extends [ unknown ] | unknown[]>(checks: CheckArr<T>): Check<T[number]> {
    // eslint-disable-next-line
    // @ts-ignore
    const id = 'or(' + checks.map(c => c.id).join(', ') + ')';
    return makeCheck(id, (js, path) => {
        for (const i in checks) {
            try {
                return checks[i](js, path);
            } catch (err) {}
        }

        throw new CheckError('No check matches or condition', path);
    });
}

// https://stackoverflow.com/questions/50374908/transform-union-type-to-intersection-type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never;

export function checkAnd<T extends [ unknown ] | unknown[]>(checks: CheckArr<T>): Check<UnionToIntersection<T[number]>> {
    // eslint-disable-next-line
    // @ts-ignore
    const id = 'and(' + checks.map(c => c.id).join(', ') + ')';
    return makeCheck(id, (js, path) => {
        const obj = {};
        for (const i in checks) {
            const v = checks[i](js, path);
            Object.assign(obj, v);
        }

        return obj as UnionToIntersection<T[number]>;
    });
}

export function checkArrayOf<T>(check: Check<T>): Check<T[]> {
    const id = 'arrayOf(' + check.id + ')';
    return makeCheck(id, (js, path) => checkArray(js, path).map((item, i) => (
        check(item, `${ path }[${ i }]`)
    )));
}

type ShapeCheck<T> = { [P in keyof T]: Check<T[P]> };

type ShapeOfOptions = {
    propertyMapper: PropertyMapper;
};

export function checkShapeOf<T>(checks: ShapeCheck<T>, options?: ShapeOfOptions): Check<T> {
    return makeCheck('shapeOf', (js, path) => {
        const obj = checkObject(js, path);
        const ret: Partial<T> = {};
        for (const k in obj) {
            const prop = (options?.propertyMapper(k) || k) as keyof T;
            if (!checks[prop]) {
                continue;
            }

            const v = checks[prop](obj[k], `${ path }.${ prop }`);
            ret[prop] = v;
        }

        for (const k in checks) {
            if (k in ret) {
                continue;
            }

            const v = checks[k](void 0, `${ path }.${ k }`);
            ret[k] = v;
        }

        return ret as T;
    });
}

export function checkLiteralOf<T extends JSONValue>(v: T): Check<T> {
    return makeCheck(`literalOf(${ v })`, (js, path) => {
        if (js === v) {
            return js as T; 
        }

        throw new CheckError(`Expected ${ v } and found ${ js }`, path);
    });
}

type CheckTuple<T extends [ unknown ] | unknown[]> = { [ P in keyof T ]: Check<T[P]> } & { length: number };

export function checkTupleOf<T extends [ unknown ] | unknown[]>(checks: CheckTuple<T>): Check<T> {
    return makeCheck('tuple', (js, path) => {
        const arr = checkArray(js, path);
        if (arr.length !== checks.length) {
            throw new CheckError(`Expected array of length ${ checks.length }, but found array of length ${ arr.length }`, path);
        }

        // todo(isao) - fix typing
        return arr.map((v, i) => checks[i](v, `${ path }[${ i }]`)) as T;
    });
}

export function checkRecordOf<V>(check: Check<V>, options?: { propertyMapper: PropertyMapper } ): Check<Record<string, V>> {
    return makeCheck('record', (js, path) => {
        const obj = checkObject(js, path);
        const ret: Record<string, V> = {};

        for (const k in obj) {
            const prop = options?.propertyMapper(k) || k;
            ret[prop] = check(obj[k], `${ path }.${ prop }`);
        }

        return ret;
    });
}

export function checkDeferred<T>(check: () => Check<T>): Check<T> {
    let ch: Check<T> | undefined;

    const ret = makeCheck('deferred', (id, js) => {
        if (!ch) {
            ch = check();
            ret.id = ch.id;
        }

        return ch(id, js);
    });

    return ret;
}

export function toLower(str: string): string {
    return str.toLowerCase();
}

export function toLowerSnake(str: string): string {
    return str.replace(/[a-z][A-Z]/, v => v[0] + '_' + v[1].toLowerCase()).toLowerCase();
}
