import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Search, Phone, Mail, X, Users } from 'lucide-react';
import { onlyNumbers, maskCnpjCpf, maskPhone, maskCep } from '../utils/masks';

interface Fornecedor {
  id: number;
  nome: string;
  nomeEmpresa?: string;
  nomeFantasia?: string;
  cnpjCpf: string;
  mnemonico?: string;
  enderecoCompleto?: string;
  cep?: string;
  uf?: string;
  email?: string;
  telefones?: string;
  banco?: string;
  agencia?: string;
  contaCorrente?: string;
  chavePix?: string;
  categoria?: string;
  prazoPagamentoPadrao?: string;
  historicoAtendimento?: string;
}

const initialForm = {
  nome: '',
  nomeEmpresa: '',
  nomeFantasia: '',
  cnpjCpf: '',
  mnemonico: '',
  email: '',
  telefones: '',
  enderecoCompleto: '',
  cep: '',
  uf: '',
  banco: '',
  agencia: '',
  contaCorrente: '',
  chavePix: '',
  categoria: '',
  prazoPagamentoPadrao: '',
  historicoAtendimento: ''
};

const normalizeDigits = (value = '') => value.replace(/\D/g, '');

const formatCnpjCpf = (value = '') => {
  const digits = normalizeDigits(value);
  if (!digits) return 'Não informado';

  if (digits.length <= 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') || digits;
  }

  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') || digits;
};

const formatPhone = (value = '') => {
  const digits = normalizeDigits(value);
  if (!digits) return '';

  if (digits.length === 10) {
    return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  }

  if (digits.length === 11) {
    return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  }

  return value;
};

const FornecedoresPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState(initialForm);

  const { data: fornecedoresData = [], isLoading } = useQuery<Fornecedor[] | { fornecedores?: Fornecedor[] }>({
    queryKey: ['fornecedores'],
    queryFn: async () => {
      const res = await fetch('/fornecedores/json');
      if (!res.ok) throw new Error('Erro de rede');
      const json = await res.json() as Fornecedor[] | { fornecedores?: Fornecedor[] };
      return Array.isArray(json) ? json : (Array.isArray(json.fornecedores) ? json.fornecedores : []);
    }
  });
  const fornecedores = Array.isArray(fornecedoresData) ? fornecedoresData : (Array.isArray(fornecedoresData.fornecedores) ? fornecedoresData.fornecedores : []);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/fornecedores/deletar/${id}`);
      if (!res.ok) throw new Error('Falha ao excluir');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
    }
  });

  const handleDelete = (id: number, nome: string) => {
    if (window.confirm(`Deseja realmente excluir o fornecedor "${nome}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleOpenModal = (f?: Fornecedor) => {
    if (f) {
      setEditingId(f.id);
      setFormData({
        nome: f.nome || '',
        nomeEmpresa: f.nomeEmpresa || '',
        nomeFantasia: f.nomeFantasia || '',
        cnpjCpf: maskCnpjCpf(f.cnpjCpf || ''),
        mnemonico: f.mnemonico || '',
        email: f.email || '',
        telefones: maskPhone(f.telefones || ''),
        enderecoCompleto: f.enderecoCompleto || '',
        cep: maskCep(f.cep || ''),
        uf: f.uf || '',
        banco: f.banco || '',
        agencia: f.agencia || '',
        contaCorrente: f.contaCorrente || '',
        chavePix: f.chavePix || '',
        categoria: f.categoria || '',
        prazoPagamentoPadrao: f.prazoPagamentoPadrao || '',
        historicoAtendimento: f.historicoAtendimento || ''
      });
    } else {
      setEditingId(null);
      setFormData(initialForm);
    }
    setIsModalOpen(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;
    if (name === 'cnpjCpf') {
      formattedValue = maskCnpjCpf(value);
    } else if (name === 'telefones') {
      formattedValue = maskPhone(value);
    } else if (name === 'cep') {
      formattedValue = maskCep(value);
    }
    
    if (e.target.value !== formattedValue) {
      e.target.value = formattedValue;
    }
    
    setFormData(prev => ({ ...prev, [name]: formattedValue }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const url = editingId
        ? `/fornecedores/atualizar/${editingId}`
        : `/fornecedores`;

      const payload: Record<string, string> = { ...formData };
      payload.cnpjCpf = onlyNumbers(formData.cnpjCpf);
      payload.telefones = onlyNumbers(formData.telefones);
      payload.cep = onlyNumbers(formData.cep);

      const data = new URLSearchParams(payload);
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
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate();
  };

  const filtered = fornecedores.filter(f =>
    f.nome.toLowerCase().includes(search.toLowerCase()) ||
    (f.nomeEmpresa && f.nomeEmpresa.toLowerCase().includes(search.toLowerCase())) ||
    (f.nomeFantasia && f.nomeFantasia.toLowerCase().includes(search.toLowerCase())) ||
    f.cnpjCpf.includes(search)
  );

  const renderContact = (forn: Fornecedor) => {
    const hasEmail = Boolean(forn.email?.trim());
    const hasPhone = Boolean(forn.telefones?.trim());

    if (!hasEmail && !hasPhone) {
      return <span className="td-muted">Não informado</span>;
    }

    return (
      <div className="contact-list">
        {hasEmail && (
          <span className="contact-item">
            <Mail size={14} />
            {forn.email}
          </span>
        )}
        {hasPhone && (
          <span className="contact-item">
            <Phone size={14} />
            {formatPhone(forn.telefones)}
          </span>
        )}
      </div>
    );
  };

  // Loading skeleton for table
  const renderTableSkeleton = () => (
    <div className="table-wrapper">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
              <tr>
                {['ID', 'Razão Social', 'Nome Fantasia', 'CNPJ/CPF', 'UF', 'Contato', 'Ações'].map((h, i) => (
                  <th key={i} className="table-cell">
                    <div className="skeleton skeleton-text" style={{ width: i === 0 ? '40px' : '120px' }} />
                  </th>
                ))}
              </tr>
            </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map(i => (
              <tr key={i}>
                {Array(7).fill(0).map((_, j) => (
                  <td key={j} className="table-cell">
                    <div className="skeleton skeleton-text" style={{ width: j === 0 ? '40px' : j === 5 ? '150px' : '120px' }} />
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
    <div className="page fornecedores-page">
      <section className="page-toolbar card">
        <div className="page-heading">
          <div className="page-heading-icon">
            <Users size={24} />
          </div>
          <div>
            <h1 className="page-title">Gestão de Fornecedores</h1>
            <p className="page-subtitle">Cadastro, busca e controle de fornecedores</p>
          </div>
        </div>

        <div className="toolbar-actions" aria-label="Ações e filtros de fornecedores">
          <div className="search-input-wrapper">
            <label htmlFor="fornecedorSearch" className="sr-only">Buscar fornecedores</label>
            <Search className="search-icon" size={20} aria-hidden="true" />
            <input
              id="fornecedorSearch"
              type="text"
              placeholder="Buscar por razão social, nome ou CNPJ..."
              className="search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar fornecedores"
            />
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="btn btn-primary btn-lg"
          >
            <Plus size={20} />
            Novo Fornecedor
          </button>
        </div>
      </section>

      {isLoading && renderTableSkeleton()}

      {!isLoading && (
        <section className="table-wrapper fornecedores-table-wrapper" aria-label="Lista de fornecedores">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-cell text-center">ID</th>
                  <th className="table-cell">Razão Social</th>
                  <th className="table-cell">Nome Fantasia</th>
                  <th className="table-cell">CNPJ/CPF</th>
                  <th className="table-cell text-center">UF</th>
                  <th className="table-cell">Contato</th>
                  <th className="table-cell text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12">
                      <div className="empty-state">
                        <div className="empty-state-icon">
                          <Users className="w-16 h-16 mx-auto" />
                        </div>
                        <h3 className="empty-state-title">
                          {search ? 'Nenhum fornecedor encontrado' : 'Nenhum fornecedor cadastrado'}
                        </h3>
                        <p className="empty-state-description">
                          {search
                            ? 'Tente ajustar os termos da busca para encontrar o que procura.'
                            : 'Comece cadastrando seu primeiro fornecedor clicando no botão acima.'
                          }
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((forn) => (
                    <tr key={forn.id}>
                      <td className="table-cell text-center td-mono">#{forn.id}</td>
                      <td className="table-cell font-medium">{forn.nome}</td>
                      <td className="table-cell td-muted">{forn.nomeFantasia || 'Não informado'}</td>
                      <td className="table-cell td-mono">{formatCnpjCpf(forn.cnpjCpf)}</td>
                      <td className="table-cell text-center td-muted">{forn.uf || 'Não informado'}</td>
                      <td className="table-cell">{renderContact(forn)}</td>
                      <td className="table-cell table-cell-actions">
                        <div className="action-buttons">
                          <button
                            onClick={() => handleOpenModal(forn)}
                            className="btn btn-action btn-icon"
                            aria-label={`Editar ${forn.nome}`}
                            title="Editar"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(forn.id, forn.nome)}
                            className="btn btn-action-danger btn-icon"
                            aria-label={`Excluir ${forn.nome}`}
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
        </section>
      )}

      {/* Modal de Criação / Edição */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}>
          <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="modal-header">
              <h2 id="modal-title" className="modal-title">
                {editingId ? 'Editar Fornecedor' : 'Novo Fornecedor'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="modal-close"
                aria-label="Fechar modal"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <form id="fornecedorForm" onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="form-group">
                    <label htmlFor="nome" className="required">Razão Social</label>
                    <input
                      required
                      id="nome"
                      name="nome"
                      value={formData.nome}
                      onChange={handleChange}
                      className="w-full"
                      placeholder="Ex: Empresa ABC Ltda"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="nomeEmpresa">Nome da Empresa</label>
                    <input
                      id="nomeEmpresa"
                      name="nomeEmpresa"
                      value={formData.nomeEmpresa}
                      onChange={handleChange}
                      className="w-full"
                      placeholder="Ex: ABC (se diferente da razão social)"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="nomeFantasia">Nome Fantasia</label>
                    <input
                      id="nomeFantasia"
                      name="nomeFantasia"
                      value={formData.nomeFantasia}
                      onChange={handleChange}
                      className="w-full"
                      placeholder="Ex: ABC"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="cnpjCpf">CNPJ/CPF</label>
                    <input
                      id="cnpjCpf"
                      name="cnpjCpf"
                      value={formData.cnpjCpf}
                      onChange={handleChange}
                      maxLength={18}
                      inputMode="numeric"
                      className="w-full"
                      placeholder="00.000.000/0000-00"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="mnemonico">Mnemônico</label>
                    <input
                      id="mnemonico"
                      name="mnemonico"
                      value={formData.mnemonico}
                      onChange={handleChange}
                      className="w-full"
                      placeholder="Ex: ABC"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="email">E-mail</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full"
                      placeholder="contato@empresa.com"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="telefones">Telefones</label>
                    <input
                      id="telefones"
                      name="telefones"
                      value={formData.telefones}
                      onChange={handleChange}
                      maxLength={15}
                      inputMode="numeric"
                      className="w-full"
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                  <div className="form-group md:col-span-2">
                    <label htmlFor="enderecoCompleto">Endereço Completo</label>
                    <input
                      id="enderecoCompleto"
                      name="enderecoCompleto"
                      value={formData.enderecoCompleto}
                      onChange={handleChange}
                      className="w-full"
                      placeholder="Rua, número, bairro, cidade - UF"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="cep">CEP</label>
                    <input
                      id="cep"
                      name="cep"
                      value={formData.cep}
                      onChange={handleChange}
                      maxLength={9}
                      inputMode="numeric"
                      className="w-full"
                      placeholder="00000-000"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="uf">UF</label>
                    <input
                      id="uf"
                      name="uf"
                      value={formData.uf}
                      onChange={handleChange}
                      maxLength={2}
                      placeholder="SP"
                      className="w-full uppercase"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="banco">Banco</label>
                    <input
                      id="banco"
                      name="banco"
                      value={formData.banco}
                      onChange={handleChange}
                      className="w-full"
                      placeholder="Ex: Banco do Brasil"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="agencia">Agência</label>
                    <input
                      id="agencia"
                      name="agencia"
                      value={formData.agencia}
                      onChange={handleChange}
                      className="w-full"
                      placeholder="0000"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="contaCorrente">Conta Corrente</label>
                    <input
                      id="contaCorrente"
                      name="contaCorrente"
                      value={formData.contaCorrente}
                      onChange={handleChange}
                      className="w-full"
                      placeholder="00000-0-1"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="chavePix">Chave PIX</label>
                    <input
                      id="chavePix"
                      name="chavePix"
                      value={formData.chavePix}
                      onChange={handleChange}
                      className="w-full"
                      placeholder="CPF, e-mail ou chave aleatória"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="categoria">Categoria</label>
                    <input
                      id="categoria"
                      name="categoria"
                      value={formData.categoria}
                      onChange={handleChange}
                      className="w-full"
                      placeholder="Ex: Matéria-prima, Embalagem"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="prazoPagamentoPadrao">Prazo Pagto. Padrão</label>
                    <input
                      id="prazoPagamentoPadrao"
                      name="prazoPagamentoPadrao"
                      value={formData.prazoPagamentoPadrao}
                      onChange={handleChange}
                      className="w-full"
                      placeholder="Ex: 30 dias"
                    />
                  </div>
                  <div className="form-group md:col-span-2">
                    <label htmlFor="historicoAtendimento">Histórico / Observações</label>
                    <textarea
                      id="historicoAtendimento"
                      name="historicoAtendimento"
                      value={formData.historicoAtendimento}
                      onChange={handleChange}
                      rows={3}
                      className="w-full resize-y"
                      placeholder="Informações adicionais sobre o fornecedor..."
                    ></textarea>
                  </div>
                </div>
              </form>
            </div>

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
                form="fornecedorForm"
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

export default FornecedoresPage;
