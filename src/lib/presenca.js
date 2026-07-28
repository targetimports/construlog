// Fonte única das regras de PRESENÇA/PONTO.
//
// O que importa para todo o resto do sistema é o campo `horas_normais` gravado no
// ApontamentoMaoObra: a folha (hora extra), o detalhamento por obra e a DRE
// (maoObraCore) leem SÓ as horas. Então o tipo de presença define as horas aqui,
// num lugar só, e o resto se ajusta sozinho.
//
// Jornada: dia todo = 8h; meio período (manhã ou tarde) = 4h; ausências = 0h.

export const JORNADA_DIA = 8;
export const JORNADA_MEIO = JORNADA_DIA / 2;

export const PRESENCA_INFO = {
  presente:          { label: 'Dia todo',          curto: 'Dia todo', horas: JORNADA_DIA,  presente: true  },
  manha:             { label: 'Só manhã',          curto: 'Manhã',    horas: JORNADA_MEIO, presente: true  },
  tarde:             { label: 'Só tarde',          curto: 'Tarde',    horas: JORNADA_MEIO, presente: true  },
  falta:             { label: 'Falta',             curto: 'Falta',    horas: 0,            presente: false },
  falta_justificada: { label: 'Falta justificada', curto: 'Just.',    horas: 0,            presente: false },
  atestado:          { label: 'Atestado',          curto: 'Atestado', horas: 0,            presente: false },
  licenca:           { label: 'Licença',           curto: 'Licença',  horas: 0,            presente: false },
};

// Opções oferecidas no Ponto/Presença (o dia a dia da obra).
export const OPCOES_PONTO = ['presente', 'manha', 'tarde', 'falta'];

export const horasDaPresenca = (p) => PRESENCA_INFO[p]?.horas ?? 0;
export const ehPresenca = (p) => !!PRESENCA_INFO[p]?.presente;      // conta como trabalhou (inteiro ou meio)
export const ehMeioPeriodo = (p) => p === 'manha' || p === 'tarde';
export const labelPresenca = (p) => PRESENCA_INFO[p]?.label || '—';
export const curtoPresenca = (p) => PRESENCA_INFO[p]?.curto || '—';

// Fração da jornada trabalhada (1 = dia todo, 0,5 = meio período, 0 = ausência).
// Usada para a DIÁRIA do diarista: meio período = meia diária.
export const fracaoDoDia = (p) => horasDaPresenca(p) / JORNADA_DIA;
