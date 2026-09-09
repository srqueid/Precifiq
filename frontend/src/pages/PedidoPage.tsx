import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ShoppingCart, Users, Search, Truck, CheckCircle, X, Package, Trash2, FileText, Edit2, Barcode, DollarSign, TrendingUp } from 'lucide-react';

// Toast utility
const toast = (msg: string, type: 'success' | 'error' = 'success') => {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  requestAnimationFrame(() => { el.classList.add('show'); });
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3000);
};

interface ProdutoItem {
  nome: string;
  qtd: number;
  preco: number;
  tipo?: 'PRODUTO' | 'KIT' | 'OUTRO';
  precoOriginal?: number;
  desconto?: number;
  custoUnitario?: number;
}

interface ProdutoDisponivel {
  id: number;
  produtoNome: string;
  nomeTamanho: string;
  custoUnitarioCalculado: number;
  precoVenda: number;
  margemLucro: number;
  codigoBarras?: string;
}

interface KitDisponivel {
  id: number;
  nome: string;
  descricao?: string;
  margemLucro?: number;
  custoTotalCalculado?: number;
  precoVenda: number;
  codigoBarras?: string;
}

interface Pedido {
  id?: number;
  clienteId: number;
  clienteNome: string;
  produtos?: ProdutoItem[];
  itens?: ProdutoItem[];
  valor?: number;
  valorCustoTotal?: number;
  lucroBruto?: number;
  formaPagamento: string;
  dataPagamento?: string;
  entregue: boolean;
}

interface Cliente {
  id: number;
  nome: string;
  telefone?: string;
  email?: string;
  endereco?: string;
}

