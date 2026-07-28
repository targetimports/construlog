import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Download, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ConcertadorPrompt({ contexto, diagnostico, checklist }) {
  const [copied, setCopied] = useState(false);

  const gerarPrompt = () => {
    const bugs = checklist.items.filter(i => i.status === 'bug');
    const avisos = checklist.items.filter(i => i.status === 'warning');
    const pendentes = checklist.items.filter(i => i.status === 'pending');

    return `# AUDITORIA: ${contexto.nomeApp}

## CONTEXTO
${contexto.descricao || 'Sem descrição fornecida'}

## ESCOPO
${contexto.escopo || 'Não especificado'}

## BUGS CRÍTICOS (${bugs.length})
${bugs.length > 0 ? bugs.map((b, i) => `${i + 1}. ${b.nome}\n   ${b.obs || ''}`).join('\n') : 'Nenhum'}

## AVISOS (${avisos.length})
${avisos.length > 0 ? avisos.map((a, i) => `${i + 1}. ${a.nome}\n   ${a.obs || ''}`).join('\n') : 'Nenhum'}

## PENDÊNCIAS (${pendentes.length})
${pendentes.length > 0 ? pendentes.map((p, i) => `${i + 1}. ${p.nome}`).join('\n') : 'Nenhuma'}

## CRITÉRIOS DE ACEITE
- [ ] Bugs críticos corrigidos e testados
- [ ] Avisos endereçados
- [ ] Testes passam
- [ ] Build sem warnings
- [ ] Responsividade OK

**Auditoria em:** ${new Date().toLocaleString('pt-BR')}`;
  };

  const prompt = gerarPrompt();

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    toast.success('Copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const file = new Blob([prompt], {type: 'text/plain'});
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria-${contexto.nomeApp || 'projeto'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Baixado!');
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <CardHeader>
          <CardTitle>Gerador de Prompt para IA</CardTitle>
          <p className="text-sm text-gray-600 mt-2">Pronto para copiar em Claude, ChatGPT, ou qualquer assistente</p>
        </CardHeader>
      </Card>

      <div className="flex gap-3">
        <Button onClick={handleCopy} className="flex-1 gap-2" size="lg">
          <Copy className="w-5 h-5" />
          {copied ? 'Copiado!' : 'Copiar Prompt'}
        </Button>
        <Button onClick={handleDownload} variant="outline" className="flex-1 gap-2" size="lg">
          <Download className="w-5 h-5" />
          Baixar .md
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-auto max-h-96">
            {prompt}
          </pre>
        </CardContent>
      </Card>

      <Card className="bg-green-50 border-green-200">
        <CardContent className="pt-6">
          <p className="text-sm text-green-900">Prompt estruturado e pronto para usar. Cole em um assistente de IA para gerar recomendações de correção.</p>
        </CardContent>
      </Card>
    </div>
  );
}