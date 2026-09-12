export type FuncionalidadeKey =
  | 'dashboard'
  | 'pedidos_clientes'
  | 'produtos'
  | 'kits'
  | 'estoque_produtos'
  | 'insumos'
  | 'pedidos_compra'
  | 'compras'
  | 'fornecedores'
  | 'orcamentos'
  | 'unidades_medida'
  | 'configuracoes'
  | 'copilot';

export type CategoriaFuncionalidade =
  | 'Principal'
  | 'Produtos & Operação'
  | 'Suprimentos & Compras'
  | 'Cadastros & Configurações'
  | 'Inteligência Artificial';

export interface FuncionalidadeItem {
  key: FuncionalidadeKey;
  nome: string;
  descricao: string;
  categoria: CategoriaFuncionalidade;
  icone: string; // Nome do ícone Lucide
  rota: string;
}

export const CATALOGO_FUNCIONALIDADES: FuncionalidadeItem[] = [
  // 1. Principal
  {
    key: 'dashboard',
    nome: 'Dashboard & Indicadores',
    descricao: 'Visão geral de métricas, faturamento e gráficos executivos',
    categoria: 'Principal',
    icone: 'LayoutDashboard',
    rota: '/'
  },
  // 2. Produtos & Operação
  {
    key: 'pedidos_clientes',
    nome: 'Pedidos de Clientes',
    descricao: 'Emissão, precificação e acompanhamento de pedidos de venda',
    categoria: 'Produtos & Operação',
    icone: 'FileText',
    rota: '/pedido'
  },
  {
    key: 'produtos',
    nome: 'Produtos Finais',
    descricao: 'Cadastro de produtos acabados, ficha técnica e cálculo de margem',
    categoria: 'Produtos & Operação',
    icone: 'ShoppingBag',
    rota: '/produtos'
  },
  {
    key: 'kits',
    nome: 'Kits Promocionais',
    descricao: 'Composição de combos e kits com rateio de custos e lucros',
    categoria: 'Produtos & Operação',
    icone: 'PackagePlus',
    rota: '/kits'
  },
  {
    key: 'estoque_produtos',
    nome: 'Estoque de Produtos',
    descricao: 'Movimentação física, entradas e saldo de produtos acabados',
    categoria: 'Produtos & Operação',
    icone: 'Warehouse',
    rota: '/estoque'
  },
  // 3. Suprimentos & Compras
  {
    key: 'insumos',
    nome: 'Estoque de Insumos',
    descricao: 'Matérias-primas, custos unitários e tipos de insumo',
    categoria: 'Suprimentos & Compras',
    icone: 'Package',
    rota: '/insumos'
  },
  {
    key: 'pedidos_compra',
    nome: 'Pedidos de Compra',
    descricao: 'Solicitação de reposição e cotações de insumos com fornecedores',
    categoria: 'Suprimentos & Compras',
    icone: 'Truck',
    rota: '/pedidos'
  },
  {
    key: 'compras',
    nome: 'Compras & NF-e',
    descricao: 'Entrada de notas fiscais XML e registro de faturas de compras',
    categoria: 'Suprimentos & Compras',
    icone: 'ShoppingCart',
    rota: '/compras'
  },
  {
    key: 'fornecedores',
    nome: 'Fornecedores',
    descricao: 'Cadastro de parceiros comerciais, contatos, CNPJ e histórico',
    categoria: 'Suprimentos & Compras',
    icone: 'Users',
    rota: '/fornecedores'
  },
  {
    key: 'orcamentos',
    nome: 'Orçamentos',
    descricao: 'Simulação rápida de custos e propostas de orçamento para clientes',
    categoria: 'Suprimentos & Compras',
    icone: 'ClipboardList',
    rota: '/orcamentos'
  },
  // 4. Cadastros & Configurações
  {
    key: 'unidades_medida',
    nome: 'Unidades de Medida',
    descricao: 'Cadastro e fator de conversão de unidades (kg, g, un, ml, etc.)',
    categoria: 'Cadastros & Configurações',
    icone: 'Ruler',
    rota: '/unidades'
  },
  {
    key: 'configuracoes',
    nome: 'Configurações de Custos',
    descricao: 'Salários, despesas fixas, custo/minuto e alertas do sistema',
    categoria: 'Cadastros & Configurações',
    icone: 'Settings',
    rota: '/configuracoes'
  },
  // 5. Inteligência Artificial
  {
    key: 'copilot',
    nome: 'Copilot IA Precifiq',
    descricao: 'Assistente com comandos de voz, automação e Text-to-SQL (Ctrl+K)',
    categoria: 'Inteligência Artificial',
    icone: 'Sparkles',
    rota: '*'
  }
];

export interface PresetPerfil {
  nome: string;
  descricao: string;
  icone: string;
  funcionalidades: FuncionalidadeKey[];
}

export const PRESETS_PERFIS: Record<string, PresetPerfil> = {
  TOTAL: {
    nome: 'Acesso Total',
    descricao: 'Concede acesso irrestrito a todas as funcionalidades do sistema',
    icone: 'ShieldCheck',
    funcionalidades: CATALOGO_FUNCIONALIDADES.map(f => f.key)
  },
  OPERACIONAL: {
    nome: 'Operação & Produção',
    descricao: 'Focado no fluxo de produção, controle de estoque e pedidos',
    icone: 'Factory',
    funcionalidades: [
      'dashboard',
      'pedidos_clientes',
      'produtos',
      'kits',
      'estoque_produtos',
      'insumos',
      'unidades_medida'
    ]
  },
  COMPRAS: {
    nome: 'Compras & Suprimentos',
    descricao: 'Focado em cotações, pedidos de compra, NF-e e fornecedores',
    icone: 'ShoppingCart',
    funcionalidades: [
      'dashboard',
      'insumos',
      'pedidos_compra',
      'compras',
      'fornecedores',
      'orcamentos',
      'unidades_medida'
    ]
  },
  COMERCIAL: {
    nome: 'Comercial & Vendas',
    descricao: 'Focado em atendimento ao cliente, pedidos de venda e orçamentos',
    icone: 'Briefcase',
    funcionalidades: [
      'dashboard',
      'pedidos_clientes',
      'produtos',
      'kits',
      'orcamentos'
    ]
  }
};

export const CATEGORIAS_LISTA: CategoriaFuncionalidade[] = [
  'Principal',
  'Produtos & Operação',
  'Suprimentos & Compras',
  'Cadastros & Configurações',
  'Inteligência Artificial'
];

/**
 * Retorna as funcionalidades de uma dada categoria
 */
export function getFuncionalidadesPorCategoria(categoria: CategoriaFuncionalidade): FuncionalidadeItem[] {
  return CATALOGO_FUNCIONALIDADES.filter(f => f.categoria === categoria);
}

/**
 * Conta quantas funcionalidades válidas estão ativas em uma string de permissões
 */
export function contarFuncionalidadesAtivas(permissoesStr?: string | null): number {
  if (!permissoesStr) return 0;
  const upper = permissoesStr.toUpperCase();
  if (upper.includes('GLOBAL_ALL') || upper.includes('MATRIZ_ALL') || upper.includes('*') || upper.includes('ALL')) {
    return CATALOGO_FUNCIONALIDADES.length;
  }
  const perms = permissoesStr.split(',').map(s => s.trim().toLowerCase());
  return CATALOGO_FUNCIONALIDADES.filter(f => perms.includes(f.key.toLowerCase())).length;
}
