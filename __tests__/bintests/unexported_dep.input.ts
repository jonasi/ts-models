type UnexportedT = {
    str: string;
};

type UnexportedT2 = {
    ok: string;
};

// @jonasi/ts-models generate
type ExportedT = {
    dep: UnexportedT,
    depArr: UnexportedT2[],
};
