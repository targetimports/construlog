import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { erroSeguro, sucesso } from './_lib/erroSeguradoResponse.ts';
import { logar, logarErro } from './_lib/correlationId.ts';
import { registrarAuditoria } from './_lib/auditoriaEvento.ts';
import { comErroGlobal } from './_lib/middlewareErroGlobal.ts';
import { validarEnvio, calcularTotaisMedicao } from './_lib/validadorMedicao.ts';

/**
 * CRIAR MEDIÇÃO: rascunho → itens → enviar
 */

Deno.serve(comErroGlobal(async (req, correlationId) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      const { body, status } = erroSeguro('NAO_AUTORIZADO');
      return Response.json(body, { status });
    }
    
    logar(correlationId, 'info', `${user.email} criando medição`);
    
    const payload = await req.json();
    const { obra_id, tipo = 'fisica', itens, observacoes, enviar = false } = payload;
    
    if (!obra_id) {
      const { body, status } = erroSeguro('OBRA_REQUIRED', 'Obra obrigatória');
      return Response.json(body, { status });
    }
    
    // Criar medição
    const medicao = {
      obra_id,
      numero: `MED-${Date.now()}`,
      data_medicao: new Date().toISOString().split('T')[0],
      responsavel_email: user.email,
      tipo,
      status: 'rascunho',
      valor_total_realizado: 0,
      observacoes: observacoes || ''
    };
    
    const medicaoCriada = await base44.entities.Medicao.create(medicao);
    logar(correlationId, 'info', `Medição criada: ${medicaoCriada.id}`);
    
    // Criar itens
    let itensCriados = [];
    let { valor_total } = calcularTotaisMedicao([]);
    
    if (itens && itens.length > 0) {
      try {
        validarEnvio(medicaoCriada, itens);
        
        for (const item of itens) {
          const itemData = {
            medicao_id: medicaoCriada.id,
            descricao: item.descricao,
            unidade: item.unidade || 'un',
            quantidade_periodo: item.quantidade_periodo,
            valor_unitario: item.valor_unitario,
            valor_periodo: item.quantidade_periodo * item.valor_unitario,
            etapa: item.etapa || '',
            categoria: item.categoria || ''
          };
          
          const itemCriado = await base44.entities.ItemMedicao.create(itemData);
          itensCriados.push(itemCriado);
        }
        
        const totais = calcularTotaisMedicao(itensCriados);
        valor_total = totais.valor_total;
        
        // Se enviar = true, marcar como enviada
        if (enviar) {
          await base44.asServiceRole.entities.Medicao.update(medicaoCriada.id, {
            status: 'enviada',
            valor_total_realizado: valor_total
          });
          logar(correlationId, 'info', 'Medição enviada ✓');
        } else {
          await base44.asServiceRole.entities.Medicao.update(medicaoCriada.id, {
            valor_total_realizado: valor_total
          });
        }
        
      } catch (error) {
        logarErro(correlationId, error.code, error.message);
        return Response.json(error.body, { status: error.status });
      }
    }
    
    await registrarAuditoria(base44, {
      entidade: 'Medicao',
      entidadeId: medicaoCriada.id,
      operacao: 'criar',
      obraId: obra_id,
      usuarioId: user.email,
      funcao: 'criarMedicaoObra',
      beforeData: null,
      afterData: medicaoCriada,
      detalhes: {
        tipo,
        itens_quantidade: itensCriados.length,
        valor_total,
        status: enviar ? 'enviada' : 'rascunho'
      }
    });
    
    return Response.json(
      sucesso(
        {
          medicao: { ...medicaoCriada, valor_total_realizado: valor_total },
          itens: itensCriados,
          status: enviar ? 'enviada' : 'rascunho'
        },
        `Medição ${enviar ? 'criada e enviada' : 'criada'} com sucesso`
      ),
      { status: 201 }
    );
    
  } catch (error) {
    throw error;
  }
}));