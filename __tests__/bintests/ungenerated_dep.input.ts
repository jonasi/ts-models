type UngeneratedT = {
    str: string;
};

type UngeneratedT2 = {
    ok: string;
};

// @jonasi/ts-models generate
type GeneratedT = {
    dep: UngeneratedT,
    depArr: UngeneratedT2[],
};
