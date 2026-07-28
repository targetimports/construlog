import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import EstatisticasCronograma from './EstatisticasCronograma';

export default function ImportadorCronogramaExcel({ obraId, onImportado }) {
  const [arquivo, setArquivo] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [atividadesImportadas, setAtividadesImportadas] = useState(null);

  const importarMutation = useMutation({
    mutationFn: async () => {
      if (!arquivo) throw new Error('Selecione um arquivo');

      setProcessando(true);
      try {
        const arrayBuffer = await arquivo.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { sheet: '' });
        
        // Encontrar abas com "Cronograma" no nome
        let abaCorreta = null;
        for (const sheet of workbook.SheetNames) {
          if (sheet.toLowerCase().includes('cronograma')) {
            abaCorreta = sheet;
            break;
          }
        }
        
        if (!abaCorreta) {
          abaCorreta = workbook.SheetNames[0]; // fallback: primeira aba
        }

        const ws = workbook.Sheets[abaCorreta];
        const dados = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!dados || dados.length === 0) {
          throw new Error('Nenhum dado encontrado na planilha');
        }

        // Detectar colunas por cabeçalho
        const cabecalhos = Object.keys(dados[0]);
        const mapColunas = detectarColunas(cabecalhos);

        if (!mapColunas.atividade || !mapColunas.inicio || !mapColunas.fim) {
          throw new Error('Colunas obrigatórias não encontradas. Esperado: Atividade/Descrição, Início, Fim');
        }

        // Processar linhas válidas
        const atividades = [];
        for (const linha of dados) {
          if (!linha[mapColunas.atividade]?.trim()) continue;

          const dataInicio = parseData(linha[mapColunas.inicio]);
          const dataFim = parseData(linha[mapColunas.fim]);

          if (!dataInicio || !dataFim) continue;

          atividades.push({
            obraId,
            nomeAtividade: String(linha[mapColunas.atividade]).trim(),
            und: linha[mapColunas.unidade] || 'un',
            quantidadePlanejada: parseFloat(linha[mapColunas.quantidade]) || 1,
            dataInicioPlanejada: dataInicio,
            dataFimPlanejada: dataFim,
            responsavel: linha[mapColunas.responsavel] || '',
            status: 'Não iniciado'
          });
        }

        if (atividades.length === 0) {
          throw new Error('Nenhuma atividade válida foi encontrada');
        }

        // Criar atividades em batch
        const criadas = await base44.entities.CronogramaItem.bulkCreate(atividades);

        setProcessando(false);
        setArquivo(null);
        setAtividadesImportadas(criadas);
        toast.success(`${criadas.length} atividades importadas com sucesso`);
        
        if (onImportado) {
          onImportado(criadas);
        }

      } catch (error) {
        setProcessando(false);
        throw error;
      }
    },
    onError: (error) => {
      toast.error('Erro na importação: ' + error.message);
    }
  });

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-gray-700 font-medium">Arquivo Excel (*.xlsx)</Label>
        <Input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setArquivo(e.target.files?.[0] || null)}
          className="cursor-pointer"
        />
      </div>

      {arquivo && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
          <Upload className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-blue-900 font-medium">{arquivo.name}</p>
            <p className="text-blue-700">{(arquivo.size / 1024).toFixed(1)} KB</p>
          </div>
        </div>
      )}

      <Button
        onClick={() => importarMutation.mutate()}
        disabled={!arquivo || importarMutation.isPending}
        className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
      >
        {importarMutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Importando...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            Importar Cronograma
          </>
        )}
      </Button>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 text-sm text-amber-800">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>
          A planilha deve conter colunas: <strong>Atividade</strong>, <strong>Início</strong>, <strong>Fim</strong>.
          Datas no formato <strong>dd/mm/aaaa</strong>.
        </p>
      </div>

      {atividadesImportadas && (
        <EstatisticasCronograma atividades={atividadesImportadas} />
      )}
    </div>
  );
}

function detectarColunas(cabecalhos) {
  const mapa = {
    atividade: null,
    inicio: null,
    fim: null,
    unidade: null,
    quantidade: null,
    responsavel: null
  };

  for (const col of cabecalhos) {
    const lower = col.toLowerCase().trim();
    
    if (!mapa.atividade && (lower.includes('atividade') || lower.includes('descrição') || lower.includes('descricao'))) {
      mapa.atividade = col;
    }
    if (!mapa.inicio && (lower.includes('início') || lower.includes('inicio') || lower.includes('data inicio'))) {
      mapa.inicio = col;
    }
    if (!mapa.fim && (lower.includes('fim') || lower.includes('data fim') || lower.includes('término') || lower.includes('termino'))) {
      mapa.fim = col;
    }
    if (!mapa.unidade && (lower.includes('unidade') || lower.includes('und') || lower.includes('unit'))) {
      mapa.unidade = col;
    }
    if (!mapa.quantidade && (lower.includes('quantidade') || lower.includes('qtd') || lower.includes('qty'))) {
      mapa.quantidade = col;
    }
    if (!mapa.responsavel && (lower.includes('responsável') || lower.includes('responsavel') || lower.includes('resp'))) {
      mapa.responsavel = col;
    }
  }

  return mapa;
}

function parseData(valor) {
  if (!valor) return null;

  const str = String(valor).trim();
  
  // Tenta dd/mm/aaaa
  const match1 = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match1) {
    const [, dia, mes, ano] = match1;
    return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }

  // Tenta yyyy-mm-dd
  const match2 = str.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match2) {
    const [, ano, mes, dia] = match2;
    return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }

  return null;
}