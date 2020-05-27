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

type ShapeCheck<T extends Record<string, unknown>> = { [P in keyof T]: Check<T[P]> };

export function checkShapeOf<T extends Record<string, unknown>>(checks: ShapeCheck<T>): Check<T> {
    return makeCheck('shapeOf', (js, path) => {
        const obj = checkObject(js, path);
        const ret: Partial<T> = {};
        for (const k in checks) {
            const v = checks[k](obj[k], `${ path }.${ k }`);
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
