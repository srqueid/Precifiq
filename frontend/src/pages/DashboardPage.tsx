import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  BarChart3, 
  ShoppingCart, 
  FileText, 
  CheckCircle, 
  TrendingUp, 
  Package, 
  Box, 
  AlertTriangle, 
  Archive, 
  DollarSign, 
  Layers, 
  Percent, 
  Boxes
} from 'lucide-react';

// Interfaces
interface Insumo {
  id: number;
  nome: string;
  unidadeMedidaId: number;
  preco: number;
  isEmbalagem: boolean;
  quantidadePorEmbalagem?: number;
  estoque?: number;
  estoqueMinimo?: number;
  unidadeSigla?: string;
}

interface Preco {
  produtoNome: string;
  nomeTamanho: string;
  custoUnitarioCalculado: number;
  precoVenda: number;
  margemLucro: number;
}

interface CompraPendente {
  id: number;
  dataCriacao: string;
  fornecedorId: number;
  valorTotal: number;
  status: string;
}

interface DashboardData {
  comprasPendentesCount?: number;
  orcamentosCount?: number;
  aprovadosCount?: number;
  comprasTotal?: number;
  totalProdutos?: number;
  totalVariacoes?: number;
  margemMedia?: number;
  ticketMedio?: number;
  valorEstoqueInsumos?: number;
  valorEstoqueProdutosVenda?: number;
  valorEstoqueProdutosCusto?: number;
  totalUnidadesProdutosEstoque?: number;
  precos?: Preco[];
  estoque?: Insumo[];
}