const toNumber = (value: unknown, fallback = 0): number => {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizarPedido = (pedido: any): Pedido => {
  const itens = Array.isArray(pedido.itens)
    ? pedido.itens
    : Array.isArray(pedido.produtos)
      ? pedido.produtos
      : [];

  const produtos = itens
    .map((item: any) => ({
      nome: String(item?.nome ?? item?.nomeProduto ?? item?.insumoNome ?? ''),
      qtd: toNumber(item?.qtd ?? item?.quantidade),
      preco: toNumber(item?.preco ?? item?.precoUnitario),
      tipo: item?.tipo,
      precoOriginal: item?.precoOriginal ? toNumber(item.precoOriginal) : undefined,
      desconto: item?.desconto ? toNumber(item.desconto) : undefined,
    }))
    .filter((item: ProdutoItem) => item.nome || item.qtd > 0 || item.preco > 0);

  const valorFallback = produtos.reduce((acc: number, item: ProdutoItem) => acc + item.qtd * item.preco, 0);

  return {
    id: toNumber(pedido.id),
    clienteId: toNumber(pedido.clienteId),
    clienteNome: String(pedido.clienteNome ?? pedido.cliente ?? pedido.fornecedorNome ?? pedido.fornecedor?.nome ?? 'Sem cliente'),
    produtos,
    itens: produtos,
    valor: toNumber(pedido.valor ?? pedido.valorTotal ?? pedido.valorFinalConfirmado, valorFallback),
    valorCustoTotal: pedido.valorCustoTotal !== undefined && pedido.valorCustoTotal !== null ? toNumber(pedido.valorCustoTotal) : undefined,
    lucroBruto: pedido.lucroBruto !== undefined && pedido.lucroBruto !== null ? toNumber(pedido.lucroBruto) : undefined,
    formaPagamento: String(pedido.formaPagamento ?? '—'),
    dataPagamento: pedido.dataPagamento ? String(pedido.dataPagamento) : undefined,
    entregue: Boolean(pedido.entregue),
  };
};

const PedidoPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [itensDoPedidoAtual, setItensDoPedidoAtual] = useState<ProdutoItem[]>([]);
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('TODOS');
  const [filtroPagamento, setFiltroPagamento] = useState('TODOS');
  const [modalClienteOpen, setModalClienteOpen] = useState(false);
  const [modalPedidoOpen, setModalPedidoOpen] = useState(false);
  const [modalRelatorioOpen, setModalRelatorioOpen] = useState(false);
  const [modalGerenciarClientesOpen, setModalGerenciarClientesOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Form states & Edit IDs
  const [editingPedidoId, setEditingPedidoId] = useState<number | null>(null);
  const [editingClienteId, setEditingClienteId] = useState<number | null>(null);
  const [buscaClienteGerenciar, setBuscaClienteGerenciar] = useState('');

  const [clienteNome, setClienteNome] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [clienteEmail, setClienteEmail] = useState('');
  const [clienteEndereco, setClienteEndereco] = useState('');
  const [pedidoClienteId, setPedidoClienteId] = useState<number | ''>('');
  const [buscaCliente, setBuscaCliente] = useState('');
  const [itemNome, setItemNome] = useState('');
  const [itemQtd, setItemQtd] = useState('1');
  const [itemPreco, setItemPreco] = useState('');
  const [tipoItem, setTipoItem] = useState<'PRODUTO' | 'KIT' | 'OUTRO'>('PRODUTO');
  const [selectedProdutoId, setSelectedProdutoId] = useState<number | ''>('');
  const [selectedKitId, setSelectedKitId] = useState<number | ''>('');
  const [itemPrecoBase, setItemPrecoBase] = useState<number>(0);
  const [itemDesconto, setItemDesconto] = useState<number>(0);
  const [pedidoPagamento, setPedidoPagamento] = useState('Pix');
  const [pedidoData, setPedidoData] = useState('');
  const [pedidoEntregue, setPedidoEntregue] = useState(false);
  const [relatorioClienteId, setRelatorioClienteId] = useState<number | ''>('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeLoading, setBarcodeLoading] = useState(false);

  const { data, isLoading: queryLoading, error } = useQuery({
    queryKey: ['pedidos'],
    queryFn: async () => {
      const res = await fetch('/pedidos-operacionais/json');
      if (!res.ok) throw new Error('Erro ao buscar pedidos');
      const json = await res.json();
      return { pedidos: Array.isArray(json.pedidos) ? json.pedidos.map(normalizarPedido) : [] };
    }
  });

  const { data: clientesData } = useQuery({
    queryKey: ['clientes'],
    queryFn: async () => {
      const res = await fetch('/clientes');
      if (!res.ok) throw new Error('Erro ao buscar clientes');
      const json = await res.json();
      return Array.isArray(json.clientes) ? json.clientes : [];
    }
  });

  const { data: produtosDisponiveis = [] } = useQuery<ProdutoDisponivel[]>({
    queryKey: ['produtos-disponiveis-pedidos'],
    queryFn: async () => {
      const res = await fetch('/api/kits/produtos-disponiveis');
      if (!res.ok) return [];
      return res.json();
    }
  });

  const { data: kitsDisponiveis = [] } = useQuery<KitDisponivel[]>({
    queryKey: ['kits-disponiveis-pedidos'],
    queryFn: async () => {
      const res = await fetch('/api/kits');
      if (!res.ok) return [];
      return res.json();
    }
  });

  useEffect(() => {
    if (data?.pedidos) {
      setPedidos(data.pedidos);
    }
    setIsLoading(queryLoading);
  }, [data, queryLoading]);

  useEffect(() => {
    if (clientesData) {
      setClientes(clientesData);
    }
  }, [clientesData]);

  const salvarClienteMutation = useMutation({
    mutationFn: async ({ id, cliente }: { id: number | null; cliente: Cliente }) => {
      const url = id ? `/clientes/${id}` : '/clientes';
      const method = id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cliente),
      });
      if (!res.ok) throw new Error('Erro ao salvar cliente');
      return res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      toast(variables.id ? 'Cliente atualizado com sucesso!' : 'Cliente cadastrado com sucesso!');
      fecharModalCliente();
      if (!variables.id && data) {
        const novoId = data.id || data.cliente?.id;
        const novoNome = data.nome || data.cliente?.nome || clienteNome;
        if (novoId) {
          setPedidoClienteId(novoId);
          setBuscaCliente(novoNome);
        }
      }
    }
  });

  const deletarClienteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/clientes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao excluir cliente');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      toast('Cliente excluído com sucesso!');
    }
  });

  const salvarPedidoMutation = useMutation({
    mutationFn: async (novoPedido: Pedido) => {
      const res = await fetch('/pedidos-operacionais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novoPedido),
      });
      if (!res.ok) throw new Error('Erro ao salvar pedido');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast('Pedido registrado com sucesso!');
      fecharModalPedido();
    }
  });

  const atualizarPedidoMutation = useMutation({
    mutationFn: async ({ id, pedido }: { id: number; pedido: Pedido }) => {
      const res = await fetch(`/pedidos-operacionais/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pedido),
      });
      if (!res.ok) throw new Error('Erro ao atualizar pedido');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast('Pedido atualizado com sucesso!');
      fecharModalPedido();
    }
  });

  const deletarPedidoMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/pedidos-operacionais/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao excluir pedido');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast('Pedido excluído com sucesso!');
    }
  });

  const toggleEntregueMutation = useMutation({
    mutationFn: async ({ id, entregue }: { id: number; entregue: boolean }) => {
      const res = await fetch(`/pedidos-operacionais/${id}/entregue`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entregue }),
      });
      if (!res.ok) throw new Error('Erro ao atualizar status');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
    }
  });

  const atualizarKPIs = (lista: Pedido[]) => {
    const totalPedidos = lista.length;
    const entregues = lista.filter(p => p.entregue).length;
    const pendentes = totalPedidos - entregues;
    const valorTotal = lista.reduce((acc, p) => acc + (p.valor || 0), 0);

    const kpiQtd = document.getElementById('kpi-qtd-pedidos');
    const kpiEntregues = document.getElementById('kpi-entregues-sub');
    const kpiValor = document.getElementById('kpi-valor-pedidos');
    const kpiPendentes = document.getElementById('kpi-pendentes-entrega');

    if (kpiQtd) kpiQtd.textContent = String(totalPedidos);
    if (kpiEntregues) kpiEntregues.textContent = `${entregues} entregues • ${pendentes} pendentes`;
    if (kpiValor) kpiValor.textContent = `R$ ${valorTotal.toFixed(2)}`;
    if (kpiPendentes) kpiPendentes.textContent = String(pendentes);
  };

  useEffect(() => {
    if (pedidos.length > 0) {
      atualizarKPIs(pedidos);
    }
  }, [pedidos]);

  const cadastrarClienteRapido = async (nomeDigitado?: string) => {
    const nome = (nomeDigitado || buscaCliente).trim();
    if (!nome) {
      toast('Digite o nome do cliente a cadastrar.', 'error');
      return;
    }
    try {
      const res = await fetch('/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome })
      });
      if (!res.ok) throw new Error('Falha ao cadastrar cliente');
      const novoCliente = await res.json();
      await queryClient.invalidateQueries({ queryKey: ['clientes'] });
      setPedidoClienteId(novoCliente.id);
      setBuscaCliente(novoCliente.nome);
      toast(`Cliente "${novoCliente.nome}" cadastrado com sucesso!`);
    } catch (err: any) {
      toast(err.message || 'Erro ao cadastrar cliente', 'error');
    }
  };

  const adicionarItemNaLista = () => {
    const nome = itemNome.trim();
    const qtd = parseInt(itemQtd) || 0;
    const preco = parseFloat(itemPreco) || 0;

    if (!nome) {
      toast('Selecione ou informe um produto ou kit.', 'error');
      return;
    }
    if (qtd <= 0) {
      toast('A quantidade deve ser maior que zero.', 'error');
      return;
    }
    if (preco < 0) {
      toast('O preço unitário não pode ser negativo.', 'error');
      return;
    }

    if (tipoItem === 'KIT' && itemDesconto > 0) {
      toast('Kits montados não permitem desconto!', 'error');
      return;
    }

    if (itemDesconto > 15) {
      toast('O desconto máximo permitido é de 15% por produto.', 'error');
      return;
    }

    const novoItem: ProdutoItem = {
      nome: itemDesconto > 0 ? `${nome} (desc. ${itemDesconto}%)` : nome,
      qtd,
      preco,
      tipo: tipoItem,
      precoOriginal: itemPrecoBase > 0 ? itemPrecoBase : preco,
      desconto: tipoItem === 'KIT' ? 0 : itemDesconto,
    };

    setItensDoPedidoAtual([...itensDoPedidoAtual, novoItem]);
    setSelectedProdutoId('');
    setSelectedKitId('');
    setItemNome('');
    setItemPrecoBase(0);
    setItemDesconto(0);
    setItemPreco('');
    setItemQtd('1');
  };

  const removerItemDaLista = (index: number) => {
    const novosItens = itensDoPedidoAtual.filter((_, i) => i !== index);
    setItensDoPedidoAtual(novosItens);
  };

  const handleScanBarcode = async (codigoDigitado?: string) => {
    const code = (codigoDigitado || barcodeInput).trim();
    if (!code) {
      toast('Digite ou escaneie o código de barras.', 'error');
      return;
    }
    setBarcodeLoading(true);
    try {
      const res = await fetch(`/api/codigo-barras/${encodeURIComponent(code)}`);
      if (!res.ok) throw new Error('Erro ao consultar código de barras');
      const data = await res.json();
      if (!data.encontrado) {
        toast(`Código de barras "${code}" não encontrado no sistema.`, 'error');
        return;
      }

      if (data.tipo === 'VARIACAO') {
        const itemNomeCompleto = `${data.produtoNome} (${data.nomeTamanho})`;
        const preco = Number(data.precoVenda) || 0;
        setItensDoPedidoAtual((prev) => {
          const idx = prev.findIndex((it) => it.nome.toLowerCase() === itemNomeCompleto.toLowerCase());
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], qtd: copy[idx].qtd + 1 };
            return copy;
          } else {
            return [
              ...prev,
              {
                nome: itemNomeCompleto,
                qtd: 1,
                preco: preco,
                tipo: 'PRODUTO',
                precoOriginal: preco,
                desconto: 0
              }
            ];
          }
        });
        toast(`"${itemNomeCompleto}" bipado com sucesso!`, 'success');
        setBarcodeInput('');
      } else if (data.tipo === 'KIT') {
        const itemNomeCompleto = `Kit: ${data.nome}`;
        const preco = Number(data.precoVenda) || 0;
        setItensDoPedidoAtual((prev) => {
          const idx = prev.findIndex((it) => it.nome.toLowerCase() === itemNomeCompleto.toLowerCase());
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], qtd: copy[idx].qtd + 1 };
            return copy;
          } else {
            return [
              ...prev,
              {
                nome: itemNomeCompleto,
                qtd: 1,
                preco: preco,
                tipo: 'KIT',
                precoOriginal: preco,
                desconto: 0
              }
            ];
          }
        });
        toast(`Kit "${data.nome}" bipado com sucesso!`, 'success');
        setBarcodeInput('');
      } else if (data.tipo === 'INSUMO') {
        toast(`Código "${code}" pertence ao insumo "${data.nome}". No pedido são aceitos produtos finais e kits.`, 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Falha na busca de código de barras', 'error');
    } finally {
      setBarcodeLoading(false);
    }
  };

  const calcularAnaliseFinanceiraPedido = () => {
    let totalCusto = 0;
    itensDoPedidoAtual.forEach((item) => {
      let custoUnit = 0;
      if (item.tipo === 'PRODUTO') {
        const p = produtosDisponiveis.find(
          (prod) =>
            `${prod.produtoNome} (${prod.nomeTamanho})`.toLowerCase() === item.nome.toLowerCase() ||
            item.nome.toLowerCase().startsWith(`${prod.produtoNome} (${prod.nomeTamanho})`.toLowerCase())
        );
        if (p) custoUnit = p.custoUnitarioCalculado || 0;
      } else if (item.tipo === 'KIT') {
        const kitNomePuro = item.nome.replace(/^Kit:\s*/i, '').trim().toLowerCase();
        const k = kitsDisponiveis.find((kit) => kit.nome.toLowerCase() === kitNomePuro);
        if (k) custoUnit = k.custoTotalCalculado || 0;
      }
      totalCusto += custoUnit * item.qtd;
    });

    const totalVenda = itensDoPedidoAtual.reduce((acc, i) => acc + i.qtd * i.preco, 0);
    const lucroBruto = totalVenda - totalCusto;
    const margemPercentual = totalVenda > 0 ? (lucroBruto / totalVenda) * 100 : 0;

    return { totalCusto, totalVenda, lucroBruto, margemPercentual };
  };

  const abrirModalCliente = (cliente?: Cliente) => {
    if (cliente) {
      setEditingClienteId(cliente.id);
      setClienteNome(cliente.nome);
      setClienteTelefone(cliente.telefone || '');
      setClienteEmail(cliente.email || '');
      setClienteEndereco(cliente.endereco || '');
    } else {
      setEditingClienteId(null);
      setClienteNome('');
      setClienteTelefone('');
      setClienteEmail('');
      setClienteEndereco('');
    }
    setModalClienteOpen(true);
  };

  const fecharModalCliente = () => {
    setModalClienteOpen(false);
    setEditingClienteId(null);
    setClienteNome('');
    setClienteTelefone('');
    setClienteEmail('');
    setClienteEndereco('');
  };

  const salvarCliente = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteNome.trim()) {
      alert('O nome do cliente é obrigatório.');
      return;
    }
    const clienteData: Cliente = {
      id: editingClienteId || 0,
      nome: clienteNome.trim(),
      telefone: clienteTelefone.trim() || undefined,
      email: clienteEmail.trim() || undefined,
      endereco: clienteEndereco.trim() || undefined,
    };
    salvarClienteMutation.mutate({ id: editingClienteId, cliente: clienteData });
  };

  const abrirModalPedido = (pedido?: Pedido) => {
    if (pedido) {
      setEditingPedidoId(pedido.id || null);
      setPedidoClienteId(pedido.clienteId || '');
      setBuscaCliente(pedido.clienteNome || '');
      setItensDoPedidoAtual(pedido.itens || pedido.produtos || []);
      setPedidoPagamento(pedido.formaPagamento || 'Pix');
      setPedidoData(pedido.dataPagamento || new Date().toISOString().split('T')[0]);
      setPedidoEntregue(pedido.entregue || false);
    } else {
      setEditingPedidoId(null);
      setItensDoPedidoAtual([]);
      setPedidoClienteId('');
      setBuscaCliente('');
      setPedidoPagamento('Pix');
      setPedidoData(new Date().toISOString().split('T')[0]);
      setPedidoEntregue(false);
    }
    setTipoItem('PRODUTO');
    setSelectedProdutoId('');
    setSelectedKitId('');
    setItemNome('');
    setItemQtd('1');
    setItemPreco('');
    setItemPrecoBase(0);
    setItemDesconto(0);
    setModalPedidoOpen(true);
  };

  const fecharModalPedido = () => {
    setModalPedidoOpen(false);
    setEditingPedidoId(null);
    setItensDoPedidoAtual([]);
    setPedidoClienteId('');
    setBuscaCliente('');
    setSelectedProdutoId('');
    setSelectedKitId('');
    setItemNome('');
    setItemQtd('1');
    setItemPreco('');
    setItemPrecoBase(0);
    setItemDesconto(0);
    setPedidoPagamento('Pix');
    setPedidoEntregue(false);
  };

  const abrirModalRelatorio = () => {
    setRelatorioClienteId('');
    setModalRelatorioOpen(true);
  };

  const fecharModalRelatorio = () => {
    setModalRelatorioOpen(false);
    setRelatorioClienteId('');
  };

  const salvarPedido = async (e: React.FormEvent) => {
    e.preventDefault();

    if (itensDoPedidoAtual.length === 0) {
      alert('Adicione pelo menos 1 produto ou kit antes de confirmar o pedido.');
      return;
    }

    let finalClienteId = pedidoClienteId;
    let finalClienteNome = '';

    if (finalClienteId === '') {
      const nomeDigitado = buscaCliente.trim();
      if (!nomeDigitado) {
        alert('Selecione ou informe o nome do cliente para o pedido.');
        return;
      }

      // Verifica se o cliente já existe pelo nome digitado
      const existente = clientes.find(c => c.nome.toLowerCase() === nomeDigitado.toLowerCase());
      if (existente) {
        finalClienteId = existente.id;
        finalClienteNome = existente.nome;
      } else {
        // Cadastra cliente automaticamente na hora
        try {
          const res = await fetch('/clientes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome: nomeDigitado })
          });
          if (!res.ok) throw new Error('Erro ao cadastrar novo cliente');
          const novo = await res.json();
          finalClienteId = novo.id;
          finalClienteNome = novo.nome;
          await queryClient.invalidateQueries({ queryKey: ['clientes'] });
        } catch (err: any) {
          alert(`Erro ao cadastrar cliente: ${err.message}`);
          return;
        }
      }
    } else {
      const c = clientes.find(item => item.id === finalClienteId);
      finalClienteNome = c?.nome || buscaCliente;
    }

    const totalPedido = itensDoPedidoAtual.reduce((acc, i) => acc + (i.qtd * i.preco), 0);

    const pedidoPayload: Pedido = {
      clienteId: finalClienteId as number,
      clienteNome: finalClienteNome,
      itens: [...itensDoPedidoAtual],
      valor: totalPedido,
      formaPagamento: pedidoPagamento,
      dataPagamento: pedidoData,
      entregue: pedidoEntregue,
    };

    if (editingPedidoId) {
      atualizarPedidoMutation.mutate({ id: editingPedidoId, pedido: pedidoPayload });
    } else {
      salvarPedidoMutation.mutate(pedidoPayload);
    }
  };

  const handleDeletePedido = (pedido: Pedido) => {
    if (window.confirm(`Deseja realmente excluir o pedido #${pedido.id} do cliente "${pedido.clienteNome}"?`)) {
      if (pedido.id) {
        deletarPedidoMutation.mutate(pedido.id);
      }
    }
  };

  const clientesFiltrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(buscaCliente.toLowerCase())
  );

  const totalPedidoAtual = itensDoPedidoAtual.reduce((acc, i) => acc + (i.qtd * i.preco), 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="skeleton skeleton-title mx-auto mb-4" style={{ width: '200px' }} />
          <p className="text-gray-500">Carregando pedidos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="card text-center">
          <p className="text-red-600">Erro: {(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page pedidos-page">
      <section className="page-toolbar card">
        <div className="page-heading">
          <div className="page-heading-icon">
            <ShoppingCart size={24} />
          </div>
          <div>
            <h1 className="page-title">Gestão Operacional de Pedidos</h1>
            <p className="page-subtitle">Gerencie pedidos de clientes e acompanhe entregas</p>
          </div>
        </div>

        <div className="toolbar-actions" aria-label="Ações de pedidos">
          <button className="btn btn-secondary btn-lg" onClick={() => setModalGerenciarClientesOpen(true)}>
            <Users size={18} /> Clientes ({clientes.length})
          </button>
          <button className="btn btn-primary btn-lg" onClick={() => abrirModalPedido()}>
            <ShoppingCart size={18} /> Novo Pedido
          </button>
          <button className="btn btn-secondary btn-lg" onClick={abrirModalRelatorio}>
            <FileText size={18} /> Relatório de Pedidos
          </button>
        </div>
      </section>

      <div className="kpi-grid" style={{ marginBottom: '24px' }}>
        <div className="kpi-card blue">
          <div className="kpi-icon blue"><ShoppingCart size={20} /></div>
          <div className="kpi-content">
            <div className="kpi-label">Pedidos Totais</div>
            <div className="kpi-value blue" id="kpi-qtd-pedidos">{pedidos.length}</div>
            <div className="kpi-trend text-muted" id="kpi-entregues-sub">
              {pedidos.filter(p => p.entregue).length} entregues • {pedidos.filter(p => !p.entregue).length} pendentes
            </div>
          </div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-icon green"><FileText size={20} /></div>
          <div className="kpi-content">
            <div className="kpi-label">Valor Total dos Pedidos</div>
            <div className="kpi-value green" id="kpi-valor-pedidos" title={`R$ ${pedidos.reduce((acc, p) => acc + (p.valor || 0), 0).toFixed(2)}`}>
              R$ {pedidos.reduce((acc, p) => acc + (p.valor || 0), 0).toFixed(2)}
            </div>
            <div className="kpi-trend text-muted">Soma dos produtos solicitados</div>
          </div>
        </div>
        <div className="kpi-card yellow">
          <div className="kpi-icon yellow"><Truck size={20} /></div>
          <div className="kpi-content">
            <div className="kpi-label">Aguardando Entrega</div>
            <div className="kpi-value yellow" id="kpi-pendentes-entrega">
              {pedidos.filter(p => !p.entregue).length}
            </div>
            <div className="kpi-trend down">Necessitam de envio</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Filtros de Gestão</div>
        <div className="form-row" style={{ marginBottom: 0 }}>
          <div className="form-group" style={{ flex: 2 }}>
            <label htmlFor="filtro-cliente">Buscar por Nome</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                id="filtro-cliente"
                placeholder="Nome de quem solicitou..."
                value={filtroCliente}
                onChange={(e) => setFiltroCliente(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="filtro-status">Status de Entrega</label>
            <select
              id="filtro-status"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="ENTREGUE">Entregue</option>
              <option value="PENDENTE">Pendente</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="filtro-pagamento">Forma de Pagamento</label>
            <select
              id="filtro-pagamento"
              value={filtroPagamento}
              onChange={(e) => setFiltroPagamento(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
            >
              <option value="TODOS">Todas as Formas</option>
              <option value="Pix">Pix</option>
              <option value="Cartão de Crédito">Cartão de Crédito</option>
              <option value="Dinheiro">Dinheiro</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Listagem de Pedidos Solicitados</div>
        <div className="table-wrapper">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-cell">Cliente</th>
                  <th className="table-cell">Produtos Solicitados</th>
                  <th className="table-cell text-right">Valor Total</th>
                  <th className="table-cell">Forma de Pagamento</th>
                  <th className="table-cell">Data de Pagamento</th>
                  <th className="table-cell">Status Entrega</th>
                  <th className="table-cell text-center">Ações</th>
                </tr>
              </thead>
              <tbody id="tb-pedidos">
                {pedidos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12">
                      <div className="empty-state">
                        <div className="empty-state-icon">
                          <Package className="w-16 h-16 mx-auto" />
                        </div>
                        <h3 className="empty-state-title">Nenhum pedido encontrado</h3>
                        <p className="empty-state-description">
                          Clique em "Novo Pedido" para criar o primeiro pedido.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pedidos
                    .filter(p => {
                      const matchesCliente = !filtroCliente || (p.clienteNome || '').toLowerCase().includes(filtroCliente.toLowerCase());
                      const matchesStatus = filtroStatus === 'TODOS' || p.entregue === (filtroStatus === 'ENTREGUE');
                      const matchesPagamento = filtroPagamento === 'TODOS' || p.formaPagamento === filtroPagamento;
                      return matchesCliente && matchesStatus && matchesPagamento;
                    })
                    .map((p, index) => {
                      const statusBadge = p.entregue
                        ? <span className="badge badge-green">✔ Entregue</span>
                        : <span className="badge badge-yellow">⏳ Pendente</span>;

                      const dataFormatada = p.dataPagamento ? p.dataPagamento.split('-').reverse().join('/') : '—';
                      const stringProdutos = (p.itens || p.produtos || []).map(item => `${item.nome} (x${item.qtd})`).join(', ');
 
                      return (
                        <tr key={index}>
                          <td className="table-cell font-medium">{p.clienteNome}</td>
                          <td className="table-cell" style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={stringProdutos}>
                            {stringProdutos || '—'}
                          </td>
                          <td className="table-cell text-right font-medium td-mono td-blue">
                            <div>R$ {(p.valor ?? 0).toFixed(2)}</div>
                            {p.lucroBruto !== undefined && p.lucroBruto !== null && (
                              <div style={{ fontSize: '11px', color: p.lucroBruto >= 0 ? '#059669' : '#dc2626', fontWeight: 600 }}>
                                Lucro: R$ {p.lucroBruto.toFixed(2)}
                              </div>
                            )}
                          </td>
                          <td className="table-cell"><span className="badge badge-gray">{p.formaPagamento}</span></td>
                          <td className="table-cell">{dataFormatada}</td>
                          <td className="table-cell">{statusBadge}</td>
                          <td className="table-cell text-center">
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                              <button
                                className={`btn btn-sm ${p.entregue ? 'btn-secondary' : 'btn-primary'}`}
                                onClick={() => {
                                  if (p.id) {
                                    toggleEntregueMutation.mutate({ id: p.id, entregue: !p.entregue });
                                  } else {
                                    setPedidos(prev => prev.map((ped, i) => 
                                      i === index ? { ...ped, entregue: !ped.entregue } : ped
                                    ));
                                  }
                                }}
                                title={p.entregue ? 'Marcar como Pendente' : 'Marcar como Entregue'}
                              >
                                {p.entregue ? 'Pendente' : 'Entregue'}
                              </button>
                              <button
                                onClick={() => abrirModalPedido(p)}
                                className="btn btn-action btn-icon"
                                title="Editar Pedido"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => handleDeletePedido(p)}
                                className="btn btn-action-danger btn-icon"
                                title="Excluir Pedido"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Cliente */}
      {modalClienteOpen && (
        <div className="modal-overlay active" onClick={(e) => {
          if (e.target === e.currentTarget) fecharModalCliente();
        }}>
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingClienteId ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}</h3>
              <button className="modal-close" onClick={fecharModalCliente}>&times;</button>
            </div>
            <form id="form-cliente" onSubmit={salvarCliente}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label htmlFor="c-nome">Nome Completo *</label>
                <input
                  type="text"
                  id="c-nome"
                  required
                  placeholder="Ex: Maria Silva"
                  value={clienteNome}
                  onChange={(e) => setClienteNome(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label htmlFor="c-telefone">Telefone / WhatsApp</label>
                <input
                  type="text"
                  id="c-telefone"
                  placeholder="Ex: (61) 99999-9999"
                  value={clienteTelefone}
                  onChange={(e) => setClienteTelefone(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label htmlFor="c-email">E-mail</label>
                <input
                  type="email"
                  id="c-email"
                  placeholder="Ex: cliente@email.com"
                  value={clienteEmail}
                  onChange={(e) => setClienteEmail(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="c-endereco">Endereço de Entrega</label>
                <input
                  type="text"
                  id="c-endereco"
                  placeholder="Rua, Número, Bairro, Cidade"
                  value={clienteEndereco}
                  onChange={(e) => setClienteEndereco(e.target.value)}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={fecharModalCliente}>Cancelar</button>
                <button type="submit" className="btn btn-primary">
                  {editingClienteId ? 'Atualizar Cliente' : 'Salvar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pedido */}
      {modalPedidoOpen && (
        <div className="modal-overlay active" onClick={(e) => {
          if (e.target === e.currentTarget) fecharModalPedido();
        }}>
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingPedidoId ? `Editar Pedido #${editingPedidoId}` : 'Cadastrar Novo Pedido'}</h3>
              <button className="modal-close" onClick={fecharModalPedido}>&times;</button>
            </div>

            <form id="form-pedido" onSubmit={salvarPedido} className="modal-body-scroll">
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label htmlFor="p-cliente-busca" style={{ margin: 0 }}>Cliente *</label>
                  {pedidoClienteId === '' && buscaCliente.trim() && !clientes.some(c => c.nome.toLowerCase() === buscaCliente.trim().toLowerCase()) && (
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => cadastrarClienteRapido(buscaCliente)}
                      style={{ fontSize: '12px', padding: '2px 8px' }}
                    >
                      <Plus size={14} /> Cadastrar "{buscaCliente.trim()}"
                    </button>
                  )}
                </div>

                {pedidoClienteId !== '' ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--green-dim)', border: '1px solid var(--green)', borderRadius: 'var(--radius)', fontSize: '14px' }}>
                    <div>
                      <span style={{ color: 'var(--green)', fontWeight: 600 }}>✓ Cliente Selecionado: </span>
                      <strong>{clientes.find(c => c.id === pedidoClienteId)?.nome || buscaCliente}</strong>
                      {clientes.find(c => c.id === pedidoClienteId)?.telefone && (
                        <span style={{ color: 'var(--muted)', marginLeft: '8px', fontSize: '12px' }}>
                          ({clientes.find(c => c.id === pedidoClienteId)?.telefone})
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => {
                        setPedidoClienteId('');
                        setBuscaCliente('');
                      }}
                      style={{ fontSize: '12px', padding: '2px 8px' }}
                    >
                      Alterar Cliente
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ position: 'relative' }}>
                      <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                      <input
                        type="text"
                        id="p-cliente-busca"
                        placeholder="Digite o nome do cliente para buscar ou cadastrar..."
                        value={buscaCliente}
                        onChange={(e) => setBuscaCliente(e.target.value)}
                        style={{ paddingLeft: '36px' }}
                      />
                    </div>
                    {buscaCliente && (
                      <div style={{ marginTop: '6px', maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)', backgroundColor: 'var(--surface)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                        {!clientes.some(c => c.nome.toLowerCase() === buscaCliente.trim().toLowerCase()) && (
                          <div
                            onClick={() => cadastrarClienteRapido(buscaCliente)}
                            style={{
                              padding: '8px 12px',
                              cursor: 'pointer',
                              backgroundColor: 'rgba(59, 130, 246, 0.08)',
                              color: 'var(--accent, #3b82f6)',
                              borderBottom: '1px solid var(--border)',
                              fontSize: '13px',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <Plus size={14} /> + Cadastrar e selecionar "{buscaCliente.trim()}"
                          </div>
                        )}
                        {clientesFiltrados.map(cliente => (
                          <div
                            key={cliente.id}
                            onClick={() => {
                              setPedidoClienteId(cliente.id);
                              setBuscaCliente(cliente.nome);
                            }}
                            style={{
                              padding: '8px 12px',
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--border)',
                              fontSize: '14px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              backgroundColor: Number(pedidoClienteId) === cliente.id ? 'var(--green-dim)' : 'transparent'
                            }}
                          >
                            <strong>{cliente.nome}</strong>
                            {cliente.telefone && <span style={{ color: 'var(--muted)', fontSize: '12px' }}>{cliente.telefone}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="item-add-box" style={{ background: 'var(--surface-2, #f8fafc)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px', marginBottom: '16px' }}>
                {/* Leitor Rápido de Código de Barras */}
                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--accent, #3b82f6)',
                    borderRadius: 'var(--radius)',
                    padding: '8px 12px',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  <Barcode size={22} color="var(--accent, #3b82f6)" />
                  <input
                    type="text"
                    placeholder="Bipar ou digitar código de barras (EAN) e pressionar Enter..."
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleScanBarcode();
                      }
                    }}
                    style={{ flex: 1, height: '36px', fontSize: '13px' }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => handleScanBarcode()}
                    disabled={barcodeLoading || !barcodeInput.trim()}
                    style={{ height: '36px', padding: '0 12px', whiteSpace: 'nowrap' }}
                  >
                    {barcodeLoading ? 'Buscando...' : 'Bipar Item'}
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Ou Adicionar Manualmente pelo Catálogo:
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${tipoItem === 'PRODUTO' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '12px', padding: '4px 10px' }}
                      onClick={() => {
                        setTipoItem('PRODUTO');
                        setSelectedKitId('');
                        setSelectedProdutoId('');
                        setItemNome('');
                        setItemPreco('');
                        setItemPrecoBase(0);
                        setItemDesconto(0);
                      }}
                    >
                      🏷️ Produto Catálogo
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${tipoItem === 'KIT' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '12px', padding: '4px 10px' }}
                      onClick={() => {
                        setTipoItem('KIT');
                        setSelectedProdutoId('');
                        setSelectedKitId('');
                        setItemNome('');
                        setItemPreco('');
                        setItemPrecoBase(0);
                        setItemDesconto(0);
                      }}
                    >
                      📦 Kit Montado
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${tipoItem === 'OUTRO' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '12px', padding: '4px 10px' }}
                      onClick={() => {
                        setTipoItem('OUTRO');
                        setSelectedProdutoId('');
                        setSelectedKitId('');
                        setItemNome('');
                        setItemPreco('');
                        setItemPrecoBase(0);
                        setItemDesconto(0);
                      }}
                    >
                      ✏️ Personalizado
                    </button>
                  </div>
                </div>

                {tipoItem === 'PRODUTO' && (
                  <div className="form-group" style={{ marginBottom: '10px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--muted)' }}>Selecione o Produto (com preço de venda calculado):</label>
                    <select
                      id="p-item-produto-select"
                      value={selectedProdutoId}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : '';
                        setSelectedProdutoId(val);
                        if (val !== '') {
                          const prod = produtosDisponiveis.find(p => p.id === val);
                          if (prod) {
                            const nomeCompleto = `${prod.produtoNome} (${prod.nomeTamanho})`;
                            setItemNome(nomeCompleto);
                            setItemPrecoBase(prod.precoVenda);
                            const precoCalculado = prod.precoVenda * (1 - itemDesconto / 100);
                            setItemPreco(precoCalculado.toFixed(2));
                          }
                        } else {
                          setItemNome('');
                          setItemPrecoBase(0);
                          setItemPreco('');
                        }
                      }}
                    >
                      <option value="">-- Escolha um produto do catálogo --</option>
                      {produtosDisponiveis.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.produtoNome} ({p.nomeTamanho}) — Venda: R$ {p.precoVenda.toFixed(2)} (Margem: {p.margemLucro}%)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {tipoItem === 'KIT' && (
                  <div className="form-group" style={{ marginBottom: '10px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--muted)' }}>Selecione o Kit Montado:</label>
                    <select
                      id="p-item-kit-select"
                      value={selectedKitId}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : '';
                        setSelectedKitId(val);
                        if (val !== '') {
                          const kit = kitsDisponiveis.find(k => k.id === val);
                          if (kit) {
                            setItemNome(`Kit: ${kit.nome}`);
                            setItemPrecoBase(kit.precoVenda);
                            setItemPreco(kit.precoVenda.toFixed(2));
                            setItemDesconto(0);
                          }
                        } else {
                          setItemNome('');
                          setItemPrecoBase(0);
                          setItemPreco('');
                        }
                      }}
                    >
                      <option value="">-- Escolha um kit montado --</option>
                      {kitsDisponiveis.map(k => (
                        <option key={k.id} value={k.id}>
                          📦 {k.nome} — R$ {k.precoVenda.toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {tipoItem === 'OUTRO' && (
                  <div className="form-group" style={{ marginBottom: '10px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--muted)' }}>Nome do Item Personalizado:</label>
                    <input
                      type="text"
                      id="p-item-nome"
                      placeholder="Ex: Embalagem de presente, taxa de entrega..."
                      value={itemNome}
                      onChange={(e) => setItemNome(e.target.value)}
                    />
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr auto', gap: '8px', alignItems: 'end' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '11px', color: 'var(--muted)' }}>Qtd</label>
                    <input
                      type="number"
                      id="p-item-qtd"
                      step="1"
                      min="1"
                      value={itemQtd}
                      onChange={(e) => setItemQtd(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '11px', color: 'var(--muted)' }}>Preço Base (R$)</label>
                    <input
                      type="number"
                      id="p-item-base"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={itemPrecoBase > 0 ? itemPrecoBase : itemPreco}
                      disabled={tipoItem !== 'OUTRO'}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setItemPrecoBase(val);
                        const finalP = val * (1 - itemDesconto / 100);
                        setItemPreco(finalP.toFixed(2));
                      }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '11px', color: tipoItem === 'KIT' ? 'var(--muted)' : 'var(--accent)' }}>
                      {tipoItem === 'KIT' ? 'Desconto (Bloqueado)' : 'Desconto (máx 15%)'}
                    </label>
                    <input
                      type="number"
                      id="p-item-desconto"
                      step="1"
                      min="0"
                      max="15"
                      placeholder="0%"
                      value={tipoItem === 'KIT' ? 0 : itemDesconto}
                      disabled={tipoItem === 'KIT'}
                      onChange={(e) => {
                        let val = parseFloat(e.target.value) || 0;
                        if (val < 0) val = 0;
                        if (val > 15) {
                          val = 15;
                          toast('Desconto máximo permitido é 15%!', 'error');
                        }
                        setItemDesconto(val);
                        const base = itemPrecoBase > 0 ? itemPrecoBase : (parseFloat(itemPreco) || 0);
                        const finalP = base * (1 - val / 100);
                        setItemPreco(finalP.toFixed(2));
                      }}
                      style={{
                        backgroundColor: tipoItem === 'KIT' ? '#f1f5f9' : undefined,
                        borderColor: itemDesconto > 0 ? 'var(--green)' : undefined,
                        color: itemDesconto > 0 ? 'var(--green)' : undefined,
                        fontWeight: itemDesconto > 0 ? 600 : undefined
                      }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '11px', color: 'var(--muted)' }}>Preço Final Un.</label>
                    <input
                      type="number"
                      id="p-item-preco"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={itemPreco}
                      readOnly={tipoItem !== 'OUTRO'}
                      onChange={(e) => setItemPreco(e.target.value)}
                      style={{ fontWeight: 600 }}
                    />
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ height: '38px', whiteSpace: 'nowrap' }}
                    onClick={adicionarItemNaLista}
                  >
                    <Plus size={16} /> Adicionar
                  </button>
                </div>

                {tipoItem === 'KIT' && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>🔒</span> <em>Kits montados possuem valor fechado e não permitem desconto individual.</em>
                  </div>
                )}
                {tipoItem !== 'KIT' && itemDesconto > 0 && itemPrecoBase > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--green)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>🏷️</span> <strong>Desconto de {itemDesconto}% aplicado:</strong> Economia de R$ {((itemPrecoBase - (parseFloat(itemPreco) || 0)) * (parseInt(itemQtd) || 1)).toFixed(2)} no total deste item.
                  </div>
                )}
              </div>

              <label style={{ fontWeight: 600, fontSize: '13px' }}>Itens incluídos neste pedido:</label>
              <div className="itens-adicionados-lista" style={{ marginTop: '6px' }}>
                <table style={{ background: 'var(--surface)', width: '100%' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)' }}>
                      <th>Item</th>
                      <th className="text-center">Tipo</th>
                      <th className="text-right">Qtd</th>
                      <th className="text-right">Preço Un.</th>
                      <th className="text-center">Desc.</th>
                      <th className="text-right">Subtotal</th>
                      <th className="text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody id="tb-itens-temporarios">
                    {itensDoPedidoAtual.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="empty-state" style={{ padding: '16px', textAlign: 'center' }}>
                          Nenhum produto ou kit adicionado ainda.
                        </td>
                      </tr>
                    ) : (
                      itensDoPedidoAtual.map((item, index) => {
                        const subtotal = item.qtd * item.preco;
                        const hasDiscount = (item.desconto && item.desconto > 0) || (item.precoOriginal && item.precoOriginal > item.preco);
                        return (
                          <tr key={index}>
                            <td style={{ fontWeight: 500 }}>{item.nome}</td>
                            <td className="text-center">
                              {item.tipo === 'KIT' ? (
                                <span className="badge badge-purple" style={{ fontSize: '11px' }}>📦 Kit</span>
                              ) : item.tipo === 'PRODUTO' ? (
                                <span className="badge badge-blue" style={{ fontSize: '11px' }}>🏷️ Produto</span>
                              ) : (
                                <span className="badge badge-gray" style={{ fontSize: '11px' }}>✏️ Outro</span>
                              )}
                            </td>
                            <td className="text-right td-mono">{item.qtd}</td>
                            <td className="text-right td-mono">
                              {hasDiscount && item.precoOriginal ? (
                                <div>
                                  <span style={{ textDecoration: 'line-through', color: 'var(--muted)', fontSize: '11px', display: 'block' }}>
                                    R$ {item.precoOriginal.toFixed(2)}
                                  </span>
                                  <span>R$ {item.preco.toFixed(2)}</span>
                                </div>
                              ) : (
                                <span>R$ {item.preco.toFixed(2)}</span>
                              )}
                            </td>
                            <td className="text-center">
                              {item.tipo === 'KIT' ? (
                                <span style={{ color: 'var(--muted)', fontSize: '12px' }}>0%</span>
                              ) : item.desconto && item.desconto > 0 ? (
                                <span className="badge badge-green" style={{ fontSize: '11px' }}>
                                  -{item.desconto}%
                                </span>
                              ) : (
                                <span style={{ color: 'var(--muted)', fontSize: '12px' }}>-</span>
                              )}
                            </td>
                            <td className="text-right td-mono td-blue" style={{ fontWeight: 600 }}>R$ {subtotal.toFixed(2)}</td>
                            <td className="text-center">
                              <button
                                type="button"
                                className="btn btn-action-danger btn-icon"
                                style={{ padding: '4px' }}
                                onClick={() => removerItemDaLista(index)}
                                title="Remover item"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Painel Financeiro do Pedido: CMV, Lucro Bruto e Margem */}
              {(() => {
                const { totalCusto, totalVenda, lucroBruto, margemPercentual } = calcularAnaliseFinanceiraPedido();
                return (
                  <div
                    style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      padding: '12px 16px',
                      marginTop: '16px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>
                        Custo Estimado (CMV)
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>
                        R$ {totalCusto.toFixed(2)}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>
                        Lucro Bruto Projetado
                      </div>
                      <div
                        style={{
                          fontSize: '15px',
                          fontWeight: 700,
                          color: lucroBruto >= 0 ? '#10b981' : '#ef4444'
                        }}
                      >
                        R$ {lucroBruto.toFixed(2)}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>
                        Margem Projetada
                      </div>
                      <div
                        style={{
                          fontSize: '15px',
                          fontWeight: 700,
                          color: margemPercentual >= 30 ? '#10b981' : margemPercentual > 0 ? '#f59e0b' : '#ef4444'
                        }}
                      >
                        {margemPercentual.toFixed(1)}%
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>
                        Total do Pedido
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent)' }} id="p-pedido-total-label">
                        R$ {totalVenda.toFixed(2)}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <hr style={{ margin: '16px 0' }} />

              <div className="form-row" style={{ marginBottom: '16px' }}>
                <div className="form-group">
                  <label htmlFor="p-pagamento">Forma de Pagamento</label>
                  <select
                    id="p-pagamento"
                    value={pedidoPagamento}
                    onChange={(e) => setPedidoPagamento(e.target.value)}
                  >
                    <option value="Pix">Pix</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Dinheiro">Dinheiro</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="p-data">Data de Pagamento</label>
                  <input
                    type="date"
                    id="p-data"
                    value={pedidoData}
                    onChange={(e) => setPedidoData(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="check-label">
                  <input
                    type="checkbox"
                    id="p-entregue"
                    checked={pedidoEntregue}
                    onChange={(e) => setPedidoEntregue(e.target.checked)}
                  />
                  {' '}Já foi entregue?
                </label>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={fecharModalPedido}>Cancelar</button>
                <button type="submit" className="btn btn-primary">
                  <CheckCircle size={18} /> {editingPedidoId ? 'Atualizar Pedido' : 'Confirmar Pedido'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Relatório de Pedidos por Cliente */}
      {modalRelatorioOpen && (
        <div className="modal-overlay active" onClick={(e) => {
          if (e.target === e.currentTarget) fecharModalRelatorio();
        }}>
          <div className="modal-content" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h3>Relatório de Pedidos por Cliente</h3>
              <button className="modal-close" onClick={fecharModalRelatorio}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label htmlFor="relatorio-cliente">Selecionar Cliente</label>
                <select
                  id="relatorio-cliente"
                  value={relatorioClienteId}
                  onChange={(e) => setRelatorioClienteId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                >
                  <option value="">Selecione um cliente...</option>
                  {clientes.map(cliente => (
                    <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>
                  ))}
                </select>
              </div>

              {relatorioClienteId !== '' && (() => {
                const pedidosCliente = pedidos.filter(p => p.clienteId === relatorioClienteId);
                const totalGasto = pedidosCliente.reduce((acc, p) => acc + (p.valor || 0), 0);
                const totalEntregues = pedidosCliente.filter(p => p.entregue).length;
                const totalPendentes = pedidosCliente.filter(p => !p.entregue).length;

                return (
                  <div>
                    <div className="kpi-grid" style={{ marginBottom: '16px' }}>
                      <div className="kpi-card blue">
                        <div className="kpi-label">Total de Pedidos</div>
                        <div className="kpi-value blue">{pedidosCliente.length}</div>
                      </div>
                      <div className="kpi-card green">
                        <div className="kpi-label">Valor Total Gasto</div>
                        <div className="kpi-value green">R$ {totalGasto.toFixed(2)}</div>
                      </div>
                      <div className="kpi-card yellow">
                        <div className="kpi-label">Pendentes</div>
                        <div className="kpi-value yellow">{totalPendentes}</div>
                      </div>
                      <div className="kpi-card green">
                        <div className="kpi-label">Entregues</div>
                        <div className="kpi-value green">{totalEntregues}</div>
                      </div>
                    </div>

                    {pedidosCliente.length === 0 ? (
                      <div className="empty-state" style={{ padding: '32px' }}>
                        <p>Nenhum pedido encontrado para este cliente.</p>
                      </div>
                    ) : (
                      <div className="table-wrapper">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr>
                                <th className="table-cell">Data</th>
                                <th className="table-cell">Itens</th>
                                <th className="table-cell text-right">Valor</th>
                                <th className="table-cell">Pagamento</th>
                                <th className="table-cell">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pedidosCliente.map((p, idx) => (
                                <tr key={idx}>
                                  <td className="table-cell">{p.dataPagamento || '—'}</td>
                                  <td className="table-cell" style={{ maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {(p.itens || p.produtos || []).map(item => `${item.nome} (x${item.qtd})`).join(', ') || '—'}
                                  </td>
                                  <td className="table-cell text-right font-medium td-mono td-blue">R$ {(p.valor || 0).toFixed(2)}</td>
                                  <td className="table-cell"><span className="badge badge-gray">{p.formaPagamento}</span></td>
                                  <td className="table-cell">
                                    <span className={p.entregue ? 'badge badge-green' : 'badge badge-yellow'}>
                                      {p.entregue ? 'Entregue' : 'Pendente'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={fecharModalRelatorio}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Gerenciar Clientes (CRUD Completo de Clientes) */}
      {modalGerenciarClientesOpen && (
        <div className="modal-overlay active" onClick={(e) => {
          if (e.target === e.currentTarget) setModalGerenciarClientesOpen(false);
        }}>
          <div className="modal-content" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={22} /> Gestão de Clientes ({clientes.length})
              </h3>
              <button className="modal-close" onClick={() => setModalGerenciarClientesOpen(false)}>&times;</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
                  <input
                    type="text"
                    placeholder="Buscar cliente por nome..."
                    value={buscaClienteGerenciar}
                    onChange={(e) => setBuscaClienteGerenciar(e.target.value)}
                    style={{ paddingLeft: '36px', width: '100%' }}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => abrirModalCliente()}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  <Plus size={16} /> Novo Cliente
                </button>
              </div>

              <div className="table-wrapper">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-cell">Nome</th>
                      <th className="table-cell">Telefone</th>
                      <th className="table-cell">E-mail</th>
                      <th className="table-cell">Endereço</th>
                      <th className="table-cell text-center" style={{ width: '90px' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientes.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-6 text-gray-500">
                          Nenhum cliente cadastrado ainda.
                        </td>
                      </tr>
                    ) : (
                      clientes
                        .filter(c => !buscaClienteGerenciar || c.nome.toLowerCase().includes(buscaClienteGerenciar.toLowerCase()))
                        .map(c => (
                          <tr key={c.id}>
                            <td className="table-cell font-medium">{c.nome}</td>
                            <td className="table-cell">{c.telefone || '—'}</td>
                            <td className="table-cell">{c.email || '—'}</td>
                            <td className="table-cell" style={{ maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.endereco}>
                              {c.endereco || '—'}
                            </td>
                            <td className="table-cell text-center">
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                <button
                                  onClick={() => abrirModalCliente(c)}
                                  className="btn btn-action btn-icon"
                                  title="Editar Cliente"
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button
                                  onClick={() => {
                                    if (window.confirm(`Deseja realmente excluir o cliente "${c.nome}"?`)) {
                                      deletarClienteMutation.mutate(c.id);
                                    }
                                  }}
                                  className="btn btn-action-danger btn-icon"
                                  title="Excluir Cliente"
                                >
                                  <Trash2 size={15} />
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
            <div className="modal-footer">
              <button type="button" onClick={() => setModalGerenciarClientesOpen(false)} className="btn btn-secondary">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PedidoPage;
