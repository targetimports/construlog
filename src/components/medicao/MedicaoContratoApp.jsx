import React, { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Camera, MessageSquare, CheckCircle, AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { toast } from 'sonner';

export default function MedicaoContratoApp({ contratoId }) {
  const [modo, setModo] = useState('selecionar'); // selecionar, medir, fotos, comentarios
  const [dataMedicao, setDataMedicao] = useState(new Date().toISOString().split('T')[0]);
  const [titulo, setTitulo] = useState('');
  const [itemMedicoes, setItemMedicoes] = useState({});
  const [fotos, setFotos] = useState([]);
  const [comentarios, setComentarios] = useState([]);
  const [novoComentario, setNovoComentario] = useState('');
  const cameraRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: contrato } = useQuery({
    queryKey: ['contrato', contratoId],
    queryFn: async () => {
      const contratos = await base44.entities.Contrato.filter({ id: contratoId });
      return contratos[0];
    }
  });

  const { data: items } = useQuery({
    queryKey: ['items-contrato', contratoId],
    queryFn: async () => {
      return base44.entities.ItemMedicao?.filter?.({ contrato_id: contratoId }) || [];
    },
    initialData: []
  });

  // Validar saldo disponível
  const validarSaldo = async (valorNova) => {
    const validacao = await base44.functions.invoke('validarMedicacaoContraSaldo', {
      contratoId,
      novoValorMedicao: valorNova
    });
    return validacao.data.validacao;
  };

  // Capturar foto
  const handleFoto = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const video = cameraRef.current;
      if (video) {
        video.srcObject = stream;
        video.style.display = 'block';
      }
    } catch (error) {
      toast.error('Erro ao acessar câmera');
    }
  };

  // Tirar foto da câmera
  const capturarFoto = () => {
    const video = cameraRef.current;
    if (video) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      const imagemBase64 = canvas.toDataURL('image/jpeg');
      
      setFotos([...fotos, {
        data: imagemBase64,
        timestamp: new Date().toLocaleTimeString('pt-BR')
      }]);

      video.style.display = 'none';
      video.srcObject?.getTracks().forEach(track => track.stop());
      toast.success('Foto capturada');
    }
  };

  const finalizarMutation = useMutation({
    mutationFn: async () => {
      const totalMedido = Object.values(itemMedicoes).reduce((a, v) => a + (parseFloat(v) || 0), 0);
      
      // Validar saldo
      const validacao = await validarSaldo(totalMedido);
      if (!validacao.permitido) {
        throw new Error(validacao.mensagem);
      }

      // Criar medição
      const medicao = {
        contrato_id: contratoId,
        data_medicao: dataMedicao,
        titulo,
        items_medicao: Object.entries(itemMedicoes).map(([itemId, valor]) => ({
          item_id: itemId,
          valor: parseFloat(valor) || 0
        })),
        fotos,
        comentarios,
        valor_total: totalMedido,
        status: 'em_analise',
        capturado_app: true
      };

      return base44.functions.invoke('criarMedicaoContratoApp', medicao);
    },
    onSuccess: () => {
      toast.success('Medição finalizada e enviada');
      queryClient.invalidateQueries({ queryKey: ['items-contrato', contratoId] });
      setModo('selecionar');
      setDataMedicao(new Date().toISOString().split('T')[0]);
      setTitulo('');
      setItemMedicoes({});
      setFotos([]);
      setComentarios([]);
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  if (modo === 'selecionar') {
    return (
      <div className="space-y-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600 mb-3">{contrato?.numero}</p>
            <p className="font-semibold mb-4">{contrato?.fornecedor_nome}</p>
            <Button
              onClick={() => setModo('medir')}
              className="w-full gap-2"
            >
              <Plus className="w-4 h-4" />
              Nova Medição
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (modo === 'medir') {
    return (
      <div className="space-y-3">
        <Card>
          <CardContent className="pt-6 space-y-3">
            <Input
              type="date"
              value={dataMedicao}
              onChange={(e) => setDataMedicao(e.target.value)}
              className="text-sm h-8"
            />
            <Input
              placeholder="Título da medição (opcional)"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="text-sm h-8"
            />
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Items ({items.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.map(item => (
              <div key={item.id} className="p-2 border rounded">
                <p className="text-xs font-medium">{item.descricao}</p>
                <p className="text-xs text-gray-600">R$ {item.valor_total?.toFixed(2) || '0.00'}</p>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Valor medido"
                  value={itemMedicoes[item.id] || ''}
                  onChange={(e) => setItemMedicoes({
                    ...itemMedicoes,
                    [item.id]: e.target.value
                  })}
                  className="text-sm h-8 mt-1"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setModo('fotos')}
            className="flex-1 gap-1 text-xs"
          >
            <Camera className="w-3 h-3" />
            Fotos
          </Button>
          <Button
            variant="outline"
            onClick={() => setModo('comentarios')}
            className="flex-1 gap-1 text-xs"
          >
            <MessageSquare className="w-3 h-3" />
            Comentários
          </Button>
          <Button
            onClick={() => finalizarMutation.mutate()}
            disabled={finalizarMutation.isPending}
            className="flex-1 gap-1 text-xs"
          >
            <CheckCircle className="w-3 h-3" />
            Finalizar
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setModo('selecionar')}
          className="w-full text-xs"
        >
          Cancelar
        </Button>
      </div>
    );
  }

  if (modo === 'fotos') {
    return (
      <div className="space-y-3">
        <video ref={cameraRef} autoPlay playsInline style={{ width: '100%', borderRadius: '8px' }} />
        
        <div className="flex gap-2">
          <Button onClick={handleFoto} variant="outline" className="flex-1 gap-1 text-xs">
            <Camera className="w-3 h-3" />
            Iniciar câmera
          </Button>
          <Button onClick={capturarFoto} className="flex-1 gap-1 text-xs">
            Capturar
          </Button>
        </div>

        {fotos.length > 0 && (
          <Card>
            <CardContent className="pt-4 space-y-2">
              {fotos.map((foto, idx) => (
                <img key={idx} src={foto.data} alt={`Foto ${idx}`} className="w-full rounded" />
              ))}
            </CardContent>
          </Card>
        )}

        <Button onClick={() => setModo('medir')} variant="outline" className="w-full text-xs">
          Voltar
        </Button>
      </div>
    );
  }

  if (modo === 'comentarios') {
    return (
      <div className="space-y-3">
        <Card>
          <CardContent className="pt-4 space-y-2 max-h-40 overflow-y-auto">
            {comentarios.map((com, idx) => (
              <div key={idx} className="text-xs bg-gray-50 p-2 rounded">
                <p>{com.texto}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Input
            placeholder="Novo comentário"
            value={novoComentario}
            onChange={(e) => setNovoComentario(e.target.value)}
            className="text-sm h-8"
          />
          <Button
            onClick={() => {
              if (novoComentario.trim()) {
                setComentarios([...comentarios, { texto: novoComentario }]);
                setNovoComentario('');
              }
            }}
            className="text-xs h-8 px-2"
          >
            Add
          </Button>
        </div>

        <Button onClick={() => setModo('medir')} variant="outline" className="w-full text-xs">
          Voltar
        </Button>
      </div>
    );
  }
}