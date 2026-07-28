import React, { useState } from 'react';
import EmissaoNFeHeader from './EmissaoNFeHeader';
import EmissaoNFeDadosGerais from './EmissaoNFeDadosGerais';
import EmissaoNFeEmitente from './EmissaoNFeEmitente';
import EmissaoNFeDestinatario from './EmissaoNFeDestinatario';
import EmissaoNFeItens from './EmissaoNFeItens';
import EmissaoNFeResultado from './EmissaoNFeResultado';
import EmissaoNFeActions from './EmissaoNFeActions';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const initGeral = {
  natureza_operacao: 'Venda de mercadorias',
  data_emissao: new Date().toISOString().slice(0, 16),
  tipo_documento: '1',
  finalidade_emissao: '1',
  modalidade_frete: '0',
};

const initEmitente = {
  cnpj_emitente: '', nome_emitente: '', nome_fantasia_emitente: '',
  logradouro_emitente: '', numero_emitente: '', bairro_emitente: '',
  municipio_emitente: '', uf_emitente: 'SP', cep_emitente: '',
  inscricao_estadual_emitente: '', regime_tributario_emitente: '1',
};

const initDestinatario = {
  nome_destinatario: '', cpf_destinatario: '', cnpj_destinatario: '',
  logradouro_destinatario: '', numero_destinatario: '', bairro_destinatario: '',
  municipio_destinatario: '', uf_destinatario: 'SP', cep_destinatario: '',
  indicador_inscricao_estadual_destinatario: '9',
};

const initItem = {
  numero_item: '1', codigo_produto: '', descricao: '', cfop: '5102',
  unidade_comercial: 'UN', quantidade_comercial: '1',
  valor_unitario_comercial: '', codigo_ncm: '',
  icms_situacao_tributaria: '102', icms_origem: '0',
  pis_situacao_tributaria: '07', cofins_situacao_tributaria: '07',
};

function gerarRef() {
  return `nfe_${Date.now()}`;
}

export default function EmissaoNFeForm() {
  const [geral, setGeral] = useState(initGeral);
  const [emit, setEmit] = useState(initEmitente);
  const [dest, setDest] = useState(initDestinatario);
  const [items, setItems] = useState([{ ...initItem }]);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [refAtual, setRefAtual] = useState(null);
  const [consultando, setConsultando] = useState(false);

  const updGeral = e => setGeral(p => ({ ...p, [e.target.name]: e.target.value }));
  const updEmit = e => setEmit(p => ({ ...p, [e.target.name]: e.target.value }));
  const updDest = e => setDest(p => ({ ...p, [e.target.name]: e.target.value }));
  const updItem = (i, e) => setItems(p => p.map((it, idx) => idx === i ? { ...it, [e.target.name]: e.target.value } : it));
  const addItem = () => setItems(p => [...p, { ...initItem, numero_item: String(p.length + 1) }]);
  const delItem = i => setItems(p => p.filter((_, idx) => idx !== i));

  const calcularTotal = () =>
    items.reduce((acc, it) => acc + (parseFloat(it.quantidade_comercial || 0) * parseFloat(it.valor_unitario_comercial || 0)), 0);

  const montar = () => {
    const total = calcularTotal();
    return {
      ...geral,
      data_emissao: new Date(geral.data_emissao).toISOString(),
      data_entrada_saida: new Date(geral.data_emissao).toISOString(),
      ...emit,
      ...dest,
      nome_destinatario: 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL',
      valor_frete: 0, valor_seguro: 0,
      valor_total: total,
      valor_produtos: total,
      items: items.map((it, i) => {
        const qty = parseFloat(it.quantidade_comercial || 1);
        const vUnit = parseFloat(it.valor_unitario_comercial || 0);
        return {
          ...it,
          numero_item: i + 1,
          valor_unitario_tributavel: vUnit,
          unidade_tributavel: it.unidade_comercial,
          quantidade_tributavel: qty,
          valor_bruto: qty * vUnit,
        };
      }),
    };
  };

  const emitir = async () => {
    setLoading(true);
    setResultado(null);
    const ref = gerarRef();
    setRefAtual(ref);
    try {
      const res = await base44.functions.invoke('emitirNFeFocusNFe', {
        action: 'emitir',
        ref,
        body: montar()
      });
      const { status, data } = res.data;
      if (status === 201 || status === 202) {
        setResultado({ tipo: 'enviado', ref, data, status });
        toast.success('NF-e enviada para processamento');
      } else {
        setResultado({ tipo: 'erro', ref, data, status });
        toast.error('Erro ao emitir NF-e');
      }
    } catch (e) {
      setResultado({ tipo: 'erro', data: { mensagem: e.message } });
      toast.error(e.message || 'Erro ao emitir NF-e');
    }
    setLoading(false);
  };

  const consultar = async () => {
    if (!refAtual) return;
    setConsultando(true);
    try {
      const res = await base44.functions.invoke('emitirNFeFocusNFe', {
        action: 'consultar',
        ref: refAtual
      });
      const { data } = res.data;
      if (data.status === 'autorizado') {
        setResultado({ tipo: 'autorizado', ref: refAtual, data });
        toast.success('NF-e Autorizada!');
      } else if (data.status === 'erro_autorizacao' || data.status === 'denegado') {
        setResultado({ tipo: 'erro', ref: refAtual, data });
      } else {
        setResultado({ tipo: 'processando', ref: refAtual, data });
      }
    } catch (e) {
      toast.error('Erro ao consultar');
    }
    setConsultando(false);
  };

  const limpar = () => {
    setGeral(initGeral);
    setEmit(initEmitente);
    setDest(initDestinatario);
    setItems([{ ...initItem }]);
    setResultado(null);
    setRefAtual(null);
  };

  const total = calcularTotal();

  return (
    <div className="max-w-[960px] mx-auto space-y-5">
      <EmissaoNFeHeader />
      <EmissaoNFeDadosGerais geral={geral} onChange={updGeral} />
      <EmissaoNFeEmitente emit={emit} onChange={updEmit} />
      <EmissaoNFeDestinatario dest={dest} onChange={updDest} />
      <EmissaoNFeItens
        items={items}
        onUpdate={updItem}
        onAdd={addItem}
        onDelete={delItem}
        total={total}
      />
      {resultado && (
        <EmissaoNFeResultado
          resultado={resultado}
          consultando={consultando}
          onConsultar={consultar}
        />
      )}
      <EmissaoNFeActions
        loading={loading}
        onEmitir={emitir}
        onLimpar={limpar}
      />
    </div>
  );
}