import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Landmark } from 'lucide-react';

const formatCurrency = (value: number | null | undefined): string => {
  if (value == null) {
    return "R$ 0,00";
  }
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const fetchFinanceiroDashboard = async () => {
  const response = await fetch('/api/financeiro/dashboard');
  if (!response.ok) {
    throw new Error('Não foi possível buscar os dados financeiros.');
  }
  return response.json();
};

const FinanceiroPage: React.FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['financeiroDashboard'],
    queryFn: fetchFinanceiroDashboard,
  });

  return (
    <div className="page">
      <div className="page-heading">
        <div className="page-heading-icon">
          <Landmark size={28} />
        </div>
        <div>
          <h1 className="page-title">Módulo Financeiro</h1>
          <p className="page-subtitle">Gestão de contas a receber, tesouraria e projeções.</p>
        </div>
      </div>

      {isLoading && (
        <div className="kpi-grid">
          <div className="skeleton kpi-card" style={{ height: '110px' }} />
          <div className="skeleton kpi-card" style={{ height: '110px' }} />
          <div className="skeleton kpi-card" style={{ height: '110px' }} />
          <div className="skeleton kpi-card" style={{ height: '110px' }} />
        </div>
      )}

      {error instanceof Error && (
        <div className="card">
          <p style={{ color: 'var(--red)' }}>Erro ao carregar os dados: {error.message}</p>
        </div>
      )}

      {data && (
        <div className="kpi-grid">
          <div className="kpi-card blue">
            <div className="kpi-label">Contas a Receber</div>
            <div className="kpi-value">{formatCurrency(data.contasAReceber)}</div>
          </div>
          <div className="kpi-card green">
            <div className="kpi-label">Caixa (Tesouraria)</div>
            <div className="kpi-value">{formatCurrency(data.caixa)}</div>
          </div>
          <div className="kpi-card yellow">
            <div className="kpi-label">Projeção de Recebíveis</div>
            <div className="kpi-value">{formatCurrency(data.projecao)}</div>
          </div>
          <div className="kpi-card red">
            <div className="kpi-label">Inadimplência</div>
            <div className="kpi-value">{formatCurrency(data.inadimplencia)}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceiroPage;
