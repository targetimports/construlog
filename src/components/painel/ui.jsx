import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// BLOCOS DE UI DO PAINEL — fonte única de estilo.
//
// Todas as telas do back-office montam a partir daqui. É o que evita o problema
// clássico de cada página inventar seu próprio cabeçalho, seu próprio card de
// número e seu próprio vazio — e a interface ir ficando desalinhada tela a tela.
//
// Regras do padrão:
//   título de página  → text-2xl font-bold, subtítulo text-sm text-gray-500
//   cartão            → bg-white border-gray-200 rounded-xl
//   número            → text-xl font-bold, rótulo text-xs text-gray-500
//   tabela            → cabeçalho bg-gray-50, linhas divide-y divide-gray-100
//   ação principal    → bg-blue-600, secundária → variant="outline"

/** Cabeçalho de página: título, subtítulo e ações à direita. */
export function CabecalhoPagina({ subtitulo, children }) {
  // Sem título aqui de propósito: quem nomeia a tela é a barra do topo
  // (LayoutPainel), fonte única. Este bloco fica com a linha que explica a tela e
  // com os botões de ação.
  if (!subtitulo && !children) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="min-w-0">
        {subtitulo && <p className="text-sm text-gray-500">{subtitulo}</p>}
      </div>
      {children && <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">{children}</div>}
    </div>
  );
}

/** Cartão de número. `tom` pinta só o valor — o rótulo é sempre cinza. */
export function CardNumero({ rotulo, valor, detalhe, icone: Icone, tom = 'neutro' }) {
  const cores = {
    neutro: 'text-gray-900',
    positivo: 'text-emerald-700',
    info: 'text-blue-700',
    alerta: 'text-amber-700',
    negativo: 'text-red-600',
  };
  return (
    <Card className="bg-white border-gray-200">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          {Icone && <Icone className="w-4 h-4 text-gray-400 shrink-0" />}
          <span className="text-xs text-gray-500 font-medium truncate">{rotulo}</span>
        </div>
        <p className={`text-xl font-bold ${cores[tom] || cores.neutro}`}>{valor}</p>
        {detalhe && <p className="text-xs text-gray-400 mt-0.5">{detalhe}</p>}
      </CardContent>
    </Card>
  );
}

/** Grade de cartões de número — 2 colunas no celular, 4 no desktop. */
export function GradeNumeros({ children }) {
  return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">{children}</div>;
}

/** Etiqueta de status. Um só lugar decidindo a cor de cada situação. */
export function Etiqueta({ tom = 'neutro', children }) {
  const cores = {
    neutro: 'bg-gray-100 text-gray-600',
    positivo: 'bg-emerald-100 text-emerald-800',
    info: 'bg-blue-100 text-blue-800',
    alerta: 'bg-amber-100 text-amber-800',
    negativo: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cores[tom] || cores.neutro}`}>
      {children}
    </span>
  );
}

/** Cartão que embrulha tabela/lista. `semPadding` para tabelas coladas na borda. */
export function Painel({ titulo, acao, children, semPadding = false }) {
  return (
    <Card className="bg-white border-gray-200">
      {(titulo || acao) && (
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          {titulo && <h2 className="font-semibold text-gray-900">{titulo}</h2>}
          {acao}
        </div>
      )}
      <CardContent className={semPadding ? 'p-0' : 'p-5'}>{children}</CardContent>
    </Card>
  );
}

/** Estado vazio: ícone, frase e (opcionalmente) uma ação. */
export function Vazio({ icone: Icone, titulo, descricao, acao, onAcao }) {
  return (
    <div className="text-center py-16 px-6">
      {Icone && <Icone className="w-10 h-10 text-gray-300 mx-auto mb-3" />}
      <p className="font-medium text-gray-900">{titulo}</p>
      {descricao && <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">{descricao}</p>}
      {acao && (
        <Button onClick={onAcao} className="mt-6 bg-blue-600 hover:bg-blue-700">{acao}</Button>
      )}
    </div>
  );
}

/** Cabeçalho de tabela — mesma altura, mesmo cinza, em toda tela. */
export function TabelaCabecalho({ colunas }) {
  return (
    <thead className="bg-gray-50 border-b border-gray-200">
      <tr>
        {colunas.map((c, i) => (
          <th
            key={i}
            className={`p-3 text-xs font-semibold text-gray-600 ${
              c.alinhamento === 'direita' ? 'text-right' : c.alinhamento === 'centro' ? 'text-center' : 'text-left'
            } ${c.largura || ''}`}
          >
            {c.titulo}
          </th>
        ))}
      </tr>
    </thead>
  );
}

/** Filtros em pílula (Todas / Pendentes / ...). */
export function FiltroPilulas({ opcoes, valor, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {opcoes.map(([chave, rotulo]) => (
        <button
          key={chave}
          type="button"
          onClick={() => onChange(chave)}
          className={`rounded-full px-4 h-9 text-sm font-medium transition-colors ${
            valor === chave
              ? 'bg-gray-900 text-white'
              : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
          }`}
        >
          {rotulo}
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────── formatadores ───────────────────────────
   Aqui também, para o mesmo valor não aparecer de dois jeitos em telas
   diferentes (o tipo de detalhe que faz a interface parecer remendada). */

export const fmtBRL = (v) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const fmtData = (d) =>
  (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—');

export const fmtDataHora = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
};

export const hojeISO = () => new Date().toISOString().slice(0, 10);
export const competenciaAtual = () => new Date().toISOString().slice(0, 7);

/** "há 3 dias", "há 2 h" — para última sincronização/último contato. */
export const desde = (iso) => {
  if (!iso) return 'nunca';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return '—';
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} dia${d > 1 ? 's' : ''}`;
};
