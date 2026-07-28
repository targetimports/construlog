import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { Bot, Send, X, Minimize2, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

export default function IAAssistente() {
  const [aberto, setAberto] = useState(false);
  const [minimizado, setMinimizado] = useState(false);
  const [mensagens, setMensagens] = useState([
    {
      role: 'assistant',
      content: '👋 Olá! Sou seu assistente de workflows. Posso ajudar com:\n\n• Criar novos workflows\n• Entender etapas de aprovação\n• Verificar status de solicitações\n• Esclarecer dúvidas sobre processos\n\nComo posso ajudar?'
    }
  ]);
  const [input, setInput] = useState('');
  const [carregando, setCarregando] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [mensagens]);

  const enviarMensagem = async () => {
    if (!input.trim() || carregando) return;

    const novaMensagem = { role: 'user', content: input };
    setMensagens([...mensagens, novaMensagem]);
    setInput('');
    setCarregando(true);

    try {
      const contexto = `
Você é um assistente especializado em workflows de empresas de construção.
O usuário pode perguntar sobre:
- Como criar workflows
- Status de aprovações
- Requisitos para cada tipo de workflow
- Dúvidas sobre processos

Histórico da conversa:
${mensagens.map(m => `${m.role}: ${m.content}`).join('\n')}

Usuário: ${input}

Responda de forma clara, objetiva e amigável. Use bullet points quando apropriado.
`;

      const resposta = await base44.integrations.Core.InvokeLLM({
        prompt: contexto
      });

      setMensagens(prev => [...prev, { role: 'assistant', content: resposta }]);
    } catch (error) {
      setMensagens(prev => [...prev, { 
        role: 'assistant', 
        content: '❌ Desculpe, ocorreu um erro. Tente novamente.' 
      }]);
    } finally {
      setCarregando(false);
    }
  };

  if (!aberto) {
    return (
      <Button
        onClick={() => setAberto(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 shadow-xl z-50"
      >
        <Bot className="w-6 h-6 text-white" />
      </Button>
    );
  }

  return (
    <Card className={cn(
      "fixed bottom-6 right-6 bg-gray-900 border-gray-800 shadow-2xl z-50 transition-all",
      minimizado ? "w-80 h-16" : "w-96 h-[600px]"
    )}>
      <CardHeader className="p-4 border-b border-gray-800 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-purple-500/10 rounded-lg">
            <Bot className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <CardTitle className="text-white text-base">Assistente IA</CardTitle>
            <Badge className="bg-emerald-500/10 text-emerald-400 text-xs border-emerald-500/20 mt-1">
              Online
            </Badge>
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setMinimizado(!minimizado)}
            className="text-gray-400 hover:text-white"
          >
            {minimizado ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setAberto(false)}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      {!minimizado && (
        <>
          <CardContent className="p-4 h-[calc(600px-140px)] overflow-y-auto space-y-4">
            {mensagens.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex gap-2",
                  msg.role === 'user' ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-5 h-5 text-purple-500" />
                  </div>
                )}
                <div
                  className={cn(
                    "rounded-xl px-4 py-2 max-w-[80%]",
                    msg.role === 'user'
                      ? "bg-purple-500 text-white"
                      : "bg-gray-800 text-gray-100"
                  )}
                >
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown className="text-sm prose prose-invert prose-sm max-w-none">
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-sm">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            {carregando && (
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-purple-500 animate-pulse" />
                </div>
                <div className="bg-gray-800 rounded-xl px-4 py-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </CardContent>

          <div className="p-4 border-t border-gray-800">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && enviarMensagem()}
                placeholder="Digite sua pergunta..."
                className="bg-gray-800 border-gray-700 text-white"
                disabled={carregando}
              />
              <Button
                onClick={enviarMensagem}
                disabled={!input.trim() || carregando}
                className="bg-purple-500 hover:bg-purple-600"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}