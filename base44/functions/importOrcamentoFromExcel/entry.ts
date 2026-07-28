import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { file_url, target_obra_id } = body;

        if (!file_url) {
            return Response.json({ error: 'file_url é obrigatório.' }, { status: 400 });
        }

        // Use InvokeLLM para extrair os dados da planilha de orçamento
        const extractedData = await base44.integrations.Core.InvokeLLM({
            prompt: `Analise o conteúdo da planilha Excel fornecida e extraia as seguintes informações:
- Nome da obra (primeira célula com texto longo)
- Bancos de preço utilizados (SINAPI, ORSE, etc.)
- Percentual de BDI
- Informações sobre encargos sociais
- Lista completa de itens de orçamento com: número do item, código, banco de origem, descrição, unidade, quantidade, valor unitário sem BDI, valor unitário com BDI, valor total

IMPORTANTE: 
1. Extraia TODOS os itens que possuam descrição e valores numéricos válidos.
2. Ignore linhas de cabeçalho e linhas sem dados válidos.
3. Se um campo estiver vazio, use null ou string vazia.
4. Converta valores monetários para números (remova símbolos de moeda).`,
            add_context_from_internet: false,
            file_urls: [file_url],
            response_json_schema: {
                "type": "object",
                "properties": {
                    "obra_name": {"type": "string"},
                    "bancos": {"type": "string"},
                    "bdi": {"type": "string"},
                    "encargos_sociais_info": {"type": "string"},
                    "budget_items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "item_number": {"type": "string"},
                                "code": {"type": "string"},
                                "source_bank": {"type": "string"},
                                "description": {"type": "string"},
                                "unit": {"type": "string"},
                                "quantity": {"type": "number"},
                                "unit_value_without_bdi": {"type": "number"},
                                "unit_value_with_bdi": {"type": "number"},
                                "total_value": {"type": "number"}
                            }
                        }
                    }
                }
            }
        });

        if (!extractedData) {
            return Response.json({ error: 'Falha ao extrair dados da planilha' }, { status: 500 });
        }

        const { obra_name, budget_items } = extractedData;

        let obra;
        if (target_obra_id) {
            obra = await base44.asServiceRole.entities.Obra.get(target_obra_id);
            if (!obra) {
                return Response.json({ error: `Obra com ID ${target_obra_id} não encontrada.` }, { status: 404 });
            }
        } else {
            const existingObras = await base44.asServiceRole.entities.Obra.filter({ nome: obra_name });
            if (existingObras.length > 0) {
                obra = existingObras[0];
            } else {
                obra = await base44.asServiceRole.entities.Obra.create({
                    nome: obra_name,
                    tipo: "privada",
                    cliente: "Cliente Padrão",
                    status: "orcamento",
                    data_inicio: new Date().toISOString().split('T')[0]
                });
            }
        }

        const totalOrcamentoValue = budget_items.reduce((sum, item) => sum + (item.total_value || 0), 0);

        const orcamento = await base44.asServiceRole.entities.OrcamentoObra.create({
            obra_id: obra.id,
            numero: `ORC-${Date.now()}`,
            descricao: `${obra_name} - Orçamento Importado`,
            status: "rascunho",
            valor_total: totalOrcamentoValue,
            criado_por: user.email,
        });

        let centroCusto = (await base44.asServiceRole.entities.CentroCusto.filter({ obra_id: obra.id, nome: "Custo Direto" }))[0];
        if (!centroCusto) {
            centroCusto = await base44.asServiceRole.entities.CentroCusto.create({
                obra_id: obra.id,
                nome: "Custo Direto",
                descricao: "Custos diretos da obra",
                ordem: 1
            });
        }

        const itemCreates = budget_items
            .filter(item => item.description && item.unit && item.quantity && item.unit_value_with_bdi && item.total_value)
            .map(item => ({
                orcamento_id: orcamento.id,
                obra_id: obra.id,
                centro_custo_id: centroCusto.id,
                descricao: item.description,
                unidade: item.unit,
                quantidade_orcada: item.quantity,
                valor_unitario: item.unit_value_with_bdi,
                valor_total: item.total_value
            }));

        if (itemCreates.length > 0) {
            await base44.asServiceRole.entities.ItemOrcamentoObra.bulkCreate(itemCreates);
        }

        return Response.json({
            message: `Orçamento '${orcamento.descricao}' importado com sucesso!`,
            obra_id: obra.id,
            orcamento_id: orcamento.id,
            total_items_imported: itemCreates.length
        }, { status: 200 });

    } catch (error) {
        console.error('Erro ao importar orçamento:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});