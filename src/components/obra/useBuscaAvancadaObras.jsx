import { useMemo } from 'react';

export const useBuscaAvancadaObras = (obras, filtros = {}) => {
  const {
    nome = '',
    cliente = '',
    cidade = '',
    estado = '',
    responsavel_tecnico = '',
    data_inicio_min = '',
    data_inicio_max = '',
    data_fim_min = '',
    data_fim_max = '',
    ordenarPor = 'nome', // nome, cliente, cidade, data_inicio, data_fim
    ordem = 'asc' // asc, desc
  } = filtros;

  const resultados = useMemo(() => {
    if (!obras || obras.length === 0) return [];

    let filtrados = obras.filter(obra => {
      // Filtro nome (case-insensitive)
      if (nome && !obra.nome?.toLowerCase().includes(nome.toLowerCase())) {
        return false;
      }

      // Filtro cliente (busca em cliente_nome, cliente_id ou cliente)
      if (cliente) {
        const clienteTexto = (obra.cliente_nome || obra.cliente?.nome || obra.cliente || '').toLowerCase();
        if (!clienteTexto.includes(cliente.toLowerCase())) {
          return false;
        }
      }

      // Filtro cidade
      if (cidade && !obra.cidade?.toLowerCase().includes(cidade.toLowerCase())) {
        return false;
      }

      // Filtro estado
      if (estado && obra.estado !== estado) {
        return false;
      }

      // Filtro responsável técnico
      if (responsavel_tecnico && !obra.responsavel_tecnico?.toLowerCase().includes(responsavel_tecnico.toLowerCase())) {
        return false;
      }

      // Filtro período de início
      if (data_inicio_min && obra.data_inicio < data_inicio_min) {
        return false;
      }
      if (data_inicio_max && obra.data_inicio > data_inicio_max) {
        return false;
      }

      // Filtro período de término
      if (data_fim_min && obra.data_prevista_fim < data_fim_min) {
        return false;
      }
      if (data_fim_max && obra.data_prevista_fim > data_fim_max) {
        return false;
      }

      return true;
    });

    // Ordenação
    const multiplicador = ordem === 'desc' ? -1 : 1;

    filtrados.sort((a, b) => {
      let aVal, bVal;

      switch (ordenarPor) {
        case 'cliente':
          aVal = (a.cliente_nome || a.cliente?.nome || a.cliente || '').toLowerCase();
          bVal = (b.cliente_nome || b.cliente?.nome || b.cliente || '').toLowerCase();
          break;
        case 'cidade':
          aVal = (a.cidade || '').toLowerCase();
          bVal = (b.cidade || '').toLowerCase();
          break;
        case 'data_inicio':
          aVal = a.data_inicio || '';
          bVal = b.data_inicio || '';
          break;
        case 'data_fim':
          aVal = a.data_prevista_fim || '';
          bVal = b.data_prevista_fim || '';
          break;
        case 'responsavel':
          aVal = (a.responsavel_tecnico || '').toLowerCase();
          bVal = (b.responsavel_tecnico || '').toLowerCase();
          break;
        default: // nome
          aVal = (a.nome || '').toLowerCase();
          bVal = (b.nome || '').toLowerCase();
      }

      if (aVal < bVal) return -1 * multiplicador;
      if (aVal > bVal) return 1 * multiplicador;
      return 0;
    });

    return filtrados;
  }, [obras, nome, cliente, cidade, estado, responsavel_tecnico, data_inicio_min, data_inicio_max, data_fim_min, data_fim_max, ordenarPor, ordem]);

  return {
    resultados,
    total: resultados.length,
    filtrados: resultados.length < (obras?.length || 0)
  };
};