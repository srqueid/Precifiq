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
  Boxes,
  Calendar,
  Clock,
  Flame,
  CheckCircle2,
  ArrowRight
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
  dataValidade?: string;
  lote?: string;
  codigoBarras?: string;
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

export interface TopProduto {
  nome: string;
  quantidadeVendida: number;
  totalVendido: number;
  lucroGerado: number;
}

export interface InsumoCritico {
  id: number;
  nome: string;
  lote?: string;
  dataValidade?: string;
  estoque: number;
  unidade: string;
  status: string;
  diasAteVencimento: number;
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
  // Novos indicadores de Vendas, Lucro e Giro
  vendasTotalMes?: number;
  vendasCustoMes?: number;
  lucroBrutoMes?: number;
  margemLucroRealizada?: number;
  pedidosCount?: number;
  giroEstoque?: number;
  diasGiroEstoque?: number;
  insumosVencidosCount?: number;
  insumosAVencerCount?: number;
  insumosValidadeCritica?: InsumoCritico[];
  topProdutosVendidos?: TopProduto[];
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

      {/* Grid 0: Desempenho Comercial, Lucro Realizado e Giro de Estoque */}
      <div style={{ marginBottom: '8px' }}>
        <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
          Desempenho Comercial, Lucro Bruto & Giro de Estoque
        </h2>
      </div>
      <div className="kpi-grid" style={{ marginBottom: '24px' }}>
        <KpiCard 
          label="Vendas Realizadas (Mês)" 
          value={fmtBrl(dashboardData?.vendasTotalMes)} 
          trend={`${dashboardData?.pedidosCount || 0} pedido(s) faturados/entregues`} 
          color="green" 
          icon={<ShoppingCart size={20} />} 
        />
        <KpiCard 
          label="Lucro Bruto Realizado" 
          value={fmtBrl(dashboardData?.lucroBrutoMes)} 
          trend={`Margem sobre vendas: ${fmtPct(dashboardData?.margemLucroRealizada)}`} 
          color="green" 
          icon={<DollarSign size={20} />} 
        />
        <KpiCard 
          label="Giro de Estoque" 
          value={`${dashboardData?.giroEstoque || 0}x / mês`} 
          trend={`Renovação média: cada ${dashboardData?.diasGiroEstoque || 0} dias`} 
          color="blue" 
          icon={<TrendingUp size={20} />} 
        />
        <KpiCard 
          label="Insumos com Validade Crítica" 
          value={`${dashboardData?.insumosVencidosCount || 0} Vencido(s)`} 
          trend={`${dashboardData?.insumosAVencerCount || 0} a vencer em ≤ 30 dias`} 
          color={(dashboardData?.insumosVencidosCount || 0) > 0 ? 'red' : (dashboardData?.insumosAVencerCount || 0) > 0 ? 'yellow' : 'green'} 
          icon={<Calendar size={20} />} 
        />
      </div>

      {/* Grid 1: Compras e Orçamentos */}
      <div style={{ marginBottom: '8px' }}>
        <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
          Compras e Suprimentos
        </h2>
      </div>
      <div className="kpi-grid" style={{ marginBottom: '24px' }}>
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
      <div style={{ marginBottom: '8px' }}>
        <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
          Estoque Físico de Insumos & Produtos
        </h2>
      </div>
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
      <div className="kpi-grid" style={{ marginTop: '20px' }}>
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

      {/* Seção Operacional: Validade Crítica & Produtos Mais Vendidos */}
      <div className="responsive-grid" style={{ marginTop: '24px' }}>
        {/* Insumos com Validade Crítica */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} color="#ef4444" /> Insumos com Validade Crítica
            </h2>
            <span className="badge badge-gray" style={{ fontSize: '11px' }}>
              {(dashboardData?.insumosValidadeCritica || []).length} item(ns)
            </span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Insumo</th>
                  <th>Lote</th>
                  <th className="text-right">Saldo</th>
                  <th>Validade</th>
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={5}>Carregando alertas...</td></tr>}
                {!isLoading && (!dashboardData?.insumosValidadeCritica || dashboardData.insumosValidadeCritica.length === 0) ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '16px', color: 'var(--muted)' }}>
                      <CheckCircle2 size={18} color="#10b981" style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                      Todos os insumos estão com validade regular (sem vencimentos próximos).
                    </td>
                  </tr>
                ) : (
                  dashboardData?.insumosValidadeCritica?.map((item) => {
                    const isVencido = item.status === 'VENCIDO';
                    const dataFmt = item.dataValidade ? item.dataValidade.split('-').reverse().join('/') : '—';
                    return (
                      <tr key={item.id}>
                        <td><strong>{item.nome}</strong></td>
                        <td className="td-muted">{item.lote || '—'}</td>
                        <td className="td-mono text-right">{fmtNum(item.estoque)} {item.unidade}</td>
                        <td>{dataFmt}</td>
                        <td className="text-center">
                          <span className={`badge ${isVencido ? 'badge-red' : 'badge-yellow'}`}>
                            {isVencido ? `Venceu há ${Math.abs(item.diasAteVencimento)}d` : `Vence em ${item.diasAteVencimento}d`}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top 5 Produtos Mais Vendidos e Lucro */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Flame size={18} color="#f59e0b" /> Top Produtos Mais Vendidos & Lucro
            </h2>
            <span className="badge badge-gray" style={{ fontSize: '11px' }}>
              {(dashboardData?.topProdutosVendidos || []).length} produto(s)
            </span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th className="text-right">Qtd</th>
                  <th className="text-right">Faturamento</th>
                  <th className="text-right">Lucro Bruto</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={4}>Carregando ranking...</td></tr>}
                {!isLoading && (!dashboardData?.topProdutosVendidos || dashboardData.topProdutosVendidos.length === 0) ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '16px', color: 'var(--muted)' }}>
                      Nenhuma venda registrada ainda no período.
                    </td>
                  </tr>
                ) : (
                  dashboardData?.topProdutosVendidos?.map((prod, idx) => (
                    <tr key={idx}>
                      <td>
                        <span style={{ fontWeight: 600, color: idx === 0 ? '#d97706' : 'var(--text)' }}>
                          {idx + 1}º {prod.nome}
                        </span>
                      </td>
                      <td className="td-mono text-right">{prod.quantidadeVendida} un</td>
                      <td className="td-mono text-right">{fmtBrl(prod.totalVendido)}</td>
                      <td className="td-mono text-right td-green font-medium">{fmtBrl(prod.lucroGerado)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
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
