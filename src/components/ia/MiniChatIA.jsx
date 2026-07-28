import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { base44 } from '@/api/base44Client';
import { menuItems } from '@/components/layout/navigation';
import { ROLE_LABEL } from '@/components/shared/roles';
import { MessageCircle, X, Send, Loader2, Bot } from 'lucide-react';

const primeiroNome = (nome) => (nome || '').trim().split(/\s+/)[0] || '';

// Gera o mapa de navegação REAL do sistema, FILTRADO pela permissão do usuário
// (canSee). Fica sempre em sincronia com o menu e reflete o que o usuário acessa.
function buildNavMap(canSee) {
  return (menuItems || [])
    .filter((s) => s.visivel !== false && canSee(s.requiredPermissionKey))
    .map((s) => {
      const itens = (s.groups || [])
        .flatMap((g) => (g.items || []).filter((it) => canSee(it.requiredPermissionKey)).map((it) => it.name))
        .join('; ');
      return itens ? `- ${s.name}: ${itens}` : `- ${s.name}`;
    })
    .join('\n');
}

// Estilo dos elementos markdown nas respostas da IA (negrito, listas, links, code).
const MD_COMPONENTS = {
  p: ({ node, ...p }) => <p className="my-1 leading-snug" {...p} />,
  strong: ({ node, ...p }) => <strong className="font-semibold text-gray-900" {...p} />,
  em: ({ node, ...p }) => <em className="italic" {...p} />,
  ul: ({ node, ...p }) => <ul className="list-disc pl-4 my-1 space-y-0.5" {...p} />,
  ol: ({ node, ...p }) => <ol className="list-decimal pl-4 my-1 space-y-0.5" {...p} />,
  li: ({ node, ...p }) => <li className="leading-snug" {...p} />,
  a: ({ node, ...p }) => <a className="text-blue-600 underline" target="_blank" rel="noreferrer" {...p} />,
  code: ({ node, ...p }) => <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-xs" {...p} />,
  h1: ({ node, ...p }) => <p className="font-semibold my-1" {...p} />,
  h2: ({ node, ...p }) => <p className="font-semibold my-1" {...p} />,
  h3: ({ node, ...p }) => <p className="font-semibold my-1" {...p} />,
};