// Helpers
const fmtBrl = (val?: number) => {
  if (val === undefined || val === null || isNaN(val)) return 'R$ 0,00';
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const fmtPct = (val?: number) => {
  if (val === undefined || val === null || isNaN(val)) return '0%';
  return `${val.toFixed(1)}%`;
};

const fmtNum = (val?: number) => {
  if (val === undefined || val === null || isNaN(val)) return '0';
  return val.toLocaleString('pt-BR');
};

interface KpiCardProps {
  label: string;
  value: string;
  trend?: string;
  color?: 'green' | 'yellow' | 'blue' | 'red' | 'purple';
  icon?: React.ReactNode;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, trend, color = 'blue', icon }) => (
  <div className="kpi-card">
    {icon && <div className={`kpi-icon ${color}`}>{icon}</div>}
    <div className="kpi-content">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${color}`}>{value}</div>
      {trend && <div className="kpi-trend">{trend}</div>}
    </div>
  </div>
);

const DashboardPage: React.FC = () => {
  // Query dos dados do Dashboard
  const { data: dashboardData, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => fetch('/dashboard/json').then(res => res.json()),
  });

  // Query dos insumos para fallback detalhado
  const { data: insumoData } = useQuery({
    queryKey: ['insumos'],
    queryFn: () => fetch('/insumos/json').then(res => res.json()),
  });

  // Processamento e saneamento dos dados de insumos
  const unidades = (insumoData as any)?.unidades || [];
  const insumos: Insumo[] = (insumoData?.insumos || dashboardData?.estoque || []).map((i: any) => ({
    ...i,
    unidadeSigla: i.unidadeSigla || unidades.find((u: any) => u.id === i.unidadeMedidaId)?.sigla || ''
  }));

  const totalInsumos = insumos.length;
  const materiasPrimas = insumos.filter(i => !i.isEmbalagem).length;
  const embalagens = insumos.filter(i => i.isEmbalagem).length;
  const estoqueBaixo = insumos.filter(i => {
    const min = ((i as any).estoqueMinimo !== undefined && (i as any).estoqueMinimo !== null && (i as any).estoqueMinimo > 0) ? (i as any).estoqueMinimo : 5;
    const est = i.estoque ?? 0;
    return est > 0 && est <= min;
  }).length;
  const estoqueZerado = insumos.filter(i => (i.estoque ?? 0) === 0).length;

  const getCustoUnitarioInsumo = (i: Insumo): number => {
    const qtdEmb = (i.quantidadePorEmbalagem && i.quantidadePorEmbalagem > 0) ? i.quantidadePorEmbalagem : 1;
    return (i.preco || 0) / qtdEmb;
  };

  // Cálculo real do valor em estoque de insumos
  const valorTotalEstoqueInsumos = dashboardData?.valorEstoqueInsumos ?? insumos.reduce((acc: number, i: Insumo) => {
    return acc + (i.estoque || 0) * getCustoUnitarioInsumo(i);
  }, 0);

  // Valores de produtos acabados em estoque
  const valorEstoqueProdutosVenda = dashboardData?.valorEstoqueProdutosVenda ?? 0;
  const valorEstoqueProdutosCusto = dashboardData?.valorEstoqueProdutosCusto ?? 0;
  const totalUnidadesProdutosEstoque = dashboardData?.totalUnidadesProdutosEstoque ?? 0;

  return (
    <div className="page dashboard-page">
      <div className="page-heading">
        <div className="page-heading-icon">
          <BarChart3 size={22} />
        </div>
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Visão geral e indicadores estratégicos do sistema.</p>
        </div>
      </div>

      {/* Grid 1: Compras e Orçamentos */}
      <div className="kpi-grid">
        <KpiCard 
          label="Compras Aguardando" 
          value={fmtNum(dashboardData?.comprasPendentesCount)} 
          trend="Aguardando confirmação" 
          color="yellow" 
          icon={<ShoppingCart size={20} />} 
        />
        <KpiCard 
          label="Orçamentos Ativos" 
          value={fmtNum(dashboardData?.orcamentosCount)} 
          trend="Em cotação com fornecedores" 
          color="blue" 
          icon={<FileText size={20} />} 
        />
        <KpiCard 
          label="Orçamentos Aprovados" 
          value={fmtNum(dashboardData?.aprovadosCount)} 
          trend="Prontos para conversão em compra" 
          color="green" 
          icon={<CheckCircle size={20} />} 
        />
        <KpiCard 
          label="Compras do Mês" 
          value={fmtBrl(dashboardData?.comprasTotal)} 
          trend="Total faturado no mês atual" 
          color="red" 
          icon={<TrendingUp size={20} />} 
        />
      </div>

      {/* Grid 2: Estoque de Insumos */}
      <div className="kpi-grid">
        <KpiCard 
          label="Total de Insumos" 
          value={fmtNum(totalInsumos)} 
          trend={`${materiasPrimas} matérias-primas • ${embalagens} embalagens`} 
          color="blue" 
          icon={<Package size={20} />} 
        />
        <KpiCard 
          label="Insumos Estoque Baixo" 
          value={fmtNum(estoqueBaixo)} 
          trend="Abaixo do estoque mínimo" 
          color="yellow" 
          icon={<AlertTriangle size={20} />} 
        />
        <KpiCard 
          label="Insumos Estoque Zerado" 
          value={fmtNum(estoqueZerado)} 
          trend="Sem saldo em estoque" 
          color="red" 
          icon={<Archive size={20} />} 
        />
        <KpiCard 
          label="Valor em Estoque (Insumos)" 
          value={fmtBrl(valorTotalEstoqueInsumos)} 
          trend="Custo proporcional fracionado" 
          color="green" 
          icon={<DollarSign size={20} />} 
        />
      </div>

      {/* Grid 3: Catálogo & Produtos Acabados */}
      <div className="kpi-grid">
        <KpiCard 
          label="Produtos Cadastrados" 
          value={fmtNum(dashboardData?.totalProdutos)} 
          trend="Fórmulas e receitas base" 
          color="blue" 
          icon={<Layers size={20} />} 
        />
        <KpiCard 
          label="Variações de Venda" 
          value={fmtNum(dashboardData?.totalVariacoes)} 
          trend="Embalagens e fracionamentos" 
          color="blue" 
          icon={<Box size={20} />} 
        />
        <KpiCard 
          label="Margem Média de Lucro" 
          value={fmtPct(dashboardData?.margemMedia)} 
          trend="Média cadastrada nas variações" 
          color="green" 
          icon={<Percent size={20} />} 
        />
        <KpiCard 
          label="Valor de Produtos no Estoque" 
          value={fmtBrl(valorEstoqueProdutosVenda)} 
          trend={`${totalUnidadesProdutosEstoque} un. prontas • Custo: ${fmtBrl(valorEstoqueProdutosCusto)}`} 
          color="green" 
          icon={<Boxes size={20} />} 
        />
      </div>

      {/* Tabelas de Acompanhamento */}
      <div className="responsive-grid" style={{ marginTop: '24px' }}>
        <div className="card">
          <h2 className="section-title">Planilha de Preços (Produtos Finais)</h2>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Tamanho</th>
                  <th className="text-right">Custo</th>
                  <th className="text-right">Venda</th>
                  <th className="text-right">Margem</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={5}>Carregando...</td></tr>}
                {error && <tr><td colSpan={5}>Erro ao carregar dados.</td></tr>}
                {dashboardData?.precos?.map((p, i) => (
                  <tr key={i}>
                    <td>{p.produtoNome}</td>
                    <td>{p.nomeTamanho}</td>
                    <td className="td-mono text-right">{fmtBrl(p.custoUnitarioCalculado)}</td>
                    <td className="td-mono text-right">{fmtBrl(p.precoVenda)}</td>
                    <td className="td-mono text-right td-green">{fmtPct(p.margemLucro)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="section-title">Estoque Rápido (Insumos)</h2>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Insumo</th>
                  <th className="text-right">Qtd</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={2}>Carregando...</td></tr>}
                {insumos.slice(0, 8).map(i => (
                  <tr key={i.id}>
                    <td>{i.nome}</td>
                    <td className="td-mono text-right">{fmtNum(i.estoque)} {i.unidadeSigla}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
