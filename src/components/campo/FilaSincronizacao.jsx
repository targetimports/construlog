// Sistema de fila de sincronização para operações offline

const FILA_KEY = 'fila_sincronizacao';
const MAX_TENTATIVAS = 3;

export const FilaSincronizacao = {
  // Adicionar item à fila
  adicionar(tipo, dados) {
    const fila = this.obter();
    const item = {
      id: `${tipo}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tipo,
      dados,
      timestamp: new Date().toISOString(),
      tentativas: 0,
      status: 'pendente'
    };
    fila.push(item);
    this.salvar(fila);
    return item.id;
  },

  // Obter toda a fila
  obter() {
    try {
      const fila = localStorage.getItem(FILA_KEY);
      return fila ? JSON.parse(fila) : [];
    } catch (error) {
      console.error('Erro ao obter fila:', error);
      return [];
    }
  },

  // Salvar fila
  salvar(fila) {
    try {
      localStorage.setItem(FILA_KEY, JSON.stringify(fila));
    } catch (error) {
      console.error('Erro ao salvar fila:', error);
    }
  },

  // Obter itens pendentes
  getPendentes() {
    return this.obter().filter(item => item.status === 'pendente');
  },

  // Obter itens com erro
  getErros() {
    return this.obter().filter(item => item.status === 'erro');
  },

  // Marcar item como enviado
  marcarEnviado(id) {
    const fila = this.obter();
    const item = fila.find(i => i.id === id);
    if (item) {
      item.status = 'enviado';
      item.dataEnvio = new Date().toISOString();
    }
    this.salvar(fila);
  },

  // Marcar item como erro
  marcarErro(id, erro) {
    const fila = this.obter();
    const item = fila.find(i => i.id === id);
    if (item) {
      item.tentativas++;
      if (item.tentativas >= MAX_TENTATIVAS) {
        item.status = 'erro';
        item.erroMsg = erro;
      }
    }
    this.salvar(fila);
  },

  // Remover item
  remover(id) {
    const fila = this.obter().filter(i => i.id !== id);
    this.salvar(fila);
  },

  // Limpar itens enviados
  limparEnviados() {
    const fila = this.obter().filter(i => i.status !== 'enviado');
    this.salvar(fila);
  },

  // Resetar tentativas de itens com erro
  resetarErros() {
    const fila = this.obter();
    fila.forEach(item => {
      if (item.status === 'erro') {
        item.status = 'pendente';
        item.tentativas = 0;
        delete item.erroMsg;
      }
    });
    this.salvar(fila);
  },

  // Obter estatísticas
  getEstatisticas() {
    const fila = this.obter();
    return {
      total: fila.length,
      pendentes: fila.filter(i => i.status === 'pendente').length,
      enviados: fila.filter(i => i.status === 'enviado').length,
      erros: fila.filter(i => i.status === 'erro').length
    };
  }
};