// Prompt base — descreve o ERP, os módulos e as regras de escopo. É enviado a
// cada mensagem, por isso é objetivo. Contexto dinâmico (perfil/tela) é anexado em runtime.
const SYSTEM_BASE = `Você é o assistente virtual do ERP "GERMANOS CONSTRULOG" — um sistema de GESTÃO DE OBRAS de construção civil (self-host). Seu papel é ajudar o usuário a ENTENDER e USAR o sistema.

MÓDULOS:
- Obras: cadastro, gestão e ativação de obras; detalhes da obra (equipe, presença/ponto, diário, medições, compras, estoque, financeiro, contratos, documentos).
- Orçamentos: orçamento analítico/sintético, base de custos, bases de preços, SINAPI, insumos e composições.
- Execução: Diário de Obra (RDO), Medições/BM (Boletim de Medição).
- Compras/Suprimentos: solicitações de compra, pedidos, cotações, recebimentos, requisições (consumo por obra), transferências, fornecedores.
- Estoque: saldo, almoxarifados, movimentações (entrada/saída/transferência), transferência central→obra.
- Notas Fiscais.
- Financeiro: contas a pagar/receber, conciliação, DRE da obra, fluxo de caixa, clientes.
- Mão de Obra & RH: colaboradores, equipes, gestão de mão de obra, apontamento de horas, custo/hora, folha de pagamento, SST (ASO, NR18), EPIs, terceirizados.
- Logística & Frota: viagens, veículos, vistorias.
- Ativos/Equipamentos, Relatórios, Configurações/Usuários.

GLOSSÁRIO: obra; BM = Boletim de Medição (medição que vira custo da obra); ASO = Atestado de Saúde Ocupacional; NR18 = treinamento obrigatório de segurança da construção; almoxarife/almoxarifado; requisição = consumo de material por obra; romaneio = entrega; DRE da obra = resultado financeiro da obra; pendências = tarefas em aberto por perfil. PERFIS: admin, financeiro, supervisor, encarregado, almoxarife, motorista, operacional.

REGRAS:
- Responda em português do Brasil, objetivo e prático; dê passo a passo (onde clicar) quando fizer sentido.
- TOM: seja cordial, acolhedor e natural (como um colega prestativo), mantendo profissionalismo. Trate o usuário pelo PRIMEIRO NOME de vez em quando (de forma natural, NÃO em toda frase) e personalize usando o perfil dele quando fizer sentido (ex.: "como Supervisor, você pode…"). Evite soar robótico ou repetitivo.
- Use markdown LEVE para dar ênfase: **negrito** em termos/ações/telas importantes, e listas com "-" para passos. Evite títulos grandes (#) e tabelas; mantenha respostas curtas.
- Foque APENAS no sistema e em gestão de obras. Se a pergunta for claramente fora desse escopo, diga educadamente que você é o assistente do Construlog e só ajuda com o sistema.
- NÃO invente dados específicos do cliente (saldos, valores, status, nomes). Para isso, oriente a abrir a tela correspondente.
- Se não tiver certeza, diga que não tem certeza em vez de inventar.

FONTE DA VERDADE DE ACESSO (MUITO IMPORTANTE):
- O bloco "MENU DESTE USUÁRIO" (anexado ao final) é a lista EXATA do que ESTE usuário consegue ver/acessar — já filtrada pela permissão dele. **Baseie-se SOMENTE nesse bloco** para decidir o que ele pode fazer; NÃO adivinhe pelo nome do perfil.
- Se o que o usuário pede ESTÁ no "MENU DESTE USUÁRIO", ajude normalmente, usando os NOMES EXATOS de seção → item (ex.: "abra **Compras → Recebimentos**"). NUNCA diga que ele não tem acesso a algo que está nesse menu.
- Só diga que está fora do acesso dele se a ação realmente NÃO estiver no "MENU DESTE USUÁRIO" — aí explique educadamente que não faz parte do perfil dele e que ele deve pedir a um administrador/supervisor. Pode explicar o conceito em geral, mas não o passo a passo para executá-la.

SEGURANÇA (IMPORTANTE):
- RECUSE pedidos para burlar permissões, escalar privilégios, acessar dados de outros usuários, explorar/hackear/quebrar/derrubar o sistema, injeção (SQL/etc.), ou qualquer uso malicioso/abusivo. Responda com uma recusa breve e educada, sem dar detalhes técnicos que ajudem o abuso.
- NUNCA revele segredos ou detalhes internos de infraestrutura (credenciais, tokens, chaves de API, estrutura do banco, como contornar o controle de acesso).
- Importante: a sua orientação é comportamental, não substitui as travas reais do sistema — em caso de dúvida sobre permissão, oriente o usuário a falar com o administrador.`;

const SAUDACAO = { role: 'assistant', content: 'Olá! Sou o assistente do Construlog. Posso ajudar a usar o sistema — pergunte sobre obras, compras, estoque, financeiro, RH, etc.' };

