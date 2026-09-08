import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, X, Save, Moon, Sun, Monitor, Settings, Users, Receipt, Clock } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface Funcionario {
  id: number;
  nome: string;
  salarioBruto: number;
}

interface Despesa {
  id: number;
  descricao: string;
  valorMensal: number;
}

interface Config {
  id: number;
  horasTrabalhadasPorSemana: number;
  totalSalarios: number;
  totalDespesasFixas: number;
  custoMinutoTrabalho: number;
}

const ConfiguracoesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const [horas, setHoras] = useState('');

  // Modals state
  const [funcModalOpen, setFuncModalOpen] = useState(false);
  const [editingFunc, setEditingFunc] = useState<Funcionario | null>(null);
  const [funcForm, setFuncForm] = useState({ nome: '', salarioBruto: '' });

  const [despModalOpen, setDespModalOpen] = useState(false);
  const [editingDesp, setEditingDesp] = useState<Despesa | null>(null);
  const [despForm, setDespForm] = useState({ descricao: '', valorMensal: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['configuracoes'],
    queryFn: async () => {
      const res = await fetch('/configuracoes/json');
      if (!res.ok) throw new Error('Erro ao buscar configurações');
      return res.json();
    }
  });

  const config: Config = data?.config || { horasTrabalhadasPorSemana: 44, totalSalarios: 0, totalDespesasFixas: 0, custoMinutoTrabalho: 0 };
  const funcionarios: Funcionario[] = data?.funcionarios || [];
  const despesas: Despesa[] = data?.despesas || [];

  useEffect(() => {
    if (config.horasTrabalhadasPorSemana && !horas) {
      setHoras(config.horasTrabalhadasPorSemana.toString());
    }
  }, [config.horasTrabalhadasPorSemana]);

  const updateHorasMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/configuracoes/horas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ horasSemana: horas })
      });
      if (!res.ok) throw new Error('Falha ao salvar horas');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracoes'] });
    }
  });

  const saveFuncMutation = useMutation({
    mutationFn: async () => {
      const url = editingFunc ? `/configuracoes/funcionarios/atualizar/${editingFunc.id}` : `/configuracoes/funcionarios`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(funcForm as any)
      });
      if (!res.ok) throw new Error('Falha ao salvar');
      return res.json();
    },
    onSuccess: () => {
      setFuncModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['configuracoes'] });
    }
  });

  const delFuncMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/configuracoes/funcionarios/${id}/deletar`);
      if (!res.ok) throw new Error('Falha ao deletar');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['configuracoes'] })
  });

  const saveDespMutation = useMutation({
    mutationFn: async () => {
      const url = editingDesp ? `/configuracoes/despesas/atualizar/${editingDesp.id}` : `/configuracoes/despesas`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(despForm as any)
      });
      if (!res.ok) throw new Error('Falha ao salvar');
      return res.json();
    },
    onSuccess: () => {
      setDespModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['configuracoes'] });
    }
  });

  const delDespMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/configuracoes/despesas/${id}/deletar`);
      if (!res.ok) throw new Error('Falha ao deletar');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['configuracoes'] })
  });

  const openFuncModal = (f?: Funcionario) => {
    if (f) {
      setEditingFunc(f);
      setFuncForm({ nome: f.nome, salarioBruto: f.salarioBruto.toString() });
    } else {
      setEditingFunc(null);
      setFuncForm({ nome: '', salarioBruto: '' });
    }
    setFuncModalOpen(true);
  };

  const openDespModal = (d?: Despesa) => {
    if (d) {
      setEditingDesp(d);
      setDespForm({ descricao: d.descricao, valorMensal: d.valorMensal.toString() });
    } else {
      setEditingDesp(null);
      setDespForm({ descricao: '', valorMensal: '' });
    }
    setDespModalOpen(true);
  };

  const handleDeleteFunc = (id: number, nome: string) => {
    if (window.confirm(`Deseja realmente excluir o funcionário "${nome}"?`)) {
      delFuncMutation.mutate(id);
    }
  };

  const handleDeleteDesp = (id: number, descricao: string) => {
    if (window.confirm(`Deseja realmente excluir a despesa "${descricao}"?`)) {
      delDespMutation.mutate(id);
    }
  };

  if (isLoading) return (
    <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
      <div className="text-center">
        <div className="skeleton skeleton-title mx-auto mb-4" style={{ width: '250px' }} />
        <p className="text-gray-500">Carregando configurações...</p>
      </div>
    </div>
  );

  return (
    <div className="page configuracoes-page">
      <section className="page-toolbar card">
        <div className="page-heading">
          <div className="page-heading-icon">
            <Settings size={24} />
          </div>
          <div>
            <h1 className="page-title">Configurações e Custos Fixos</h1>
            <p className="page-subtitle">Gerencie salários, despesas e horas de trabalho</p>
          </div>
        </div>

        <div className="toolbar-actions" aria-label="Ações e configurações">
          <div className="bg-white p-1.5 rounded-xl shadow-sm border border-gray-100 flex gap-1">
            <button
              onClick={() => setTheme('light')}
              className={`p-2 rounded-lg flex items-center gap-2 transition-all ${theme === 'light' ? 'bg-emerald-100 text-emerald-700 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
              aria-label="Tema claro"
              aria-pressed={theme === 'light'}
            >
              <Sun size={20} />
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`p-2 rounded-lg flex items-center gap-2 transition-all ${theme === 'dark' ? 'bg-emerald-100 text-emerald-700 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
              aria-label="Tema escuro"
              aria-pressed={theme === 'dark'}
            >
              <Moon size={20} />
            </button>
            <button
              onClick={() => setTheme('system')}
              className={`p-2 rounded-lg flex items-center gap-2 transition-all ${theme === 'system' ? 'bg-emerald-100 text-emerald-700 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
              aria-label="Tema do sistema"
              aria-pressed={theme === 'system'}
            >
              <Monitor size={20} />
            </button>
          </div>
        </div>
      </section>

        {/* Resumo e Horas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="card">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Clock size={18} className="text-blue-600" />
              Horas Trabalhadas
            </h2>
            <form onSubmit={e => { e.preventDefault(); updateHorasMutation.mutate(); }} className="flex gap-3 items-end">
              <div className="form-group flex-1">
                <label htmlFor="horas" className="required">Horas por Semana</label>
                <input 
                  id="horas"
                  type="number" 
                  step="0.5" 
                  required 
                  value={horas} 
                  onChange={e => setHoras(e.target.value)} 
                  className="w-full" 
                />
              </div>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={updateHorasMutation.isPending}
              >
                <Save size={18}/> {updateHorasMutation.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </form>
          </div>

          <div className="card bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
            <h2 className="text-lg font-bold text-blue-900 mb-3 flex items-center gap-2">
              <Receipt size={18} className="text-blue-600" />
              Resumo do Custo da Empresa
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-blue-700">Total de Mão de Obra:</span>
                <span className="font-semibold text-blue-900 td-mono">R$ {config.totalSalarios.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-700">Total de Despesas Fixas:</span>
                <span className="font-semibold text-blue-900 td-mono">R$ {config.totalDespesasFixas.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-blue-200 flex justify-between">
                <span className="text-blue-800 font-medium">CUSTO POR MINUTO:</span>
                <span className="font-bold text-red-600 td-mono">R$ {config.custoMinutoTrabalho.toFixed(4)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Funcionários CRUD */}
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Users size={18} className="text-emerald-600" />
                Equipe / Mão de Obra
              </h2>
              <button 
                onClick={() => openFuncModal()} 
                className="btn btn-primary btn-sm"
              >
                <Plus size={16}/> Adicionar
              </button>
            </div>
            <div className="table-wrapper">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-cell">Funcionário</th>
                      <th className="table-cell text-right">Salário Bruto</th>
                      <th className="table-cell text-center w-24">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {funcionarios.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-6 text-center text-gray-500">
                          Nenhum funcionário cadastrado.
                        </td>
                      </tr>
                    ) : (
                      funcionarios.map(f => (
                        <tr key={f.id}>
                          <td className="table-cell font-medium">{f.nome}</td>
                          <td className="table-cell text-right td-mono">R$ {f.salarioBruto.toFixed(2)}</td>
                          <td className="table-cell">
                            <div className="action-buttons justify-center">
                              <button 
                                onClick={() => openFuncModal(f)} 
                                className="btn btn-ghost btn-icon"
                                aria-label={`Editar ${f.nome}`}
                                title="Editar"
                              >
                                <Edit2 size={16}/>
                              </button>
                              <button 
                                onClick={() => handleDeleteFunc(f.id, f.nome)} 
                                className="btn btn-danger btn-icon"
                                aria-label={`Excluir ${f.nome}`}
                                title="Excluir"
                              >
                                <Trash2 size={16}/>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Despesas CRUD */}
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Receipt size={18} className="text-emerald-600" />
                Despesas Fixas Mensais
              </h2>
              <button 
                onClick={() => openDespModal()} 
                className="btn btn-primary btn-sm"
              >
                <Plus size={16}/> Adicionar
              </button>
            </div>
            <div className="table-wrapper">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-cell">Despesa</th>
                      <th className="table-cell text-right">Valor Mensal</th>
                      <th className="table-cell text-center w-24">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {despesas.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-6 text-center text-gray-500">
                          Nenhuma despesa cadastrada.
                        </td>
                      </tr>
                    ) : (
                      despesas.map(d => (
                        <tr key={d.id}>
                          <td className="table-cell font-medium">{d.descricao}</td>
                          <td className="table-cell text-right td-mono">R$ {d.valorMensal.toFixed(2)}</td>
                          <td className="table-cell">
                            <div className="action-buttons justify-center">
                              <button 
                                onClick={() => openDespModal(d)} 
                                className="btn btn-ghost btn-icon"
                                aria-label={`Editar ${d.descricao}`}
                                title="Editar"
                              >
                                <Edit2 size={16}/>
                              </button>
                              <button 
                                onClick={() => handleDeleteDesp(d.id, d.descricao)} 
                                className="btn btn-danger btn-icon"
                                aria-label={`Excluir ${d.descricao}`}
                                title="Excluir"
                              >
                                <Trash2 size={16}/>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              </div>
            </div>
          </div>
      
        {/* Modal Reutilizável (Funcionário ou Despesa) */}
        {(funcModalOpen || despModalOpen) && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && (setFuncModalOpen(false), setDespModalOpen(false))}>
          <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="modal-title-config">
            <div className="modal-header">
              <h2 id="modal-title-config" className="modal-title">
                {funcModalOpen ? (editingFunc ? 'Editar Funcionário' : 'Novo Funcionário') : (editingDesp ? 'Editar Despesa' : 'Nova Despesa')}
              </h2>
              <button 
                onClick={() => { setFuncModalOpen(false); setDespModalOpen(false); }} 
                className="modal-close"
                aria-label="Fechar modal"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={e => { e.preventDefault(); funcModalOpen ? saveFuncMutation.mutate() : saveDespMutation.mutate(); }} id="configForm" className="modal-body space-y-5">
              <div className="form-group">
                <label htmlFor="campo-nome" className="required">{funcModalOpen ? 'Nome' : 'Descrição'}</label>
                <input 
                  required 
                  id="campo-nome"
                  value={funcModalOpen ? funcForm.nome : despForm.descricao} 
                  onChange={e => funcModalOpen ? setFuncForm({...funcForm, nome: e.target.value}) : setDespForm({...despForm, descricao: e.target.value})} 
                  className="w-full" 
                  placeholder={funcModalOpen ? 'Ex: João Silva' : 'Ex: Aluguel'}
                />
              </div>
              <div className="form-group">
                <label htmlFor="campo-valor" className="required">Valor (R$)</label>
                <input 
                  required 
                  id="campo-valor"
                  type="number" 
                  step="0.01" 
                  value={funcModalOpen ? funcForm.salarioBruto : despForm.valorMensal} 
                  onChange={e => funcModalOpen ? setFuncForm({...funcForm, salarioBruto: e.target.value}) : setDespForm({...despForm, valorMensal: e.target.value})} 
                  className="w-full" 
                  placeholder="0.00"
                />
              </div>
            </form>
            <div className="modal-footer">
              <button 
                type="button" 
                onClick={() => { setFuncModalOpen(false); setDespModalOpen(false); }} 
                className="btn btn-secondary"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                form="configForm" 
                className="btn btn-primary"
                disabled={saveFuncMutation.isPending || saveDespMutation.isPending}
              >
                {(saveFuncMutation.isPending || saveDespMutation.isPending) ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfiguracoesPage;
