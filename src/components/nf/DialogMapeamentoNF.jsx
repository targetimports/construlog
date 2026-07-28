import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, CheckCircle2, Loader2 } from 'lucide-react';

export default function DialogMapeamentoNF({
  aberto,
  onAbrirMudar,
  dadosExtraidos,
  mapeamento,
  onMapeamentoMudar,
  materiais,
  almoxarifados,
  searchTermoMaterial,
  onSearchMudar,
  onConfirmar,
  confirmandoMutation,
  podeConfirmar,
  qtdCompletos
}) {
  const materiaisFiltrados = materiais.filter(m =>
    m.nome.toLowerCase().includes(searchTermoMaterial.toLowerCase())
  );

  return (
    <Dialog open={aberto} onOpenChange={onAbrirMudar}>
      <DialogContent className="bg-white max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="border-b border-gray-200 pb-4">
          <DialogTitle className="text-gray-900 text-xl">Mapear Produtos da Nota Fiscal</DialogTitle>
          <p className="text-gray-600 text-sm mt-1">Associe os itens da nota aos materiais do sistema</p>
        </DialogHeader>

        {dadosExtraidos && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar material no sistema..."
                  value={searchTermoMaterial}
                  onChange={(e) => onSearchMudar(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-4">
                {dadosExtraidos.itens?.map((item, idx) => {
                  const mapeado = mapeamento[idx];
                  const materialSelecionado = materiais.find(m => m.id === mapeado?.material_id);

                  return (
                    <Card
                      key={idx}
                      className={`border transition-all ${
                        mapeado && mapeado.almoxarifado_id
                          ? 'border-green-300 bg-green-50'
                          : mapeado
                          ? 'border-yellow-300 bg-yellow-50'
                          : 'border-gray-200 bg-white hover:border-blue-300'
                      }`}
                    >
                      <CardContent className="p-5">
                        <div className="space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <p className="text-gray-900 font-semibold text-base mb-1">{item.descricao}</p>
                              <div className="flex gap-4 text-sm text-gray-600">
                                <span>Qtd: <strong>{item.quantidade} {item.unidade}</strong></span>
                                <span>Unit: <strong>{item.valor_unitario?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></span>
                                <span className="text-blue-600">Total: <strong>{item.valor_total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></span>
                              </div>
                            </div>
                            {mapeado && mapeado.almoxarifado_id && (
                              <Badge className="bg-green-600 text-white">
                                ✓ Completo
                              </Badge>
                            )}
                            {mapeado && !mapeado.almoxarifado_id && (
                              <Badge className="bg-yellow-600 text-white">
                                Faltando local
                              </Badge>
                            )}
                          </div>

                          {/* Selecionar Material */}
                          <div className="space-y-2">
                            <Label className="text-gray-700 font-medium">Selecionar Material do Sistema</Label>
                            <Select
                              value={mapeado?.material_id || ''}
                              onValueChange={(materialId) => {
                                const mat = materiais.find(m => m.id === materialId);
                                onMapeamentoMudar(idx, {
                                  ...mapeado,
                                  material_id: materialId,
                                  preco_compra: item.valor_unitario,
                                  quantidade: item.quantidade,
                                  unidade: mat?.unidade || item.unidade
                                });
                              }}
                            >
                              <SelectTrigger className={mapeado ? 'border-green-400 bg-green-50' : ''}>
                                <SelectValue placeholder="Clique para selecionar um material..." />
                              </SelectTrigger>
                              <SelectContent className="max-h-80">
                                {materiaisFiltrados.length > 0 ? (
                                  materiaisFiltrados.map(mat => (
                                    <SelectItem key={mat.id} value={mat.id}>
                                      <div className="flex items-center justify-between gap-4">
                                        <span>{mat.nome}</span>
                                        <span className="text-gray-500 text-xs ml-4">({mat.unidade})</span>
                                      </div>
                                    </SelectItem>
                                  ))
                                ) : (
                                  <div className="px-2 py-2 text-sm text-gray-500">Nenhum material encontrado</div>
                                )}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Selecionar Local de Recebimento */}
                          {mapeado?.material_id && (
                            <div className="space-y-2">
                              <Label className="text-gray-700 font-medium">Aonde foi recebido?</Label>
                              <Select
                                value={mapeado?.almoxarifado_id || ''}
                                onValueChange={(almoxId) => {
                                  onMapeamentoMudar(idx, {
                                    ...mapeado,
                                    almoxarifado_id: almoxId
                                  });
                                }}
                              >
                                <SelectTrigger className={mapeado?.almoxarifado_id ? 'border-green-400 bg-green-50' : 'border-blue-300'}>
                                  <SelectValue placeholder="Selecione o almoxarifado/local de estoque..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-80">
                                  {almoxarifados && almoxarifados.length > 0 ? (
                                    almoxarifados.map(alm => (
                                      <SelectItem key={alm.id} value={alm.id}>
                                        {alm.nome || alm.localizacao || 'Almoxarifado sem nome'}
                                      </SelectItem>
                                    ))
                                  ) : (
                                    <div className="px-2 py-2 text-sm text-gray-500">Nenhum almoxarifado cadastrado</div>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {/* Info Material Selecionado */}
                          {materialSelecionado && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-700">Estoque Atual:</span>
                                <span className="text-gray-900 font-semibold">{materialSelecionado.estoque_atual} {materialSelecionado.unidade}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-700">Preço Médio Atual:</span>
                                <span className="text-gray-900 font-semibold">{materialSelecionado.preco_medio?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between text-sm border-t border-blue-200 pt-2">
                                <span className="text-blue-700 font-medium">Preço de Compra (Nota):</span>
                                <span className="text-blue-900 font-bold">{mapeado?.preco_compra?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <Button
                variant="outline"
                onClick={() => onAbrirMudar(false)}
                className="flex-1"
              >
                Fechar
              </Button>
              <Button
                onClick={onConfirmar}
                disabled={confirmandoMutation?.isPending || !podeConfirmar}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2"
              >
                {confirmandoMutation?.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Confirmar Importação ({qtdCompletos || 0} {qtdCompletos === 1 ? 'item' : 'itens'})
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}