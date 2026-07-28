import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file) {
      return Response.json({ success: false, mensagem: 'Arquivo não fornecido' }, { status: 400 });
    }

    // Importar xlsx (precisa estar instalado)
    const xlsx = await import('npm:xlsx');
    const buffer = await file.arrayBuffer();
    const workbook = xlsx.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);

    let clientesImportados = 0;
    const erros = [];

    for (const row of data) {
      try {
        // Mapear campos do Orça Fácil para Cliente
        const cliente = {
          nome: row['Nome'] || row['Cliente'] || row['Contratante'] || '',
          cnpj_cpf: row['CNPJ'] || row['CPF'] || row['CNPJ/CPF'] || '',
          email: row['Email'] || row['E-mail'] || '',
          telefone: row['Telefone'] || row['Celular'] || '',
          endereco: row['Endereço'] || row['Logradouro'] || '',
          bairro: row['Bairro'] || '',
          cep: row['CEP'] || row['Cep'] || '',
          cidade: row['Cidade'] || '',
          estado: row['Estado'] || row['UF'] || '',
          status: 'ativo',
        };

        // Validar nome obrigatório
        if (!cliente.nome.trim()) {
          erros.push('Linha sem nome do cliente');
          continue;
        }

        // Criar cliente
        await base44.entities.Cliente.create(cliente);
        clientesImportados++;
      } catch (err) {
        erros.push(`Erro na linha: ${err.message}`);
      }
    }

    return Response.json({
      success: true,
      clientesImportados,
      erros: erros.length > 0 ? erros : null,
      mensagem: `${clientesImportados} cliente(s) importado(s) com sucesso!`,
    });
  } catch (error) {
    return Response.json(
      { success: false, mensagem: error.message },
      { status: 500 }
    );
  }
});