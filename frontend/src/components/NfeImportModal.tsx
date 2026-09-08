import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  FileUp, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  ArrowRight, 
  PackagePlus, 
  Building2, 
  FileText, 
  Truck, 
  DollarSign, 
  Layers, 
  RefreshCw,
  HelpCircle,
  Plus
} from 'lucide-react';

interface NfeFornecedorExtraido {
  cnpj?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  endereco?: string;
  uf?: string;
  telefone?: string;
  email?: string;
}

interface NfeItemExtraido {
  numeroItem: number;
  codigoProdutoFornecedor?: string;
  descricao: string;
  ncm?: string;
  cfop?: string;
  unidadeComercial: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

interface NfeDadosExtraidos {
  chaveAcesso?: string;
  numeroNota?: string;
  serie?: string;
  dataEmissao?: string;
  valorTotalProdutos: number;
  valorFrete: number;
  valorDesconto: number;
  valorTotalNota: number;
  fornecedor?: NfeFornecedorExtraido;
  itens: NfeItemExtraido[];
}

interface InsumoResumo {
  id: number;
  nome: string;
  unidadeMedidaId: number;
  unidadeSigla: string;
  precoAtual: number;
  estoqueAtual: number;
  isEmbalagem: boolean;
}

interface UnidadeMedida {
  id: number;
  nome: string;
  sigla: string;
}

interface ItemConciliacaoSugestao {
  itemNfe: NfeItemExtraido;
  insumoIdSugerido?: number | null;
  insumoNomeSugerido?: string | null;
  unidadeSiglaSugerida?: string | null;
  scoreConfianca: number;
  justificativa?: string | null;
  novoInsumoSugerido: boolean;
}

interface NfeAnaliseResponse {
  dadosNota: NfeDadosExtraidos;
  fornecedorExistenteId?: number | null;
  fornecedorExistenteNome?: string | null;
  itensConciliados: ItemConciliacaoSugestao[];
  insumosDisponiveis: InsumoResumo[];
  unidadesDisponiveis: UnidadeMedida[];
}

interface ItemConfirmacaoState {
  numeroItem: number;
  descricaoOriginal: string;
  quantidade: number;
  unidadeOriginal: string;
  valorUnitarioOriginal: number;
  valorTotalOriginal: number;
  insumoId: number | null; // null = criar novo insumo
  criarNovoInsumo: boolean;
  novoInsumoNome: string;
  novoInsumoUnidadeId: number;
  novoInsumoIsEmbalagem: boolean;
  scoreConfianca: number;
  justificativa?: string | null;
}

interface NfeImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (compraId: number) => void;
}

