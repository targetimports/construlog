import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { orcamento_sintetico_url, composicoes_url, cronograma_url, target_obra_id } = await req.json();

        if (!orcamento_sintetico_url) {
            return Response.json({ error: 'orcamento_sintetico_url é obrigatório.' }, { status: 400 });
        }

        // 1. PROCESSAR ORÇAMENTO SINTÉTICO
        const orcamentoData = await base44.integrations.Core.InvokeLLM({
            prompt: `Analise a planilha de ORÇAMENTO SINTÉTICO fornecida e extraia:
1. Nome da obra (primeira linha com descrição longa)
2. Bancos de preço (SINAPI, ORSE, etc.)
3. BDI (percentual)
4. Encargos sociais
5. TODOS os itens de orçamento da tabela, incluindo:
   - Número do item (ex: 1, 1.1, 1.2, 2, 2.1, etc.)
   - Código (se houver)
   - Banco (SINAPI, ORSE, etc.)
   - Descrição completa
   - Unidade (un, m2, m3, kg, etc.)
   - Quantidade
   - Valor unitário SEM BDI
   - Valor unitário COM BDI
   - Valor total

Retorne TODOS os itens, inclusive os que são apenas títulos de seção (ex: "SERVIÇOS PRELIMINARES").`,
            file_urls: [orcamento_sintetico_url],
            response_json_schema: {
                "type": "object",
                "properties": {
                    "obra_name": {"type": "string"},
                    "bancos": {"type": "string"},
                    "bdi_percentual": {"type": "number"},
                    "encargos_info": {"type": "string"},
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "item_num": {"type": "string"},
                                "codigo": {"type": "string"},
                                "banco": {"type": "string"},
                                "descricao": {"type": "string"},
                                "unidade": {"type": "string"},
                                "quantidade": {"type": "number"},
                                "valor_unit_sem_bdi": {"type": "number"},
                                "valor_unit_com_bdi": {"type": "number"},
                                "valor_total": {"type": "number"},
                                "is_section_title": {"type": "boolean"}
                            }
                        }
                    }
                }
            }
        });

        if (!orcamentoData || !orcamentoData.items) {
            return Response.json({ error: 'Falha ao extrair dados do orçamento sintético' }, { status: 500 });
        }

        // 2. PROCESSAR COMPOSIÇÕES (se fornecido)
        let composicoesData = null;
        if (composicoes_url) {
            composicoesData = await base44.integrations.Core.InvokeLLM({
                prompt: `Analise a planilha de COMPOSIÇÕES ANALÍTICAS COM PREÇO UNITÁRIO e extraia:
- Para cada composição principal:
  * Código da composição
  * Descrição da composição
  * Tipo/Categoria
  * Unidade
  * Quantidade total
  * Valor unitário
  * Valor total
  * Lista de insumos (mão de obra, materiais, equipamentos) com:
    - Tipo do insumo (M.O., Material, Equipamento)
    - Código
    - Descrição
    - Unidade
    - Quantidade
    - Valor unitário
    - Valor total

Extraia TODAS as composições e seus insumos detalhados.`,
                file_urls: [composicoes_url],
                response_json_schema: {
                    "type": "object",
                    "properties": {
                        "composicoes": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "codigo": {"type": "string"},
                                    "descricao": {"type": "string"},
                                    "tipo": {"type": "string"},
                                    "unidade": {"type": "string"},
                                    "quantidade": {"type": "number"},
                                    "valor_unitario": {"type": "number"},
                                    "valor_total": {"type": "number"},
                                    "insumos": {
                                        "type": "array",
                                        "items": {
                                            "type": "object",
                                            "properties": {
                                                "tipo": {"type": "string"},
                                                "codigo": {"type": "string"},
                                                "descricao": {"type": "string"},
                                                "unidade": {"type": "string"},
                                                "quantidade": {"type": "number"},
                                                "valor_unitario": {"type": "number"},
                                                "valor_total": {"type": "number"}
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });
        }

        // 3. PROCESSAR CRONOGRAMA (se fornecido)
        let cronogramaData = null;
        if (cronograma_url) {
            cronogramaData = await base44.integrations.Core.InvokeLLM({
                prompt: `Analise a planilha de CRONOGRAMA FÍSICO-FINANCEIRO e extraia:
- Para cada item/etapa do cronograma:
  * Número do item
  * Descrição
  * Valor total da etapa
  * Percentual e valor para cada período (30 dias, 60 dias, 90 dias, 120 dias, etc.)

Retorne o cronograma completo com todos os períodos e valores.`,
                file_urls: [cronograma_url],
                response_json_schema: {
                    "type": "object",
                    "properties": {
                        "etapas": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "item_num": {"type": "string"},
                                    "descricao": {"type": "string"},
                                    "valor_total": {"type": "number"},
                                    "periodos": {
                                        "type": "array",
                                        "items": {
                                            "type": "object",
                                            "properties": {
                                                "nome": {"type": "string"},
                                                "percentual": {"type": "number"},
                                                "valor": {"type": "number"}
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });
        }

        // 4. CRIAR OU BUSCAR OBRA
        let obra;
        if (target_obra_id) {
            obra = await base44.asServiceRole.entities.Obra.get(target_obra_id);
            if (!obra) {
                return Response.json({ error: `Obra ${target_obra_id} não encontrada` }, { status: 404 });
            }
        } else {
            const obraName = orcamentoData.obra_name || 'Obra Importada';
            const existingObras = await base44.asServiceRole.entities.Obra.filter({ nome: obraName });
            
            if (existingObras.length > 0) {
                obra = existingObras[0];
            } else {
                obra = await base44.asServiceRole.entities.Obra.create({
                    nome: obraName,
                    tipo: "publica",
                    cliente: "Cliente Padrão",
                    status: "orcamento",
                    data_inicio: new Date().toISOString().split('T')[0],
                    descricao: `BDI: ${orcamentoData.bdi_percentual || 0}% | Bancos: ${orcamentoData.bancos || 'N/A'}`
                });
            }
        }

        // 5. CRIAR ORÇAMENTO
        const valorTotalOrcamento = orcamentoData.items
            .filter(item => !item.is_section_title && item.valor_total)
            .reduce((sum, item) => sum + item.valor_total, 0);

        const orcamento = await base44.asServiceRole.entities.OrcamentoObra.create({
            obra_id: obra.id,
            numero: `ORC-${Date.now()}`,
            descricao: `${orcamentoData.obra_name || obra.nome} - Importado`,
            status: "rascunho",
            valor_total: valorTotalOrcamento,
            criado_por: user.email,
            observacoes: `BDI: ${orcamentoData.bdi_percentual}% | ${orcamentoData.encargos_info || ''}`
        });

        // 6. CRIAR CENTRO DE CUSTO
        let centroCusto = (await base44.asServiceRole.entities.CentroCusto.filter({ 
            obra_id: obra.id, 
            nome: "Custos Diretos" 
        }))[0];
        
        if (!centroCusto) {
            centroCusto = await base44.asServiceRole.entities.CentroCusto.create({
                obra_id: obra.id,
                nome: "Custos Diretos",
                descricao: "Custos diretos da obra",
                ordem: 1,
                ativo: true
            });
        }

        // 7. CRIAR ITENS DE ORÇAMENTO
        const itemsToCreate = orcamentoData.items
            .filter(item => !item.is_section_title && item.descricao && item.unidade && item.quantidade && item.valor_total)
            .map(item => ({
                orcamento_id: orcamento.id,
                obra_id: obra.id,
                centro_custo_id: centroCusto.id,
                descricao: item.descricao,
                unidade: item.unidade,
                quantidade_orcada: item.quantidade,
                valor_unitario: item.valor_unit_com_bdi || item.valor_unit_sem_bdi || 0,
                valor_total: item.valor_total,
                quantidade_medida_acumulada: 0,
                valor_medido_acumulado: 0
            }));

        if (itemsToCreate.length > 0) {
            await base44.asServiceRole.entities.ItemOrcamentoObra.bulkCreate(itemsToCreate);
        }

        // 8. CRIAR COMPOSIÇÕES (se houver)
        let composicoesCriadas = 0;
        if (composicoesData && composicoesData.composicoes) {
            const composicoesToCreate = composicoesData.composicoes
                .filter(comp => comp.codigo && comp.descricao)
                .map(comp => ({
                    codigo: comp.codigo,
                    descricao: comp.descricao,
                    unidade: comp.unidade,
                    custo_total: comp.valor_unitario || comp.valor_total || 0,
                    insumos: comp.insumos || [],
                    ativo: true
                }));
            
            if (composicoesToCreate.length > 0) {
                await base44.asServiceRole.entities.Composicao.bulkCreate(composicoesToCreate);
                composicoesCriadas = composicoesToCreate.length;
            }
        }

        return Response.json({
            success: true,
            message: "Planilhas importadas com sucesso!",
            obra_id: obra.id,
            obra_nome: obra.nome,
            orcamento_id: orcamento.id,
            orcamento_numero: orcamento.numero,
            total_orcamento: valorTotalOrcamento,
            items_importados: itemsToCreate.length,
            composicoes_importadas: composicoesCriadas,
            cronograma_processado: !!cronogramaData
        }, { status: 200 });

    } catch (error) {
        console.error('Erro ao importar planilhas:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});