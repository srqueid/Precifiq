import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Search, X, Ruler } from 'lucide-react';

interface UnidadeMedida {
  id: number;
  nome: string;
  sigla: string;
}

const initialForm = {
  nome: '',
  sigla: ''
};

const UnidadesMedidaPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState(initialForm);

  const { data: unidades = [], isLoading } = useQuery<UnidadeMedida[]>({
    queryKey: ['unidadesMedida'],
    queryFn: async () => {
      const res = await fetch('/unidades-medida/json');
      if (!res.ok) throw new Error('Erro de rede');
      return res.json();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/unidades-medida/deletar/${id}`);
      if (!res.ok) throw new Error('Falha ao excluir');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['unidadesMedida'] })
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const url = editingId ? `/unidades-medida/atualizar/${editingId}` : `/unidades-medida`;
      const data = new URLSearchParams(formData as any);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: data
      });
      if (!res.ok) throw new Error('Falha ao salvar');
      return res.json();
    },
    onSuccess: () => {
      setIsModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['unidadesMedida'] });
    }
  });

  const handleDelete = (id: number, nome: string) => {
    if (window.confirm(`Deseja realmente excluir a unidade "${nome}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleOpenModal = (u?: UnidadeMedida) => {
    if (u) {
      setEditingId(u.id);
      setFormData({ nome: u.nome, sigla: u.sigla });
    } else {
      setEditingId(null);
      setFormData(initialForm);
    }
    setIsModalOpen(true);
  };

  const filtered = unidades.filter(u => 
    u.nome.toLowerCase().includes(search.toLowerCase()) || 
    u.sigla.toLowerCase().includes(search.toLowerCase())
  );

  // Loading skeleton
  const renderTableSkeleton = () => (
    <div className="table-wrapper">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {['Nome', 'Sigla', 'Ações'].map((h, i) => (
                <th key={i} className="table-cell">
                  <div className="skeleton skeleton-text" style={{ width: i === 0 ? '150px' : '60px' }} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map(i => (
              <tr key={i}>
                {Array(3).fill(0).map((_, j) => (
                  <td key={j} className="table-cell">
                    <div className="skeleton skeleton-text" style={{ width: j === 0 ? '150px' : '60px' }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="page unidades-page">
      <section className="page-toolbar card">
        <div className="page-heading">
          <div className="page-heading-icon">
            <Ruler size={24} />
          </div>
          <div>
            <h1 className="page-title">Unidades de Medida</h1>
            <p className="page-subtitle">Cadastro de unidades (L, kg, g, ml, etc)</p>
          </div>
        </div>

        <div className="toolbar-actions" aria-label="Ações e filtros de unidades">
          <div className="search-input-wrapper">
            <label htmlFor="unidadeSearch" className="sr-only">Buscar unidades</label>
            <Search className="search-icon" size={20} aria-hidden="true" />
            <input
              id="unidadeSearch"
              type="text"
              placeholder="Buscar unidade..."
              className="search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar unidades de medida"
            />
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="btn btn-primary btn-lg"
          >
            <Plus size={20} />
            Nova Unidade
          </button>
        </div>
      </section>

      {isLoading && renderTableSkeleton()}

      {!isLoading && (
          <div className="table-wrapper">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-cell">Nome</th>
                    <th className="table-cell">Sigla</th>
                    <th className="table-cell text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-12">
                        <div className="empty-state">
                          <div className="empty-state-icon">
                            <Ruler className="w-16 h-16 mx-auto" />
                          </div>
                          <h3 className="empty-state-title">
                            {search ? 'Nenhuma unidade encontrada' : 'Nenhuma unidade cadastrada'}
                          </h3>
                          <p className="empty-state-description">
                            {search 
                              ? 'Tente ajustar os termos da busca para encontrar o que procura.'
                              : 'Comece cadastrando sua primeira unidade clicando no botão acima.'
                            }
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((u) => (
                      <tr key={u.id}>
                        <td className="table-cell font-medium">{u.nome}</td>
                        <td className="table-cell">
                          <span className="badge badge-blue">{u.sigla}</span>
                        </td>
                        <td className="table-cell">
                          <div className="action-buttons justify-center">
                            <button 
                              onClick={() => handleOpenModal(u)} 
                              className="btn btn-ghost btn-icon"
                              aria-label={`Editar ${u.nome}`}
                              title="Editar"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button 
                              onClick={() => handleDelete(u.id, u.nome)} 
                              className="btn btn-danger btn-icon"
                              aria-label={`Excluir ${u.nome}`}
                              title="Excluir"
                            >
                              <Trash2 size={18} />
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
        )}

      {isModalOpen && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}>
          <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="modal-title-unidade">
            <div className="modal-header">
              <h2 id="modal-title-unidade" className="modal-title">
                {editingId ? 'Editar Unidade' : 'Nova Unidade'}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="modal-close"
                aria-label="Fechar modal"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} id="unidadeForm" className="modal-body space-y-5">
              <div className="form-group">
                <label htmlFor="nome" className="required">Nome</label>
                <input 
                  required 
                  id="nome"
                  name="nome" 
                  value={formData.nome} 
                  onChange={e => setFormData({...formData, nome: e.target.value})} 
                  className="w-full" 
                  placeholder="Ex: Quilograma"
                />
              </div>
              <div className="form-group">
                <label htmlFor="sigla" className="required">Sigla</label>
                <input 
                  required 
                  id="sigla"
                  name="sigla" 
                  value={formData.sigla} 
                  onChange={e => setFormData({...formData, sigla: e.target.value.toUpperCase()})} 
                  className="w-full uppercase" 
                  placeholder="Ex: KG"
                  maxLength={5}
                />
              </div>
            </form>
            <div className="modal-footer">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className="btn btn-secondary"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                form="unidadeForm" 
                className="btn btn-primary"
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnidadesMedidaPage;
