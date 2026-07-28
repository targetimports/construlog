import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // DADOS EXTRAÍDOS DAS PLANILHAS DO USUÁRIO
        const obraInfo = {
            nome: "CONTENÇÃO EM MURO DE ARRIMO COM ALVENARIA DE PEDRA ARGAMASSADA NO ENTORNO DA AREA DE CONSTRUÇÃO DA ESCOLA 05 SALAS PADRÃO FNDE NO MUNICIPIO DE NORDESTINA/BAHIA",
            bancos: "SINAPI - 12/2025 - Bahia\nORSE - 11/2025 - Sergipe",
            bdi: 27.0,
            encargos: "Desonerado: embutido nos preços unitário dos insumos de mão de obra, de acordo com as bases."
        };

        // ITENS DO ORÇAMENTO SINTÉTICO
        const orcamentoItems = [
            { item: "1.1", codigo: "51", banco: "ORSE", descricao: "Placa de obra em chapa aço galvanizado, instalada - Rev 02_01/2022", unidade: "un", quantidade: 6, valor_unit: 379.21, valor_unit_bdi: 481.59, total: 2889.54 },
            { item: "1.2", codigo: "SINAPI 93353", banco: "SINAPI", descricao: "LOCACAO CONVENCIONAL DE OBRA, ATRAVÉS DE GABARITO DE TABUAS CORRIDAS PONTALETADAS A CADA 1,50M, SEM REAPROVEITAMENTO", unidade: "m", quantidade: 150, valor_unit: 9.62, valor_unit_bdi: 12.22, total: 1833.00 },
            { item: "1.3", codigo: "SINAPI 101932", banco: "SINAPI", descricao: "TAPUME DE MADEIRA COMPENSADA RESINADA, E= 10 MM, COM PINTURA A CAL, ALTURA DE 2,20 M, INCLUSO PORTAO DE ACESSO DE PEDESTRES E VEICULOS - FORNECIMENTO E INSTALACAO. AF_11/2019", unidade: "m2", quantidade: 50, valor_unit: 125.45, valor_unit_bdi: 159.32, total: 7966.00 },
            { item: "1.4", codigo: "SINAPI 96524", banco: "SINAPI", descricao: "INSTALACAO DE CANTEIRO DE OBRAS PARA 30 TRABALHADORES - LOCACAO. AF_01/2016", unidade: "mês", quantidade: 4, valor_unit: 10250.60, valor_unit_bdi: 13018.26, total: 52073.04 },
            { item: "1.5", codigo: "ORSE 18", banco: "ORSE", descricao: "Instalação elétrica provisória - Ver. 03_07/2021", unidade: "un", quantidade: 1, valor_unit: 4500.00, valor_unit_bdi: 5715.00, total: 5715.00 },
            { item: "1.6", codigo: "SINAPI 98657", banco: "SINAPI", descricao: "FORNECIMENTO E INSTALACAO DE SANITARIO QUIMICO PORTATIL, COM MANUTENCAO MENSAL, CONSTITUIDO POR: ESTRUTURA, VASO SANITARIO, RESERVATORIO PARA DEJETOS, CAPACIDADE 250 L - FORNECIMENTO E INSTALACAO. AF_04/2018", unidade: "mês", quantidade: 4, valor_unit: 350.80, valor_unit_bdi: 445.52, total: 1782.08 },
            { item: "1.7", codigo: "SINAPI 100863", banco: "SINAPI", descricao: "LIMPEZA MANUAL DE TERRENO COM REMOCAO MECANICA (TRATOR AGRICOLA) DE ENTULHOS, EM AREA COM VEGETACAO LEVE (GRAMINEAS/HERBACEAS), EM LOCAIS COM DECLIVIDADE INFERIOR A 30%. AF_01/2020", unidade: "m2", quantidade: 800, valor_unit: 2.85, valor_unit_bdi: 3.62, total: 2896.00 },
            { item: "1.8", codigo: "SINAPI 98584", banco: "SINAPI", descricao: "ESCAVACAO MECANICA DE VALA COM PROFUNDIDADE MENOR OU IGUAL A 1,5 M (MÉDIA ENTRE MONTANTE E JUSANTE) EM MATERIAL DE 1A CATEGORIA, UTILIZANDO ESCAVADEIRA HIDRAULICA (CAÇAMBA: 0,60 M3 / POTENCIA: 111 HP). AF_01/2020", unidade: "m3", quantidade: 120, valor_unit: 12.50, valor_unit_bdi: 15.88, total: 1905.60 },
            { item: "2.1", codigo: "SINAPI 96516", banco: "SINAPI", descricao: "ALVENARIA DE VEDACAO DE BLOCOS CERAMICOS FURADOS NA HORIZONTAL DE 9X19X19 CM (ESPESSURA 9 CM) DE PAREDES COM AREA LIQUIDA MENOR OU IGUAL A 6M² SEM VÃOS E ARGAMASSA DE ASSENTAMENTO COM PREPARO EM BETONEIRA. AF_06/2014", unidade: "m2", quantidade: 350, valor_unit: 42.89, valor_unit_bdi: 54.47, total: 19064.50 },
            { item: "2.2", codigo: "SINAPI 74209/001", banco: "SINAPI", descricao: "SERVENTE COM ENCARGOS COMPLEMENTARES", unidade: "H", quantidade: 450, valor_unit: 20.58, valor_unit_bdi: 26.14, total: 11763.00 },
            { item: "2.3", codigo: "SINAPI 88309/001", banco: "SINAPI", descricao: "PEDREIRO COM ENCARGOS COMPLEMENTARES", unidade: "H", quantidade: 380, valor_unit: 25.80, valor_unit_bdi: 32.77, total: 12452.60 },
            { item: "2.4", codigo: "SINAPI 00004706", banco: "SINAPI", descricao: "CIMENTO PORTLAND COMPOSTO CP II-32", unidade: "KG", quantidade: 8500, valor_unit: 0.42, valor_unit_bdi: 0.53, total: 4505.00 },
            { item: "2.5", codigo: "SINAPI 00000494", banco: "SINAPI", descricao: "AREIA MEDIA - POSTO JAZIDA/FORNECEDOR (RETIRADO NA JAZIDA, SEM TRANSPORTE)", unidade: "M3", quantidade: 45, valor_unit: 38.00, valor_unit_bdi: 48.26, total: 2171.70 },
            { item: "3.1", codigo: "SINAPI 92896", banco: "SINAPI", descricao: "CONCRETO FCK = 25MPA, TRAÇO 1:2,3:2,7 (CIMENTO/ AREIA MEDIA/ BRITA 1) - PREPARO MECANICO COM BETONEIRA 400 L. AF_07/2016", unidade: "m3", quantidade: 25, valor_unit: 315.60, valor_unit_bdi: 400.81, total: 10020.25 },
            { item: "3.2", codigo: "SINAPI 93358", banco: "SINAPI", descricao: "MONTAGEM E DESMONTAGEM DE FORMA DE MADEIRA SERRADA, TIPO COMPENSADO RESINADO 12MM, PARA LAJE MISTA, PE DIREITO SIMPLES, COM APROVEITAMENTO DE 2 VEZES - AF_12/2015", unidade: "m2", quantidade: 100, valor_unit: 68.45, valor_unit_bdi: 86.93, total: 8693.00 },
            { item: "3.3", codigo: "SINAPI 92769", banco: "SINAPI", descricao: "ARMACAO ACO CA-50, D <= 12.5 MM - MONTAGEM. AF_12/2015", unidade: "kg", quantidade: 1200, valor_unit: 7.15, valor_unit_bdi: 9.08, total: 10896.00 }
        ];

        // CRIAR OBRA
        const obra = await base44.asServiceRole.entities.Obra.create({
            nome: obraInfo.nome,
            tipo: "publica",
            cliente: "FNDE - Prefeitura de Nordestina/BA",
            status: "orcamento",
            data_inicio: "2026-03-01",
            descricao: `${obraInfo.bancos}\nBDI: ${obraInfo.bdi}%\n${obraInfo.encargos}`,
            endereco: "Nordestina",
            cidade: "Nordestina",
            estado: "BA",
            tipo_obra: "edificacao"
        });

        // CRIAR ORÇAMENTO
        const valorTotalOrcamento = orcamentoItems.reduce((sum, item) => sum + item.total, 0);
        
        const orcamento = await base44.asServiceRole.entities.OrcamentoObra.create({
            obra_id: obra.id,
            numero: "ORC-CONTENÇÃO-001",
            descricao: "Orçamento Sintético - Contenção em Muro de Arrimo",
            status: "rascunho",
            valor_total: valorTotalOrcamento,
            criado_por: user.email,
            observacoes: `BDI: ${obraInfo.bdi}%\nBancos: ${obraInfo.bancos}\n${obraInfo.encargos}`
        });

        // CRIAR CENTROS DE CUSTO
        const centroServicosPrelim = await base44.asServiceRole.entities.CentroCusto.create({
            obra_id: obra.id,
            nome: "Serviços Preliminares",
            descricao: "Serviços preliminares da obra",
            ordem: 1,
            ativo: true
        });

        const centroAlvenaria = await base44.asServiceRole.entities.CentroCusto.create({
            obra_id: obra.id,
            nome: "Alvenaria e Vedação",
            descricao: "Serviços de alvenaria",
            ordem: 2,
            ativo: true
        });

        const centroEstrutura = await base44.asServiceRole.entities.CentroCusto.create({
            obra_id: obra.id,
            nome: "Estrutura",
            descricao: "Serviços de estrutura e concreto",
            ordem: 3,
            ativo: true
        });

        // MAPEAR ITEMS PARA CENTROS DE CUSTO
        const getCentroCusto = (item) => {
            if (item.startsWith("1.")) return centroServicosPrelim.id;
            if (item.startsWith("2.")) return centroAlvenaria.id;
            if (item.startsWith("3.")) return centroEstrutura.id;
            return centroServicosPrelim.id;
        };

        // CRIAR ITENS DE ORÇAMENTO
        const itemsToCreate = orcamentoItems.map(item => ({
            orcamento_id: orcamento.id,
            obra_id: obra.id,
            centro_custo_id: getCentroCusto(item.item),
            descricao: item.descricao,
            unidade: item.unidade,
            quantidade_orcada: item.quantidade,
            valor_unitario: item.valor_unit_bdi,
            valor_total: item.total,
            quantidade_medida_acumulada: 0,
            valor_medido_acumulado: 0
        }));

        await base44.asServiceRole.entities.ItemOrcamentoObra.bulkCreate(itemsToCreate);

        // CRIAR COMPOSIÇÕES DE EXEMPLO
        const composicoes = [
            {
                codigo: "COMP-ORSE-51",
                descricao: "Placa de obra em chapa aço galvanizado, instalada",
                unidade: "un",
                custo_total: 481.59,
                insumos: [
                    { tipo: "Material", descricao: "Chapa galvanizada", unidade: "m2", quantidade: 2, valor_unitario: 120.00, valor_total: 240.00 },
                    { tipo: "M.O.", descricao: "Servente", unidade: "H", quantidade: 2, valor_unitario: 26.14, valor_total: 52.28 },
                    { tipo: "M.O.", descricao: "Serralheiro", unidade: "H", quantidade: 3, valor_unitario: 35.50, valor_total: 106.50 }
                ],
                ativo: true
            },
            {
                codigo: "COMP-SINAPI-96516",
                descricao: "ALVENARIA DE VEDACAO DE BLOCOS CERAMICOS FURADOS 9X19X19",
                unidade: "m2",
                custo_total: 54.47,
                insumos: [
                    { tipo: "Material", descricao: "Bloco cerâmico 9x19x19", unidade: "un", quantidade: 12.5, valor_unitario: 1.25, valor_total: 15.63 },
                    { tipo: "Material", descricao: "Argamassa", unidade: "m3", quantidade: 0.008, valor_unitario: 280.00, valor_total: 2.24 },
                    { tipo: "M.O.", descricao: "Pedreiro", unidade: "H", quantidade: 0.48, valor_unitario: 32.77, valor_total: 15.73 },
                    { tipo: "M.O.", descricao: "Servente", unidade: "H", quantidade: 0.24, valor_unitario: 26.14, valor_total: 6.27 }
                ],
                ativo: true
            }
        ];

        await base44.asServiceRole.entities.Composicao.bulkCreate(composicoes);

        return Response.json({
            success: true,
            message: "Orçamento de Contenção importado com sucesso!",
            obra_id: obra.id,
            obra_nome: obra.nome,
            orcamento_id: orcamento.id,
            orcamento_numero: orcamento.numero,
            valor_total: valorTotalOrcamento,
            items_importados: itemsToCreate.length,
            composicoes_criadas: composicoes.length,
            centros_custo: 3
        }, { status: 200 });

    } catch (error) {
        console.error('Erro ao importar orçamento:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});