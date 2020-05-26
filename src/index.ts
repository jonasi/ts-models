export type JSONValue = null | string | number | boolean | JSONValue[] | { [prop: string]: JSONValue };

interface Check<T> {
    (js: JSONValue): [ T ] | undefined;
    id: string;
}

type CheckArr<T extends [ unknown ] | unknown[]> = { [P in keyof T]: Check<T[P]> };

export function assert<T>(js: JSONValue, check: Check<T>): T {
    const v = check(js);
    if (v) {
        return v[0];
    }

    throw new Error("Value failed " + check.id);
}

function makeCheck<T>(id: string, fn: (js: JSONValue) => [ T ] | undefined): Check<T> {
    const ch = (js: JSONValue): [ T ] | undefined => fn(js);
    ch.id = id;

    return ch;
}

export const checkEmpty = makeCheck('empty', js => js === void 0 || js === null ? [ void 0 ] : void 0);
export const checkString = makeCheck('string', js => typeof js === 'string' ? [ js ] : void 0);
export const checkBoolean = makeCheck('boolean', js => typeof js === 'boolean' ? [ js ] : void 0);
export const checkNumber = makeCheck('number', js => typeof js === 'number' ? [ js ] : void 0);
export const checkObject = makeCheck('object', js => typeof js === 'object' && js && !Array.isArray(js) ? [ js ] : void 0);
export const checkArray = makeCheck('array', js => Array.isArray(js) ? [ js ] : void 0);

export function checkOr<T extends [ unknown ] | unknown[]>(checks: CheckArr<T>): Check<T[number]> {
    // eslint-disable-next-line
    // @ts-ignore
    const id = 'or(' + checks.map(c => c.id).join(', ') + ')';
    return makeCheck(id, js => {
        for (const i in checks) {
            const v = checks[i](js);
            if (v) {
                return v;
            }
        }
    });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never;

export function checkAnd<T extends [ unknown ] | unknown[]>(checks: CheckArr<T>): UnionToIntersection<Check<T[number]>> {
    // eslint-disable-next-line
    // @ts-ignore
    const id = 'and(' + checks.map(c => c.id).join(', ') + ')';
    return makeCheck(id, js => {
        const obj = {};
        for (const i in checks) {
            const v = checks[i](js);
            if (!v) {
                return v;
            }

            Object.assign(obj, v[0]);
        }

        return [ obj ];
    });
}

export function checkArrayOf<T>(check: Check<T>): Check<T[]> {
    const id = 'arrayOf(' + check.id + ')';
    return makeCheck(id, js => {
        const arr = checkArray(js);
        if (!arr) {
            return;
        }

        const ret = [];
        for (const v of arr) {
            const checked = check(v);
            if (!checked) {
                return;
            }
            ret.push(checked[0]);
        }

        return [ ret ];
    });
}

type ShapeCheck<T extends Record<string, unknown>> = { [P in keyof T]: Check<T[P]> };

export function checkShapeOf<T extends Record<string, unknown>>(checks: ShapeCheck<T>): Check<T> {
    return makeCheck('shapeOf', js => {
        const obj = checkObject(js);
        if (!obj) {
            return void 0;
        }

        const ret: Partial<T> = {};
        for (const k in checks) {
            const v = checks[k](obj[0][k]);
            if (!v) {
                return;
            }

            ret[k] = v[0];
        }

        return [ ret ] as [ T ];
    });
}

export function checkLiteralOf<T extends JSONValue>(v: T): Check<T> {
    return makeCheck(`literalOf(${ v })`, js => {
        if (js === v) {
            return [ js ] as [ T ];
        }

        return;
    });
}
