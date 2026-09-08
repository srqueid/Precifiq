import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  X, 
  Plus, 
  Trash2, 
  AlertCircle, 
  ShoppingBag, 
  Truck, 
  DollarSign, 
  Package, 
  CheckCircle2 
} from 'lucide-react';

interface Fornecedor {
  id: number;
  nome: string;
  nomeFantasia?: string;
  cnpjCpf?: string;
}

interface Insumo {
  id: number;
  nome: string;
  preco: number;
  estoque: number;
  unidadeSigla?: string;
  unidadeNome?: string;
}

interface ItemCompraForm {
  insumoId: number;
  insumoNome: string;
  unidadeSigla: string;
  quantidade: number;
  precoUnitario: number;
}

interface ManualCompraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (compraId: number) => void;
}

const fmtBrl = (val: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

export const ManualCompraModal: React.FC<ManualCompraModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const queryClient = useQueryClient();

  // Estados do formulário
  const [fornecedorId, setFornecedorId] = useState<number | ''>('');
  const [justificativa, setJustificativa] = useState('');
  const [valorFrete, setValorFrete] = useState<string>('0');
  const [dataPrevista, setDataPrevista] = useState<string>('');
  const [receberImediatamente, setReceberImediatamente] = useState<boolean>(true);
  const [itens, setItens] = useState<ItemCompraForm[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados da adição de item avulso
  const [selectedInsumoId, setSelectedInsumoId] = useState<string>('');
  const [itemQuantidade, setItemQuantidade] = useState<number>(1);
  const [itemPrecoUnitario, setItemPrecoUnitario] = useState<string>('');

  // Busca fornecedores
  const { data: fornecedoresData = [] } = useQuery({
    queryKey: ['fornecedores'],
    queryFn: async () => {
      const res = await fetch('/fornecedores/json');
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : (json.fornecedores || []);
    },
    enabled: isOpen
  });
  const fornecedores: Fornecedor[] = Array.isArray(fornecedoresData) ? fornecedoresData : [];

  // Busca insumos disponíveis
  const { data: insumosData } = useQuery({
    queryKey: ['insumos'],
    queryFn: async () => {
      const res = await fetch('/insumos/json');
      if (!res.ok) return { insumos: [] };
      return res.json();
    },
    enabled: isOpen
  });

  const insumos: Insumo[] = useMemo(() => {
    if (!insumosData) return [];
    const rawList: any[] = Array.isArray(insumosData) ? insumosData : (insumosData.insumos || []);
    const unidades: any[] = insumosData.unidades || [];

    return rawList.map(item => {
      const u = unidades.find((u: any) => u.id === item.unidadeMedidaId);
      return {
        id: item.id,
        nome: item.nome,
        preco: Number(item.preco) || 0,
        estoque: Number(item.estoque) || 0,
        unidadeSigla: item.unidadeSigla || u?.sigla || ''
      };
    });
  }, [insumosData]);

  // Ao selecionar um insumo, autocompleta o preço unitário com o custo atual
  const handleInsumoSelectChange = (idStr: string) => {
    setSelectedInsumoId(idStr);
    if (!idStr) {
      setItemPrecoUnitario('');
      return;
    }
    const ins = insumos.find(i => i.id === Number(idStr));
    if (ins) {
      setItemPrecoUnitario(ins.preco.toFixed(2));
    }
  };

  // Adicionar item à lista
  const handleAddItem = () => {
    setErrorMsg(null);
    if (!selectedInsumoId) {
      setErrorMsg('Selecione um insumo para adicionar.');
      return;
    }

    const qtd = Number(itemQuantidade);
    const preco = parseFloat(itemPrecoUnitario.replace(',', '.'));

    if (isNaN(qtd) || qtd <= 0) {
      setErrorMsg('Informe uma quantidade válida maior que zero.');
      return;
    }

    if (isNaN(preco) || preco < 0) {
      setErrorMsg('Informe um preço unitário válido.');
      return;
    }

    const ins = insumos.find(i => i.id === Number(selectedInsumoId));
    if (!ins) return;

    // Se já estiver na lista, apenas atualiza
    const existingIndex = itens.findIndex(it => it.insumoId === ins.id);
    if (existingIndex >= 0) {
      const updated = [...itens];
      updated[existingIndex].quantidade += qtd;
      updated[existingIndex].precoUnitario = preco;
      setItens(updated);
    } else {
      setItens([
        ...itens,
        {
          insumoId: ins.id,
          insumoNome: ins.nome,
          unidadeSigla: ins.unidadeSigla || 'UN',
          quantidade: qtd,
          precoUnitario: preco
        }
      ]);
    }

    // Reset do form de item
    setSelectedInsumoId('');
    setItemQuantidade(1);
    setItemPrecoUnitario('');
  };

  const handleRemoveItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  // Totais calculados
  const totalItens = useMemo(() => {
    return itens.reduce((acc, it) => acc + (it.quantidade * it.precoUnitario), 0);
  }, [itens]);

  const freteNum = useMemo(() => {
    const p = parseFloat(valorFrete.replace(',', '.'));
    return isNaN(p) || p < 0 ? 0 : p;
  }, [valorFrete]);

  const totalCompra = totalItens + freteNum;

  // Mutation para salvar compra manual
  const criarCompraMutation = useMutation({
    mutationFn: async () => {
      if (itens.length === 0) {
        throw new Error('Adicione ao menos um insumo à compra.');
      }

      const payload = {
        fornecedorId: fornecedorId ? Number(fornecedorId) : null,
        justificativa: justificativa.trim() || 'Compra manual avulsa',
        valorFrete: freteNum,
        dataPrevistaNecessidade: dataPrevista || null,
        receberImediatamente,
        itens: itens.map(it => ({
          insumoId: it.insumoId,
          quantidade: it.quantidade,
          precoUnitario: it.precoUnitario
        }))
      };

      const res = await fetch('/compras/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Erro ao registrar compra manual.');
      }

      return res.json() as Promise<{ success: boolean; compraId: number; mensagem: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['compras'] });
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onSuccess(data.compraId);
      handleClose();
    },
    onError: (err: Error) => {
      setErrorMsg(err.message);
    }
  });

  const handleClose = () => {
    setFornecedorId('');
    setJustificativa('');
    setValorFrete('0');
    setDataPrevista('');
    setReceberImediatamente(true);
    setItens([]);
    setErrorMsg(null);
    setSelectedInsumoId('');
    setItemQuantidade(1);
    setItemPrecoUnitario('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div 
        className="modal-content" 
        style={{ maxWidth: '680px', width: '100%', overflowX: 'hidden' }}
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="modal-manual-compra-title"
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="page-heading-icon" style={{ width: '36px', height: '36px', borderRadius: '8px' }}>
              <ShoppingBag size={18} />
            </div>
            <div>
              <h2 id="modal-manual-compra-title" className="modal-title">Nova Compra Manual</h2>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Lançamento direto de compra e entrada de estoque</span>
            </div>
          </div>
          <button onClick={handleClose} className="modal-close" aria-label="Fechar modal">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); criarCompraMutation.mutate(); }}>
          <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto', overflowX: 'hidden', width: '100%', boxSizing: 'border-box' }}>
            {errorMsg && (
              <div style={{ background: 'var(--red-dim)', color: 'var(--red)', padding: '10px 14px', borderRadius: 'var(--radius)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={18} />
                <span style={{ fontSize: '14px' }}>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-4" style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
              {/* Fornecedor e Data */}
              <div className="form-row" style={{ marginBottom: 0 }}>
                <div className="form-group" style={{ flex: 2, minWidth: 0 }}>
                  <label htmlFor="compra-fornecedor">Fornecedor (opcional)</label>
                  <select
                    id="compra-fornecedor"
                    value={fornecedorId}
                    onChange={(e) => setFornecedorId(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">Nenhum / Compra Avulsa</option>
                    {fornecedores.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.nomeFantasia || f.nome} {f.cnpjCpf ? `(${f.cnpjCpf})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
                  <label htmlFor="compra-data-prevista">Data da Compra / Previsão</label>
                  <input
                    id="compra-data-prevista"
                    type="date"
                    value={dataPrevista}
                    onChange={(e) => setDataPrevista(e.target.value)}
                  />
                </div>
              </div>

              {/* Justificativa / Observação */}
              <div className="form-group">
                <label htmlFor="compra-justificativa">Justificativa / Descrição</label>
                <input
                  id="compra-justificativa"
                  type="text"
                  placeholder="Ex: Reposição semanal de essências e frascos"
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                />
              </div>

              {/* Seção Adicionar Insumos */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '16px', width: '100%' }}>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: '10px' }}>
                  Itens da Compra
                </label>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '14px', flexWrap: 'wrap', width: '100%' }}>
                  <div className="form-group" style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <label htmlFor="select-insumo-compra">Insumo</label>
                    <select
                      id="select-insumo-compra"
                      value={selectedInsumoId}
                      onChange={(e) => handleInsumoSelectChange(e.target.value)}
                      style={{ width: '100%' }}
                    >
                      <option value="">Selecione o insumo...</option>
                      {insumos.map(ins => (
                        <option key={ins.id} value={ins.id}>
                          {ins.nome} ({ins.unidadeSigla || 'UN'}) - Custo atual: {fmtBrl(ins.preco)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ width: '75px', minWidth: '60px', flex: '0 0 auto' }}>
                    <label htmlFor="qtd-insumo-compra">Qtd</label>
                    <input
                      id="qtd-insumo-compra"
                      type="number"
                      min="0.01"
                      step="any"
                      style={{ width: '100%' }}
                      value={itemQuantidade}
                      onChange={(e) => setItemQuantidade(parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <div className="form-group" style={{ width: '110px', minWidth: '90px', flex: '0 0 auto' }}>
                    <label htmlFor="preco-insumo-compra">Preço Unit. (R$)</label>
                    <input
                      id="preco-insumo-compra"
                      type="text"
                      placeholder="0,00"
                      style={{ width: '100%' }}
                      value={itemPrecoUnitario}
                      onChange={(e) => setItemPrecoUnitario(e.target.value)}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="btn btn-secondary"
                    style={{ height: '40px', whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    <Plus size={16} />
                    Adicionar
                  </button>
                </div>

                {/* Tabela de Itens Adicionados */}
                {itens.length === 0 ? (
                  <div style={{ padding: '16px', background: 'var(--surface-2)', borderRadius: 'var(--radius)', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                    Nenhum item adicionado à compra. Selecione um insumo acima e clique em Adicionar.
                  </div>
                ) : (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflowX: 'auto', width: '100%' }}>
                    <table style={{ width: '100%', minWidth: '100%' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '8px 12px' }}>Insumo</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>Qtd</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Preço Unit.</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Subtotal</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itens.map((item, idx) => (
                          <tr key={idx}>
                            <td style={{ padding: '8px 12px' }}>
                              <strong>{item.insumoNome}</strong>
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }} className="td-mono font-medium">
                              {item.quantidade} {item.unidadeSigla}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right' }} className="td-mono">
                              {fmtBrl(item.precoUnitario)}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right' }} className="td-mono font-medium">
                              {fmtBrl(item.quantidade * item.precoUnitario)}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="btn btn-action-danger btn-icon"
                                title="Remover Item"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Frete e Opções de Entrada */}
              <div className="form-row" style={{ marginTop: '16px', alignItems: 'center' }}>
                <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
                  <label htmlFor="compra-frete">Valor do Frete (R$)</label>
                  <input
                    id="compra-frete"
                    type="text"
                    placeholder="0,00"
                    value={valorFrete}
                    onChange={(e) => setValorFrete(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ flex: 2, minWidth: 0, justifyContent: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '18px' }}>
                    <input
                      type="checkbox"
                      checked={receberImediatamente}
                      onChange={(e) => setReceberImediatamente(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '13px', color: 'var(--text)' }}>
                      <strong>Dar entrada imediata no estoque</strong> (Atualiza saldos e custos agora)
                    </span>
                  </label>
                </div>
              </div>

              {/* Resumo da Compra */}
              <div style={{ background: 'var(--surface-2)', padding: '16px', borderRadius: 'var(--radius-lg)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', textAlign: 'center', width: '100%' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Subtotal Itens</div>
                  <div style={{ fontSize: '17px', fontWeight: 700, fontFamily: 'var(--mono)', marginTop: '4px' }}>
                    {fmtBrl(totalItens)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Frete</div>
                  <div style={{ fontSize: '17px', fontWeight: 700, fontFamily: 'var(--mono)', color: freteNum > 0 ? 'var(--yellow)' : 'var(--muted)', marginTop: '4px' }}>
                    {fmtBrl(freteNum)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Total da Compra</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--green)', marginTop: '4px' }}>
                    {fmtBrl(totalCompra)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              onClick={handleClose}
              className="btn btn-secondary"
              disabled={criarCompraMutation.isPending}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={criarCompraMutation.isPending || itens.length === 0}
            >
              {criarCompraMutation.isPending ? 'Salvando compra...' : 'Salvar Compra'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