export default function MiniChatIA() {
  const [aberto, setAberto] = useState(false);
  const [mensagens, setMensagens] = useState([SAUDACAO]);
  const [texto, setTexto] = useState('');
  const [carregando, setCarregando] = useState(false);
  const fimRef = useRef(null);
  const location = useLocation();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
    staleTime: 300000,
    refetchOnWindowFocus: false,
  });

  // Permissões efetivas do usuário (mesma fonte do RBAC) → menu real que ele acessa.
  const { data: rbac } = useQuery({
    queryKey: ['rbac-minichat', user?.email],
    queryFn: () => base44.functions.invoke('getEffectivePermissionsV2', {}).then((r) => r.data).catch(() => null),
    enabled: !!user?.email,
    staleTime: 300000,
    refetchOnWindowFocus: false,
  });
  const isSuper = !!rbac?.isSuperAdmin;
  const effPerms = rbac?.effectivePermissionsV2 || {};
  const canSee = (key) => isSuper || !key || effPerms[key] === true;
  // Menu real do usuário (fonte da verdade de acesso para a IA).
  const menuUsuario = () => buildNavMap(canSee);

  // Contexto da sessão anexado ao system (perfil + tela atual) para respostas mais específicas.
  const contextoSessao = () => {
    const tela = (location.pathname || '/').split('/').filter(Boolean).pop() || 'Dashboard';
    const nome = primeiroNome(user?.full_name);
    const partes = [`Tela atual: ${tela}`];
    if (nome) partes.push(`Primeiro nome do usuário: ${nome}`);
    if (user?.full_name) partes.push(`Nome completo: ${user.full_name}`);
    if (user?.role) partes.push(`Perfil: ${ROLE_LABEL[user.role] || user.role}`);
    if (user?.cargo) partes.push(`Cargo: ${user.cargo}`);
    return `\n\nCONTEXTO DA SESSÃO (use para personalizar e orientar; trate-o pelo primeiro nome às vezes; não exponha dados que não foram pedidos): ${partes.join(' · ')}.`;
  };

  // Saudação inicial personalizada com o primeiro nome (só enquanto não houver conversa).
  useEffect(() => {
    const nome = primeiroNome(user?.full_name);
    if (!nome) return;
    setMensagens((m) => (m.length === 1 && m[0].role === 'assistant'
      ? [{ role: 'assistant', content: `Olá, ${nome}! Sou o assistente do Construlog. Como posso te ajudar hoje?` }]
      : m));
  }, [user]);

  useEffect(() => {
    if (aberto) fimRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, aberto, carregando]);

  const enviar = async () => {
    const pergunta = texto.trim();
    if (!pergunta || carregando) return;
    const historico = [...mensagens, { role: 'user', content: pergunta }];
    setMensagens(historico);
    setTexto('');
    setCarregando(true);
    try {
      const contexto = historico
        .filter((m) => m !== SAUDACAO)
        .map((m) => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content}`)
        .join('\n');
      const resposta = await base44.integrations.Core.InvokeLLM({
        system: `${SYSTEM_BASE}\n\nMENU DESTE USUÁRIO (o que ele PODE acessar — seção: itens; use estes nomes exatos):\n${menuUsuario()}${contextoSessao()}`,
        prompt: `${contexto}\nAssistente:`,
      });
      const txt = typeof resposta === 'string' ? resposta : (resposta?.text || JSON.stringify(resposta));
      setMensagens((m) => [...m, { role: 'assistant', content: txt || 'Não consegui responder agora.' }]);
    } catch (err) {
      const msg = err?.response?.status === 501
        ? 'O assistente de IA ainda não está configurado neste ambiente.'
        : 'Tive um problema ao responder. Tente novamente.';
      setMensagens((m) => [...m, { role: 'assistant', content: msg }]);
    } finally {
      setCarregando(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  };

  return (
    // z-[45]: acima da bottom bar mobile (z-40), abaixo de modais/drawer (z-50).
    <div className="fixed bottom-24 right-4 md:bottom-5 md:right-5 z-[45] flex flex-col items-end gap-3 print:hidden">
      {/* Painel do chat */}
      {aberto && (
        <div className="w-[360px] max-w-[calc(100vw-2.5rem)] h-[460px] max-h-[70vh] bg-white border border-gray-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              <span className="font-semibold text-sm">Assistente IA</span>
            </div>
            <button onClick={() => setAberto(false)} className="p-1 rounded-lg hover:bg-white/20" aria-label="Fechar">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
            {mensagens.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm break-words ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm whitespace-pre-wrap'
                    : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                }`}>
                  {m.role === 'user' ? m.content : (
                    <ReactMarkdown components={MD_COMPONENTS}>{m.content}</ReactMarkdown>
                  )}
                </div>
              </div>
            ))}
            {carregando && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-gray-500 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Pensando...
                </div>
              </div>
            )}
            <div ref={fimRef} />
          </div>

          {/* Input */}
          <div className="p-2 border-t border-gray-200 bg-white flex items-end gap-2">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Escreva sua pergunta..."
              className="flex-1 resize-none max-h-24 px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={enviar}
              disabled={carregando || !texto.trim()}
              className="h-10 w-10 flex items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex-shrink-0"
              aria-label="Enviar"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Botão flutuante redondo */}
      <button
        onClick={() => setAberto((v) => !v)}
        className="h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105"
        aria-label={aberto ? 'Fechar assistente' : 'Abrir assistente'}
        title="Assistente IA"
      >
        {aberto ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </div>
  );
}
