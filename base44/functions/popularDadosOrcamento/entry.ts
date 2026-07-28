import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Dados SINAPI de exemplo
        const dadosSINAPI = [
            { codigo: "74209/001", descricao: "SERVENTE COM ENCARGOS COMPLEMENTARES", unidade: "H", preco_unitario: 25.89, origem: "SINAPI", tipo: "MAO_DE_OBRA" },
            { codigo: "88309/001", descricao: "PEDREIRO COM ENCARGOS COMPLEMENTARES", unidade: "H", preco_unitario: 32.45, origem: "SINAPI", tipo: "MAO_DE_OBRA" },
            { codigo: "00000494", descricao: "AREIA MEDIA - POSTO JAZIDA/FORNECEDOR (RETIRADO NA JAZIDA, SEM TRANSPORTE)", unidade: "M3", preco_unitario: 45.00, origem: "SINAPI", tipo: "MATERIAL" },
            { codigo: "00004706", descricao: "CIMENTO PORTLAND COMPOSTO CP II-32", unidade: "KG", preco_unitario: 0.52, origem: "SINAPI", tipo: "MATERIAL" },
            { codigo: "00000370", descricao: "TIJOLO CERAMICO FURADO 9X14X19CM (8 FUROS)", unidade: "UN", preco_unitario: 0.89, origem: "SINAPI", tipo: "MATERIAL" },
            { codigo: "74169/001", descricao: "ARMADOR COM ENCARGOS COMPLEMENTARES", unidade: "H", preco_unitario: 30.78, origem: "SINAPI", tipo: "MAO_DE_OBRA" },
            { codigo: "00001281", descricao: "ACO CA-50, 10,0 MM, VERGALHAO", unidade: "KG", preco_unitario: 5.89, origem: "SINAPI", tipo: "MATERIAL" },
            { codigo: "74085/002", descricao: "CARPINTEIRO DE FORMAS COM ENCARGOS COMPLEMENTARES", unidade: "H", preco_unitario: 31.23, origem: "SINAPI", tipo: "MAO_DE_OBRA" },
            { codigo: "00009456", descricao: "TABUA DE MADEIRA DE LEI, NAO APARELHADA, 1\" X 12\" (2,5 X 30 CM)", unidade: "M", preco_unitario: 12.50, origem: "SINAPI", tipo: "MATERIAL" },
            { codigo: "00001128", descricao: "CONCRETO FCK = 25MPA, TRAÇO 1:2,3:2,7 (CIMENTO/ AREIA MEDIA/ BRITA 1) - PREPARO MECANICO COM BETONEIRA 400 L.", unidade: "M3", preco_unitario: 385.50, origem: "SINAPI", tipo: "MATERIAL" },
            { codigo: "74234/001", descricao: "ELETRICISTA COM ENCARGOS COMPLEMENTARES", unidade: "H", preco_unitario: 29.87, origem: "SINAPI", tipo: "MAO_DE_OBRA" },
            { codigo: "00035441", descricao: "FIO DE COBRE NU 16MM2 (1X16MM2)", unidade: "M", preco_unitario: 6.78, origem: "SINAPI", tipo: "MATERIAL" },
            { codigo: "74268/001", descricao: "PINTOR COM ENCARGOS COMPLEMENTARES", unidade: "H", preco_unitario: 27.90, origem: "SINAPI", tipo: "MAO_DE_OBRA" },
            { codigo: "00033389", descricao: "TINTA LATEX PVA STANDARD BRANCO NEVE, FOSCO", unidade: "L", preco_unitario: 15.30, origem: "SINAPI", tipo: "MATERIAL" },
            { codigo: "00035442", descricao: "BLOCO CERAMICO DE VEDACAO COM FUROS HORIZONTAIS, 9 X 19 X 19 CM - 4,5 MPA", unidade: "UN", preco_unitario: 1.25, origem: "SINAPI", tipo: "MATERIAL" },
        ];

        // Criar entradas na tabela SINAPI
        const sinapiCreates = dadosSINAPI.map(item => ({
            codigo: item.codigo,
            descricao: item.descricao,
            unidade: item.unidade,
            preco_unitario: item.preco_unitario,
            origem: item.origem,
            data_referencia: "2026-01-01",
            estado: "MG",
            tipo: item.tipo
        }));

        await base44.asServiceRole.entities.TabelaSINAPI.bulkCreate(sinapiCreates);

        // Criar Materiais/Insumos
        const materiais = [
            { codigo: "MAT-001", nome: "Cimento Portland CP II-32", unidade: "KG", preco_unitario: 0.52, estoque_minimo: 1000, categoria: "Cimento" },
            { codigo: "MAT-002", nome: "Areia Média", unidade: "M3", preco_unitario: 45.00, estoque_minimo: 10, categoria: "Agregados" },
            { codigo: "MAT-003", nome: "Tijolo Cerâmico 9x14x19cm", unidade: "UN", preco_unitario: 0.89, estoque_minimo: 5000, categoria: "Alvenaria" },
            { codigo: "MAT-004", nome: "Aço CA-50 10mm", unidade: "KG", preco_unitario: 5.89, estoque_minimo: 500, categoria: "Ferragem" },
            { codigo: "MAT-005", nome: "Tábua de Madeira 1x12", unidade: "M", preco_unitario: 12.50, estoque_minimo: 100, categoria: "Madeira" },
            { codigo: "MAT-006", nome: "Concreto FCK 25MPa", unidade: "M3", preco_unitario: 385.50, estoque_minimo: 5, categoria: "Concreto" },
            { codigo: "MAT-007", nome: "Fio de Cobre 16mm²", unidade: "M", preco_unitario: 6.78, estoque_minimo: 200, categoria: "Elétrica" },
            { codigo: "MAT-008", nome: "Tinta Látex PVA Branco", unidade: "L", preco_unitario: 15.30, estoque_minimo: 50, categoria: "Pintura" },
        ];

        const materiaisCreates = materiais.map(item => ({
            codigo: item.codigo,
            nome: item.nome,
            unidade: item.unidade,
            preco_unitario: item.preco_unitario,
            estoque_minimo: item.estoque_minimo,
            categoria: item.categoria,
            ativo: true
        }));

        await base44.asServiceRole.entities.Material.bulkCreate(materiaisCreates);

        // Criar Composições com preços unitários
        const composicoes = [
            {
                codigo: "COMP-001",
                descricao: "ALVENARIA DE VEDACAO DE BLOCOS CERAMICOS FURADOS NA HORIZONTAL DE 9X19X19 CM (ESPESSURA 9 CM) DE PAREDES COM AREA LIQUIDA MENOR OU IGUAL A 6M² SEM VÃOS E ARGAMASSA DE ASSENTAMENTO COM PREPARO EM BETONEIRA",
                unidade: "M2",
                custo_total: 42.89,
                insumos: [
                    { descricao: "PEDREIRO", quantidade: 0.48, valor_unitario: 32.45 },
                    { descricao: "SERVENTE", quantidade: 0.24, valor_unitario: 25.89 },
                    { descricao: "BLOCO CERAMICO 9X19X19CM", quantidade: 12.5, valor_unitario: 1.25 },
                    { descricao: "ARGAMASSA PRONTA", quantidade: 0.008, valor_unitario: 280.00 }
                ]
            },
            {
                codigo: "COMP-002",
                descricao: "CONCRETO FCK = 25 MPA, TRAÇO 1:2,3:2,7 (CIMENTO/AREIA/BRITA) - LANCAMENTO/APLICACAO COM USO DE BALDES",
                unidade: "M3",
                custo_total: 498.50,
                insumos: [
                    { descricao: "SERVENTE", quantidade: 4.5, valor_unitario: 25.89 },
                    { descricao: "CONCRETO FCK 25MPA", quantidade: 1.05, valor_unitario: 385.50 }
                ]
            },
            {
                codigo: "COMP-003",
                descricao: "MONTAGEM E DESMONTAGEM DE FÔRMA DE LAJE MISTA (LAJE COGUMELO / LAJE LISA) PÉ-DIREITO SIMPLES, EM MADEIRA SERRADA, 4 UTILIZAÇÕES",
                unidade: "M2",
                custo_total: 89.45,
                insumos: [
                    { descricao: "CARPINTEIRO", quantidade: 1.2, valor_unitario: 31.23 },
                    { descricao: "SERVENTE", quantidade: 1.2, valor_unitario: 25.89 },
                    { descricao: "TABUA DE MADEIRA", quantidade: 0.8, valor_unitario: 12.50 }
                ]
            },
            {
                codigo: "COMP-004",
                descricao: "ARMACAO ACO CA-50, D<= 12.5 MM - MONTAGEM",
                unidade: "KG",
                custo_total: 8.95,
                insumos: [
                    { descricao: "ARMADOR", quantidade: 0.05, valor_unitario: 30.78 },
                    { descricao: "AJUDANTE DE ARMADOR", quantidade: 0.05, valor_unitario: 25.89 },
                    { descricao: "ACO CA-50 10MM", quantidade: 1.05, valor_unitario: 5.89 }
                ]
            }
        ];

        const composicoesCreates = composicoes.map(comp => ({
            codigo: comp.codigo,
            descricao: comp.descricao,
            unidade: comp.unidade,
            custo_total: comp.custo_total,
            insumos: comp.insumos,
            ativo: true
        }));

        await base44.asServiceRole.entities.Composicao.bulkCreate(composicoesCreates);

        return Response.json({
            message: "Dados de orçamento populados com sucesso!",
            sinapi_items: sinapiCreates.length,
            materiais: materiaisCreates.length,
            composicoes: composicoesCreates.length
        }, { status: 200 });

    } catch (error) {
        console.error('Erro ao popular dados:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});