// O QUE ESTE PROJETO É HOJE
//
// Este repositório nasceu como o ERP de obras (Construlog) e virou o PAINEL DO
// FORNECEDOR: onde se gerencia as construtoras que assinam o sistema, seus
// planos e suas cobranças. O ERP continua inteiro no código — só está desligado.
//
// ERP_ATIVO = false  → só o painel de assinantes responde; as ~200 telas de obra
//                      ficam fora das rotas e fora do menu (mas nada foi apagado).
// ERP_ATIVO = true   → o sistema de obras volta a funcionar como antes.
//
// Para religar o ERP basta virar esta chave.
export const ERP_ATIVO = false;

// Nome do produto vendido (aparece na landing e no painel).
export const PRODUTO = 'Construlog';

// Para onde vai quem acabou de entrar. Mora aqui (e não no App) porque a tela de
// login também precisa dela — e importar do App criaria ciclo.
export const ROTA_POS_LOGIN = ERP_ATIVO ? '/Dashboard' : '/PainelInicio';
