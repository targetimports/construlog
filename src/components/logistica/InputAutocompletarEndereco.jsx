import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2 } from 'lucide-react';
import BotaoCapturarAudio from './BotaoCapturarAudio';

export default function InputAutocompletarEndereco({
  value,
  onChange,
  onSelectSugestao,
  placeholder = 'Digite o endereço...'
}) {
  const [sugestoes, setSugestoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mostraSugestoes, setMostraSugestoes] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  // Busca via proxy do backend (evita CORS/rate-limit do Nominatim no navegador).
  const buscarSugestoes = async (input) => {
    if (!input || input.trim().length < 2) {
      setSugestoes([]);
      setMostraSugestoes(false);
      return;
    }

    setLoading(true);
    try {
      let resp = await base44.functions.invoke('geocode', { q: `${input}, Bahia, Brasil`, limit: 12 });
      let data = resp?.data?.results || [];

      if (!data.length) {
        resp = await base44.functions.invoke('geocode', { q: input, limit: 12 });
        data = resp?.data?.results || [];
      }

      if (data.length) {
        const bahia = data.filter(r =>
          (r.display_name || '').toLowerCase().includes('bahia') ||
          (r.address?.state || '').toLowerCase().includes('bahia')
        );
        setSugestoes(bahia.length ? bahia : data);
        setMostraSugestoes(true);
      } else {
        setSugestoes([]);
        setMostraSugestoes(true); // mostra "nenhum local encontrado"
      }
    } catch (err) {
      console.error('[geocode] Erro ao buscar:', err);
      setSugestoes([]);
    } finally {
      setLoading(false);
    }
  };

  // Dispara a busca com debounce de 450ms (respeita o rate-limit do Nominatim).
  const agendarBusca = (input) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscarSugestoes(input), 450);
  };

  const handleChange = (e) => {
    const novoValor = e.target.value;
    onChange(novoValor);
    agendarBusca(novoValor);
  };

  const handleSelectSugestao = (sugestao) => {
    const endereco = sugestao.display_name;
    onChange(endereco);
    onSelectSugestao?.({
      endereco,
      lat: parseFloat(sugestao.lat),
      lng: parseFloat(sugestao.lon),
      description: endereco
    });
    setMostraSugestoes(false);
    setSugestoes([]);
  };

  return (
    <div className="relative">
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <Input
            ref={inputRef}
            value={value}
            onChange={handleChange}
            onFocus={() => sugestoes.length > 0 && setMostraSugestoes(true)}
            placeholder={placeholder}
            className="h-11 pl-9"
          />
          {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />}
        </div>
        <BotaoCapturarAudio
          onAudioCapturado={(texto) => {
            onChange(texto);
            buscarSugestoes(texto);
          }}
          label="Destino"
        />
      </div>

      {/* Dropdown de Sugestões */}
      {mostraSugestoes && sugestoes.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
          {sugestoes.map((sugestao, idx) => {
            const endereco = sugestao.display_name || sugestao.name || 'Endereço';
            const tipo = sugestao.type || 'local';
            
            return (
              <button
                key={idx}
                onClick={() => handleSelectSugestao(sugestao)}
                className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-gray-100 last:border-0 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {endereco.split(',')[0]}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {endereco.split(',').slice(1).join(',')}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Mensagem quando nenhuma sugestão */}
      {mostraSugestoes && value.length >= 3 && sugestoes.length === 0 && !loading && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-3 text-center text-sm text-gray-500">
          Nenhum local encontrado
        </div>
      )}
    </div>
  );
}