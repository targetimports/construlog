import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '../components/ui/PageHeader';
import DialogMapeamentoNF from '../components/nf/DialogMapeamentoNF';

export default function ImportarNotaFiscal() {
  const [file, setFile] = useState(null);
  const [tipoArquivo, setTipoArquivo] = useState('xml');
  const [dadosExtraidos, setDadosExtraidos] = useState(null);
  const [mapeamentoDialogAberto, setMapeamentoDialogAberto] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [mapeamento, setMapeamento] = useState({});
  const [searchTermoMaterial, setSearchTermoMaterial] = useState('');
  const queryClient = useQueryClient();

  const { data: materiais = [] } = useQuery({
    queryKey: ['materiais'],
    queryFn: () => base44.entities.Material.list()
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ['fornecedores'],
    queryFn: () => base44.entities.Fornecedor.list()
  });

  const { data: almoxarifados = [] } = useQuery({
    queryKey: ['almoxarifados'],
    queryFn: () => base44.entities.Almoxarifado.list()
  });

  const processarNFMutation = useMutation({
    mutationFn: async () => {
      setProcessando(true);
      
      const uploadResult = await base44.integrations.Core.UploadFile({
        file: file
      });

      const resultado = await base44.functions.invoke('processarNotaFiscal', {
        file_url: uploadResult.file_url,
        tipo_arquivo: tipoArquivo
      });

      if (!resultado.data) {
        throw new Error('Nenhum dado retornado da função');
      }

      return resultado.data;
    },
    onSuccess: (dados) => {
      if (!dados || !dados.itens || dados.itens.length === 0) {
        toast.error('Nenhum item foi extraído da nota fiscal');
        setProcessando(false);
        return;
      }

      setDadosExtraidos(dados);
      
      // Inicializar mapeamento com match automático
      const mapeaAuto = {};
      dados.itens.forEach((item, idx) => {
        const materialBuscado = materiais.find(m =>
          m.nome.toLowerCase().includes(item.descricao.toLowerCase()) ||
          item.descricao.toLowerCase().includes(m.nome.toLowerCase())
        );
        if (materialBuscado) {
          mapeaAuto[idx] = {
            material_id: materialBuscado.id,
            preco_compra: item.valor_unitario,
            quantidade: item.quantidade,
            unidade: materialBuscado.unidade,
            almoxarifado_id: null
          };
        }
      });
      
      setMapeamento(mapeaAuto);
      setMapeamentoDialogAberto(true);
      setProcessando(false);
      
      const qtdMapeados = Object.keys(mapeaAuto).length;
      toast.success(`Nota fiscal processada! ${qtdMapeados} itens mapeados automaticamente`);
    },
    onError: (error) => {
      setProcessando(false);
      toast.error('Erro ao processar nota fiscal: ' + error.message);
    }
  });

  const importarMutation = useMutation({
    mutationFn: async () => {
      // Validar: todos os itens mapeados devem ter almoxarifado selecionado
      const mapeamentosCompletos = Object.keys(mapeamento).filter(idx => 
        mapeamento[idx]?.material_id && mapeamento[idx]?.almoxarifado_id
      );
      
      if (mapeamentosCompletos.length === 0) {
        throw new Error('Selecione o local de recebimento para pelo menos um item.');
      }

      // Criar/atualizar fornecedor
      let fornecedorId = null;
      const fornecedorExiste = fornecedores.find(f => f.cnpj === dadosExtraidos.cnpj_fornecedor);
      
      if (fornecedorExiste) {
        fornecedorId = fornecedorExiste.id;
      } else {
        const novoFornecedor = await base44.entities.Fornecedor.create({
          nome: dadosExtraidos.fornecedor_nome,
          cnpj: dadosExtraidos.cnpj_fornecedor,
          tipo: 'distribuidor'
        });
        fornecedorId = novoFornecedor.id;
      }

      // Criar recebimento
      const itensRecebimento = dadosExtraidos.itens
        .map((item, idx) => {
          const mapeado = mapeamento[idx];
          if (!mapeado || !mapeado.material_id || !mapeado.almoxarifado_id) return null;
          return {
            material_id: mapeado.material_id,
            almoxarifado_id: mapeado.almoxarifado_id,
            descricao: item.descricao,
            quantidade_recebida: mapeado.quantidade,
            unidade: mapeado.unidade || item.unidade,
            data_recebimento: dadosExtraidos.data_emissao,
            nota_fiscal: dadosExtraidos.nf_numero,
            valor_nota: item.valor_total
          };
        })
        .filter(Boolean);

      // Criar recebimento
      const recebimento = await base44.entities.RecebimentoMaterial.create({
        descricao: `NF ${dadosExtraidos.nf_numero} - ${dadosExtraidos.fornecedor_nome}`,
        quantidade_recebida: itensRecebimento.reduce((sum, item) => sum + item.quantidade_recebida, 0),
        data_recebimento: dadosExtraidos.data_emissao,
        nota_fiscal: dadosExtraidos.nf_numero,
        valor_nota: dadosExtraidos.valor_total,
        qualidade: 'aprovado'
      });

      // Atualizar materiais com novo estoque e preço
      for (let i = 0; i < dadosExtraidos.itens.length; i++) {
        const mapeado = mapeamento[i];
        if (!mapeado || !mapeado.material_id || !mapeado.almoxarifado_id) continue;

        const material = materiais.find(m => m.id === mapeado.material_id);
        if (!material) continue;

        // Calcular novo preço médio
        const novoEstoque = (material.estoque_atual || 0) + mapeado.quantidade;
        const custoAtual = (material.preco_medio || 0) * (material.estoque_atual || 0);
        const custoNovo = mapeado.preco_compra * mapeado.quantidade;
        const novoPrecoMedio = novoEstoque > 0 ? (custoAtual + custoNovo) / novoEstoque : mapeado.preco_compra;

        await base44.entities.Material.update(mapeado.material_id, {
          estoque_atual: novoEstoque,
          preco_medio: Math.round(novoPrecoMedio * 100) / 100
        });

        // Criar movimentação de estoque
        await base44.entities.MovimentacaoEstoque.create({
          material_id: mapeado.material_id,
          almoxarifado_id: mapeado.almoxarifado_id,
          tipo: 'entrada',
          quantidade: mapeado.quantidade,
          valor_unitario: mapeado.preco_compra,
          valor_total: mapeado.preco_compra * mapeado.quantidade,
          data_movimentacao: dadosExtraidos.data_emissao,
          nota_fiscal: dadosExtraidos.nf_numero,
          responsavel: 'importacao_nf'
        });
      }

      return { sucesso: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['materiais']);
      queryClient.invalidateQueries(['recebimentos']);
      toast.success('Importação concluída com sucesso!');
      setFile(null);
      setDadosExtraidos(null);
      setMapeamento({});
      setMapeamentoDialogAberto(false);
    },
    onError: (error) => {
      toast.error('Erro na importação: ' + error.message);
    }
  });

  const qtdCompletos = useMemo(() => 
    Object.keys(mapeamento).filter(idx => 
      mapeamento[idx]?.material_id && mapeamento[idx]?.almoxarifado_id
    ).length,
    [mapeamento]
  );

  const podeConfirmar = qtdCompletos > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Importar Nota Fiscal</h1>
          <p className="text-gray-600 mt-1">Importe produtos de notas fiscais em XML ou PDF</p>
        </div>
      </div>

      {/* Card Principal de Upload */}
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardHeader className="border-b border-gray-200 pb-4">
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <Upload className="w-5 h-5 text-blue-600" />
            Upload da Nota Fiscal
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="text-gray-700 mb-2 block font-medium">Tipo de Arquivo</Label>
              <Select value={tipoArquivo} onValueChange={setTipoArquivo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="xml">XML (NFe)</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-gray-700 mb-2 block font-medium">Selecionar Arquivo</Label>
              <Input
                type="file"
                accept={tipoArquivo === 'xml' ? '.xml' : '.pdf'}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="cursor-pointer"
              />
            </div>
          </div>

          {file && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-green-800 font-medium">{file.name}</p>
                <p className="text-green-700 text-sm">{(file.size / 1024).toFixed(2)} KB</p>
              </div>
            </div>
          )}

          <Button
            onClick={() => processarNFMutation.mutate()}
            disabled={!file || processandoMutation.isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2 py-6"
          >
            {processandoMutation.isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Processar Nota Fiscal
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Dialog de Mapeamento */}
      <DialogMapeamentoNF
        aberto={mapeamentoDialogAberto}
        onAbrirMudar={setMapeamentoDialogAberto}
        dadosExtraidos={dadosExtraidos}
        mapeamento={mapeamento}
        onMapeamentoMudar={(idx, novoMapeamento) => {
          setMapeamento({
            ...mapeamento,
            [idx]: novoMapeamento
          });
        }}
        materiais={materiais}
        almoxarifados={almoxarifados}
        searchTermoMaterial={searchTermoMaterial}
        onSearchMudar={setSearchTermoMaterial}
        onConfirmar={() => importarMutation.mutate()}
        confirmandoMutation={importarMutation}
        podeConfirmar={podeConfirmar}
        qtdCompletos={qtdCompletos}
      />
    </div>
  );
}