const fmtBrl = (val?: number) => (val ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const NfeImportModal: React.FC<NfeImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [analiseResult, setAnaliseResult] = useState<NfeAnaliseResponse | null>(null);
  const [itensState, setItensState] = useState<ItemConfirmacaoState[]>([]);
  const [successInfo, setSuccessInfo] = useState<{ compraId: number; mensagem: string } | null>(null);

  // Mutation para Upload e Análise com IA
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/ai/nfe/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detalhe || errorData.error || 'Erro ao analisar nota fiscal.');
      }

      return res.json() as Promise<NfeAnaliseResponse>;
    },
    onSuccess: (data) => {
      setAnaliseResult(data);
      const defaultUnidadeId = data.unidadesDisponiveis.find(u => u.sigla.toUpperCase() === 'UN')?.id || data.unidadesDisponiveis[0]?.id || 1;

      // Inicializa estado de edição dos itens
      const initialItens: ItemConfirmacaoState[] = data.itensConciliados.map((c) => {
        const isNovo = c.novoInsumoSugerido || !c.insumoIdSugerido;
        return {
          numeroItem: c.itemNfe.numeroItem,
          descricaoOriginal: c.itemNfe.descricao,
          quantidade: c.itemNfe.quantidade,
          unidadeOriginal: c.itemNfe.unidadeComercial,
          valorUnitarioOriginal: c.itemNfe.valorUnitario,
          valorTotalOriginal: c.itemNfe.valorTotal,
          insumoId: isNovo ? null : (c.insumoIdSugerido || null),
          criarNovoInsumo: isNovo,
          novoInsumoNome: c.itemNfe.descricao,
          novoInsumoUnidadeId: defaultUnidadeId,
          novoInsumoIsEmbalagem: c.itemNfe.descricao.toLowerCase().includes('frasco') || 
                                 c.itemNfe.descricao.toLowerCase().includes('valvula') || 
                                 c.itemNfe.descricao.toLowerCase().includes('tampa') || 
                                 c.itemNfe.descricao.toLowerCase().includes('caixa') || 
                                 c.itemNfe.descricao.toLowerCase().includes('embalagem'),
          scoreConfianca: c.scoreConfianca,
          justificativa: c.justificativa,
        };
      });

      setItensState(initialItens);
    },
  });

  // Mutation para Confirmar Entrada
  const confirmarMutation = useMutation({
    mutationFn: async () => {
      if (!analiseResult) throw new Error('Nenhum dado de nota disponível');

      const totalProdutos = analiseResult.dadosNota.valorTotalProdutos || itensState.reduce((acc, it) => acc + it.valorTotalOriginal, 0);
      const freteTotal = analiseResult.dadosNota.valorFrete || 0;

      // Rateio do frete proporcional
      const payloadItens = itensState.map((it) => {
        const rateioFrete = totalProdutos > 0 ? (it.valorTotalOriginal / totalProdutos) * freteTotal : 0;
        const precoComFrete = it.quantidade > 0 ? (it.valorTotalOriginal + rateioFrete) / it.quantidade : it.valorUnitarioOriginal;

        return {
          numeroItem: it.numeroItem,
          insumoId: it.insumoId,
          criarNovoInsumo: it.criarNovoInsumo,
          novoInsumoNome: it.novoInsumoNome,
          novoInsumoUnidadeId: it.novoInsumoUnidadeId,
          novoInsumoIsEmbalagem: it.novoInsumoIsEmbalagem,
          quantidade: it.quantidade,
          precoUnitario: Math.round(precoComFrete * 1000) / 1000,
          valorTotal: it.valorTotalOriginal + rateioFrete,
        };
      });

      const payload = {
        numeroNota: analiseResult.dadosNota.numeroNota,
        chaveAcesso: analiseResult.dadosNota.chaveAcesso,
        fornecedorCnpj: analiseResult.dadosNota.fornecedor?.cnpj,
        fornecedorNome: analiseResult.dadosNota.fornecedor?.razaoSocial || analiseResult.dadosNota.fornecedor?.nomeFantasia,
        fornecedorId: analiseResult.fornecedorExistenteId,
        valorFrete: freteTotal,
        valorDesconto: analiseResult.dadosNota.valorDesconto || 0,
        valorTotalNota: analiseResult.dadosNota.valorTotalNota,
        dataEmissao: analiseResult.dadosNota.dataEmissao,
        itens: payloadItens,
      };

      const res = await fetch('/api/ai/nfe/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detalhe || errorData.error || 'Falha ao confirmar entrada.');
      }

      return res.json() as Promise<{ success: boolean; compraId: number; mensagem: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['compras'] });
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      queryClient.invalidateQueries({ queryKey: ['estoqueProdutos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setSuccessInfo(data);
      onSuccess(data.compraId);
    },
  });

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      uploadMutation.mutate(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      uploadMutation.mutate(file);
    }
  };

  const handleItemInsumoChange = (numeroItem: number, insumoIdValue: string) => {
    setItensState((prev) =>
      prev.map((it) => {
        if (it.numeroItem !== numeroItem) return it;
        if (insumoIdValue === 'NOVO') {
          return {
            ...it,
            insumoId: null,
            criarNovoInsumo: true,
          };
        } else {
          const insumoIdNum = parseInt(insumoIdValue, 10);
          return {
            ...it,
            insumoId: insumoIdNum,
            criarNovoInsumo: false,
          };
        }
      })
    );
  };

  const handleNovoInsumoFieldChange = (numeroItem: number, field: keyof ItemConfirmacaoState, value: any) => {
    setItensState((prev) =>
      prev.map((it) => {
        if (it.numeroItem !== numeroItem) return it;
        return { ...it, [field]: value };
      })
    );
  };

  const handleReset = () => {
    setSelectedFile(null);
    setAnaliseResult(null);
    setItensState([]);
    setSuccessInfo(null);
    uploadMutation.reset();
    confirmarMutation.reset();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-content nfe-modal" 
        style={{ maxWidth: '1050px', width: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', padding: '8px', borderRadius: '10px', display: 'flex', color: 'white' }}>
              <Sparkles size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Entrada Inteligente de Nota Fiscal (NF-e)
                <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                  Google AI / Gemini Flash
                </span>
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Extraia itens, concilie com seu estoque e lance compras sem digitação manual.
              </p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ overflowY: 'auto', padding: '1.25rem 0', flex: 1 }}>
          
          {/* ETAPA 1: Upload (se ainda não analisou) */}
          {!analiseResult && !uploadMutation.isPending && !successInfo && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', padding: '2rem 1rem' }}>
              <div
                style={{
                  width: '100%',
                  maxWidth: '650px',
                  border: dragActive ? '2px dashed var(--accent)' : '2px dashed var(--border-strong)',
                  background: dragActive ? 'var(--accent-dim)' : 'var(--surface-2)',
                  borderRadius: '16px',
                  padding: '3rem 2rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xml,.pdf,.png,.jpg,.jpeg"
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', color: 'var(--accent)' }}>
                  <FileUp size={32} />
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--text)', marginBottom: '0.5rem' }}>
                  Arraste e solte sua Nota Fiscal aqui
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '1.25rem' }}>
                  Formatos suportados: <strong>XML de NF-e (SEFAZ)</strong>, <strong>PDF (DANFE)</strong> ou <strong>Imagens</strong>
                </p>
                <button type="button" className="btn btn-primary" style={{ padding: '0.6rem 1.5rem', borderRadius: '8px', fontWeight: '500' }}>
                  Selecionar Arquivo do Computador
                </button>
              </div>

              {uploadMutation.isError && (
                <div style={{ width: '100%', maxWidth: '650px', padding: '1rem', background: 'var(--red-dim)', border: '1px solid var(--red)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--red)' }}>
                  <AlertCircle size={20} />
                  <span style={{ fontSize: '0.875rem' }}>{uploadMutation.error?.message}</span>
                </div>
              )}
            </div>
          )}

          {/* ETAPA DE PROCESSAMENTO (LOADING) */}
          {uploadMutation.isPending && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', gap: '1.5rem' }}>
              <div style={{ position: 'relative' }}>
                <RefreshCw size={52} className="animate-spin text-accent" style={{ color: 'var(--accent)', animation: 'spin 1.5s linear infinite' }} />
                <Sparkles size={20} style={{ position: 'absolute', top: '-4px', right: '-4px', color: '#a855f7' }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: '600', color: 'var(--text)' }}>
                  Processando Nota Fiscal com IA...
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--muted)', marginTop: '0.4rem' }}>
                  Extraindo produtos, fornecedor e realizando conciliação semântica com o estoque.
                </p>
              </div>
            </div>
          )}

          {/* ETAPA DE SUCESSO */}
          {successInfo && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 2rem', gap: '1.25rem', textAlign: 'center' }}>
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'var(--green-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green)' }}>
                <CheckCircle2 size={44} />
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: '700', color: 'var(--text)' }}>
                Entrada Concluída com Sucesso!
              </h3>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', maxWidth: '500px' }}>
                {successInfo.mensagem}
              </p>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={handleReset}>
                  Importar Outra Nota
                </button>
                <button type="button" className="btn btn-primary" onClick={onClose}>
                  Fechar e Ver Compras
                </button>
              </div>
            </div>
          )}

          {/* ETAPA 2: Conferência e Conciliação */}
          {analiseResult && !successInfo && !uploadMutation.isPending && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Header com Dados da Nota e Fornecedor */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', background: 'var(--surface-2)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                
                {/* Fornecedor */}
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <Building2 size={20} style={{ color: 'var(--accent)', marginTop: '2px' }} />
                  <div>
                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: '600', letterSpacing: '0.5px' }}>
                      Fornecedor Emitente
                    </span>
                    <div style={{ fontWeight: '600', color: 'var(--text)', fontSize: '0.95rem' }}>
                      {analiseResult.dadosNota.fornecedor?.razaoSocial || analiseResult.dadosNota.fornecedor?.nomeFantasia || 'Não identificado'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      CNPJ: {analiseResult.dadosNota.fornecedor?.cnpj || 'N/D'}
                    </div>
                    {analiseResult.fornecedorExistenteId ? (
                      <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', background: 'var(--green-dim)', color: 'var(--green)', fontWeight: '500' }}>
                        ✓ Já cadastrado (#{analiseResult.fornecedorExistenteId})
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', background: 'var(--yellow-dim)', color: 'var(--yellow)', fontWeight: '500' }}>
                        + Será cadastrado automaticamente
                      </span>
                    )}
                  </div>
                </div>

                {/* Dados da NF */}
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <FileText size={20} style={{ color: 'var(--accent)', marginTop: '2px' }} />
                  <div>
                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: '600', letterSpacing: '0.5px' }}>
                      Dados do Documento
                    </span>
                    <div style={{ fontWeight: '600', color: 'var(--text)', fontSize: '0.95rem' }}>
                      NF-e Nº {analiseResult.dadosNota.numeroNota || 'S/N'} {analiseResult.dadosNota.serie ? `(Série ${analiseResult.dadosNota.serie})` : ''}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Emissão: {analiseResult.dadosNota.dataEmissao || 'N/D'} • {analiseResult.dadosNota.itens.length} itens extraídos
                    </div>
                  </div>
                </div>

                {/* Totais */}
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <DollarSign size={20} style={{ color: 'var(--green)', marginTop: '2px' }} />
                  <div>
                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: '600', letterSpacing: '0.5px' }}>
                      Valores da Nota
                    </span>
                    <div style={{ fontWeight: '700', color: 'var(--green)', fontSize: '1.1rem' }}>
                      {fmtBrl(analiseResult.dadosNota.valorTotalNota)}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Produtos: {fmtBrl(analiseResult.dadosNota.valorTotalProdutos)} {analiseResult.dadosNota.valorFrete > 0 ? `• Frete: ${fmtBrl(analiseResult.dadosNota.valorFrete)}` : ''}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabela de Conciliação dos Itens */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Layers size={18} />
                    Conferência e Vínculo de Insumos ({itensState.length})
                  </h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                    Revise as associações sugeridas pela IA antes de confirmar a entrada.
                  </span>
                </div>

                <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                        <th style={{ padding: '8px 12px', width: '40px' }}>#</th>
                        <th style={{ padding: '8px 12px', width: '32%' }}>Item da Nota (Fornecedor)</th>
                        <th style={{ padding: '8px 12px', width: '12%', textAlign: 'right' }}>Qtd / Un</th>
                        <th style={{ padding: '8px 12px', width: '12%', textAlign: 'right' }}>Vl. Unit</th>
                        <th style={{ padding: '8px 12px', width: '36%' }}>Insumo Correspondente no Estoque</th>
                        <th style={{ padding: '8px 12px', width: '8%', textAlign: 'center' }}>IA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itensState.map((item, idx) => {
                        const scorePct = Math.round(item.scoreConfianca * 100);
                        const isHigh = scorePct >= 85;
                        const isMed = scorePct >= 60 && scorePct < 85;

                        return (
                          <tr key={item.numeroItem} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                            <td style={{ padding: '10px 12px', color: 'var(--muted)', fontWeight: '600' }}>
                              {item.numeroItem}
                            </td>
                            
                            {/* Descrição Original */}
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ fontWeight: '600', color: 'var(--text)' }}>
                                {item.descricaoOriginal}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                                Total: {fmtBrl(item.valorTotalOriginal)}
                              </div>
                            </td>

                            {/* Qtd */}
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '500' }}>
                              {item.quantidade} <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>{item.unidadeOriginal}</span>
                            </td>

                            {/* Valor Unit */}
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '500' }}>
                              {fmtBrl(item.valorUnitarioOriginal)}
                            </td>

                            {/* Mapeamento / Insumo */}
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <select
                                  style={{
                                    width: '100%',
                                    padding: '6px 10px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border)',
                                    background: 'var(--surface)',
                                    color: 'var(--text)',
                                    fontSize: '0.85rem',
                                  }}
                                  value={item.criarNovoInsumo ? 'NOVO' : (item.insumoId?.toString() || 'NOVO')}
                                  onChange={(e) => handleItemInsumoChange(item.numeroItem, e.target.value)}
                                >
                                  <option value="NOVO">✨ [+ Cadastrar como Novo Insumo]</option>
                                  <optgroup label="Insumos Existentes">
                                    {analiseResult.insumosDisponiveis.map((ins) => (
                                      <option key={ins.id} value={ins.id}>
                                        {ins.nome} ({ins.unidadeSigla}) — Atual: {fmtBrl(ins.precoAtual)} | Saldo: {ins.estoqueAtual}
                                      </option>
                                    ))}
                                  </optgroup>
                                </select>

                                {/* Se for novo insumo, exibe campos rápidos de configuração */}
                                {item.criarNovoInsumo && (
                                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    <input
                                      type="text"
                                      placeholder="Nome do novo insumo"
                                      value={item.novoInsumoNome}
                                      onChange={(e) => handleNovoInsumoFieldChange(item.numeroItem, 'novoInsumoNome', e.target.value)}
                                      style={{
                                        flex: 1,
                                        padding: '4px 8px',
                                        fontSize: '0.78rem',
                                        borderRadius: '4px',
                                        border: '1px solid var(--border)',
                                        background: 'var(--surface-3)',
                                        color: 'var(--text)'
                                      }}
                                    />
                                    <select
                                      value={item.novoInsumoUnidadeId}
                                      onChange={(e) => handleNovoInsumoFieldChange(item.numeroItem, 'novoInsumoUnidadeId', parseInt(e.target.value, 10))}
                                      style={{
                                        padding: '4px 6px',
                                        fontSize: '0.78rem',
                                        borderRadius: '4px',
                                        border: '1px solid var(--border)',
                                        background: 'var(--surface-3)',
                                        color: 'var(--text)'
                                      }}
                                    >
                                      {analiseResult.unidadesDisponiveis.map((u) => (
                                        <option key={u.id} value={u.id}>{u.sigla}</option>
                                      ))}
                                    </select>
                                    <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--muted)', cursor: 'pointer' }}>
                                      <input
                                        type="checkbox"
                                        checked={item.novoInsumoIsEmbalagem}
                                        onChange={(e) => handleNovoInsumoFieldChange(item.numeroItem, 'novoInsumoIsEmbalagem', e.target.checked)}
                                      />
                                      Embalagem
                                    </label>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Badge de Confiança IA */}
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              {!item.criarNovoInsumo ? (
                                <span
                                  title={item.justificativa || 'Score de similaridade'}
                                  style={{
                                    fontSize: '0.75rem',
                                    fontWeight: '600',
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    background: isHigh ? 'var(--green-dim)' : isMed ? 'var(--yellow-dim)' : 'var(--accent-dim)',
                                    color: isHigh ? 'var(--green)' : isMed ? 'var(--yellow)' : 'var(--accent)',
                                    display: 'inline-block'
                                  }}
                                >
                                  {scorePct}%
                                </span>
                              ) : (
                                <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Novo</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {confirmarMutation.isError && (
                <div style={{ padding: '0.75rem 1rem', background: 'var(--red-dim)', border: '1px solid var(--red)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--red)', fontSize: '0.85rem' }}>
                  <AlertCircle size={18} />
                  <span>{confirmarMutation.error?.message}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {analiseResult && !successInfo ? (
            <>
              <button type="button" className="btn btn-secondary" onClick={handleReset} disabled={confirmarMutation.isPending}>
                Trocar Arquivo
              </button>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                  Total a lançar: <strong>{fmtBrl(analiseResult.dadosNota.valorTotalNota)}</strong>
                </span>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => confirmarMutation.mutate()}
                  disabled={confirmarMutation.isPending}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.5rem' }}
                >
                  {confirmarMutation.isPending ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Gravando Entrada...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      Confirmar e Lançar no Estoque
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
