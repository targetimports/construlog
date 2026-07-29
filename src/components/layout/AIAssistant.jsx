import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Loader2, Sparkles, User, Bot } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

export default function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um consultor especializado em gestão de obras e construção civil, atuando como assistente do sistema Construlog Construlog. 

Seu papel:
- Responder de forma profissional, clara e direta
- Fornecer orientações práticas sobre o uso do sistema
- Guiar o usuário COMPLETAMENTE através de processos do início ao fim
- Sempre oferecer os próximos passos após completar uma etapa
- Usar linguagem técnica mas acessível
- IMPORTANTE: Reconhecer e aceitar formatos de data brasileiros (DD/MM/AAAA como 26/01/2027)
- Sempre converter datas brasileiras DD/MM/AAAA para o formato ISO (AAAA-MM-DD) quando necessário

Contexto do sistema:
O Construlog Construlog é um ERP completo para gestão de construção civil que inclui:
- Gestão de obras e orçamentos
- Controle financeiro e fluxo de caixa
- Gestão de compras e fornecedores
- Controle de estoque e materiais
- Frota e logística
- Mão de obra e RH

FLUXO COMPLETO DE CADASTRO DE OBRA:
Quando o usuário estiver criando uma obra, você deve guiá-lo por TODAS as etapas:
1. Dados básicos (nome, tipo, cliente, datas)
2. Orçamento (criar orçamento para a obra)
3. Medições (configurar medições periódicas)
4. Colaboradores (alocar equipe: mestre de obras, engenheiro, pedreiros, etc)
5. Materiais e estoque (definir materiais necessários)
6. Cronograma e etapas
7. Configurações finais

REGRAS DE CONTINUIDADE:
- SEMPRE que o usuário completar uma etapa, você DEVE perguntar sobre a próxima
- Exemplo: Se ele acabou de informar os dados básicos, pergunte: "Ótimo! Agora vamos configurar o orçamento da obra. Você já tem os custos estimados?"
- NUNCA pare no meio do processo - seja proativo
- Mostre progresso: "✅ Dados básicos completos. Próximo: Orçamento"
- Se o usuário quiser pular etapas, permita, mas sempre sugira o fluxo completo

REGRAS SOBRE DATAS:
- No Brasil, usamos DD/MM/AAAA (exemplo: 26/01/2027)
- Sistema internamente usa ISO: AAAA-MM-DD (exemplo: 2027-01-26)
- Quando o usuário informar "26/01/2027", ACEITE imediatamente
- Faça a conversão automaticamente e confirme: "✅ Data de início: 26/01/2027"
- NUNCA peça reformatação se já está no formato brasileiro válido

Histórico da conversa:
${messages.map(m => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content}`).join('\n')}

Pergunta atual do usuário: ${userMessage}

INSTRUÇÃO CRÍTICA: Analise o histórico. Se o usuário acabou de completar uma etapa (ex: informou data da obra), você DEVE oferecer a próxima etapa do processo. Seja um guia completo, não pare no meio!`,
        add_context_from_internet: false
      });

      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Desculpe, ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.' 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Botão flutuante aprimorado */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-full shadow-xl hover:shadow-2xl flex items-center justify-center transition-all z-50 group"
        aria-label="Assistente IA"
      >
        {open ? (
          <X className="w-7 h-7" />
        ) : (
          <div className="relative">
            <MessageCircle className="w-7 h-7" />
            <Sparkles className="w-4 h-4 absolute -top-1 -right-1 text-yellow-300 animate-pulse" />
          </div>
        )}
      </button>

      {/* Painel de chat profissional */}
      {open && (
        <div className="fixed bottom-24 right-6 w-[420px] h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 flex flex-col overflow-hidden">
          {/* Header Premium */}
          <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white p-5 border-b border-blue-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Assistente Inteligente</h3>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <p className="text-xs text-blue-100">Online • Sempre disponível</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mensagens com scroll suave */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gradient-to-b from-gray-50 to-white">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mb-4">
                  <Sparkles className="w-10 h-10 text-blue-600" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Como posso ajudar?</h4>
                <p className="text-sm text-gray-600 max-w-xs">
                  Sou seu assistente especializado em gestão de obras. Faça perguntas sobre o sistema ou processos.
                </p>
                <div className="mt-6 space-y-2 w-full">
                  <button
                    onClick={() => setInput('Como criar uma nova obra?')}
                    className="w-full text-left px-4 py-2.5 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all text-sm text-gray-700"
                  >
                    💼 Como criar uma nova obra?
                  </button>
                  <button
                    onClick={() => setInput('Como fazer um orçamento?')}
                    className="w-full text-left px-4 py-2.5 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all text-sm text-gray-700"
                  >
                    📊 Como fazer um orçamento?
                  </button>
                  <button
                    onClick={() => setInput('Como controlar o financeiro?')}
                    className="w-full text-left px-4 py-2.5 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all text-sm text-gray-700"
                  >
                    💰 Como controlar o financeiro?
                  </button>
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center mt-1">
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                    )}
                    <div
                      className={`max-w-[75%] px-4 py-3 rounded-2xl shadow-sm ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-tr-sm'
                          : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
                      }`}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    {msg.role === 'user' && (
                      <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center mt-1">
                        <User className="w-5 h-5 text-white" />
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-3 justify-start">
                    <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div className="bg-white border border-gray-200 px-5 py-3 rounded-2xl rounded-tl-sm shadow-sm">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                        <span className="text-sm text-gray-600">Processando...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input aprimorado */}
          <div className="border-t border-gray-200 p-4 bg-white">
            <div className="flex gap-2 items-end">
              <div className="flex-1 relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Digite sua pergunta..."
                  rows={1}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none max-h-32"
                  disabled={loading}
                  style={{ minHeight: '44px' }}
                />
              </div>
              <Button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 shadow-md"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Assistente com IA • Respostas instantâneas
            </p>
          </div>
        </div>
      )}
    </>
  );
}