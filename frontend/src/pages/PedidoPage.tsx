import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ShoppingCart, Users, Search, Truck, CheckCircle, X, Package, Trash2, FileText, Edit2, Barcode, DollarSign, TrendingUp, Eye, Printer } from 'lucide-react';
import { maskPhone, onlyNumbers, maskCep } from '../utils/masks';

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
  variacaoId?: number;
  kitId?: number;
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
  valorFrete?: number;
  tipoEnvio?: string;
  cepDestino?: string;
  prazoEnvio?: string;
  comprimentoCm?: number;
  larguraCm?: number;
  alturaCm?: number;
  pesoKg?: number;
  formaPagamento: string;
  dataPagamento?: string;
  entregue: boolean;
}

export interface PacotePreset {
  id: 'P' | 'M' | 'G' | 'ENVELOPE' | 'CUSTOM';
  nome: string;
  descricao: string;
  comprimento: number;
  largura: number;
  altura: number;
  peso: number;
}

export const PACOTE_PRESETS: PacotePreset[] = [
  { id: 'P', nome: 'Caixa P', descricao: '16×11×6 cm • até 0.3 kg • Pequenos cosméticos, frascos', comprimento: 16, largura: 11, altura: 6, peso: 0.3 },
  { id: 'M', nome: 'Caixa M', descricao: '24×18×12 cm • até 0.8 kg • 2 a 5 produtos, kits padrão', comprimento: 24, largura: 18, altura: 12, peso: 0.8 },
  { id: 'G', nome: 'Caixa G', descricao: '32×24×18 cm • até 1.8 kg • Kits grandes, volumes médios', comprimento: 32, largura: 24, altura: 18, peso: 1.8 },
  { id: 'ENVELOPE', nome: 'Envelope', descricao: '20×15×3 cm • até 0.2 kg • Documentos, sachês planos', comprimento: 20, largura: 15, altura: 3, peso: 0.2 },
  { id: 'CUSTOM', nome: 'Personalizado', descricao: 'Digitar medidas e peso livremente', comprimento: 20, largura: 15, altura: 10, peso: 0.5 },
];

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

  const produtos: ProdutoItem[] = itens
    .map((item: any) => ({
      nome: String(item?.nome ?? item?.nomeProduto ?? item?.insumoNome ?? ''),
      qtd: toNumber(item?.qtd ?? item?.quantidade),
      preco: toNumber(item?.preco ?? item?.precoUnitario),
      tipo: item?.tipo,
      precoOriginal: item?.precoOriginal ? toNumber(item.precoOriginal) : undefined,
      desconto: item?.desconto ? toNumber(item.desconto) : undefined,
      custoUnitario: item?.custoUnitario !== undefined && item?.custoUnitario !== null ? toNumber(item.custoUnitario) : undefined,
      variacaoId: item?.variacaoId !== undefined && item?.variacaoId !== null ? toNumber(item.variacaoId) : undefined,
      kitId: item?.kitId !== undefined && item?.kitId !== null ? toNumber(item.kitId) : undefined,
    }))
    .filter((item: ProdutoItem) => item.nome || item.qtd > 0 || item.preco > 0);

  const valorFallback = produtos.reduce((acc: number, item: ProdutoItem) => acc + item.qtd * item.preco, 0);
  const custoFallback = produtos.reduce((acc: number, item: ProdutoItem) => acc + item.qtd * (item.custoUnitario ?? 0), 0);
  const frete = pedido.valorFrete !== undefined && pedido.valorFrete !== null
    ? toNumber(pedido.valorFrete)
    : (pedido.valor_frete !== undefined && pedido.valor_frete !== null ? toNumber(pedido.valor_frete) : 0);
  const valorTotal = toNumber(pedido.valor ?? pedido.valorTotal ?? pedido.valorFinalConfirmado, valorFallback + frete);
  const custoTotal = pedido.valorCustoTotal !== undefined && pedido.valorCustoTotal !== null
    ? toNumber(pedido.valorCustoTotal)
    : custoFallback;
  const lucroBruto = pedido.lucroBruto !== undefined && pedido.lucroBruto !== null
    ? toNumber(pedido.lucroBruto)
    : (valorFallback - custoTotal);

  return {
    id: toNumber(pedido.id),
    clienteId: toNumber(pedido.clienteId),
    clienteNome: String(pedido.clienteNome ?? pedido.cliente ?? pedido.fornecedorNome ?? pedido.fornecedor?.nome ?? 'Sem cliente'),
    produtos,
    itens: produtos,
    valor: valorTotal,
    valorCustoTotal: custoTotal,
    lucroBruto: lucroBruto,
    valorFrete: frete,
    tipoEnvio: String(pedido.tipoEnvio ?? pedido.tipo_envio ?? 'RETIRADA'),
    cepDestino: pedido.cepDestino || pedido.cep_destino || undefined,
    prazoEnvio: pedido.prazoEnvio || pedido.prazo_envio || undefined,
    comprimentoCm: pedido.comprimentoCm !== undefined && pedido.comprimentoCm !== null
      ? toNumber(pedido.comprimentoCm)
      : (pedido.comprimento_cm !== undefined ? toNumber(pedido.comprimento_cm) : 20.0),
    larguraCm: pedido.larguraCm !== undefined && pedido.larguraCm !== null
      ? toNumber(pedido.larguraCm)
      : (pedido.largura_cm !== undefined ? toNumber(pedido.largura_cm) : 15.0),
    alturaCm: pedido.alturaCm !== undefined && pedido.alturaCm !== null
      ? toNumber(pedido.alturaCm)
      : (pedido.altura_cm !== undefined ? toNumber(pedido.altura_cm) : 10.0),
    pesoKg: pedido.pesoKg !== undefined && pedido.pesoKg !== null
      ? toNumber(pedido.pesoKg)
      : (pedido.peso_kg !== undefined ? toNumber(pedido.peso_kg) : 0.5),
    formaPagamento: String(pedido.formaPagamento ?? '—'),
    dataPagamento: pedido.dataPagamento ? String(pedido.dataPagamento) : undefined,
    entregue: Boolean(pedido.entregue),
  };
};

const obterCustoUnitarioItem = (
  item: ProdutoItem,
  produtos: ProdutoDisponivel[],
  kits: KitDisponivel[]
): number => {
  if (item.custoUnitario !== undefined && item.custoUnitario > 0) {
    return item.custoUnitario;
  }
  if (item.tipo === 'KIT' || item.nome.toLowerCase().startsWith('kit:')) {
    const nomePuro = item.nome.replace(/^Kit:\s*/i, '').replace(/\s*\(desc\..*?\)/i, '').trim().toLowerCase();
    const k = kits.find(kit => (item.kitId && kit.id === item.kitId) || kit.nome.toLowerCase() === nomePuro);
    if (k && k.custoTotalCalculado) return k.custoTotalCalculado;
  } else {
    const nomeLimpo = item.nome.replace(/\s*\(desc\..*?\)/i, '').trim().toLowerCase();
    const p = produtos.find(prod => {
      if (item.variacaoId && prod.id === item.variacaoId) return true;
      const full = `${prod.produtoNome} (${prod.nomeTamanho})`.toLowerCase();
      return full === nomeLimpo || full.startsWith(nomeLimpo) || nomeLimpo.startsWith(full);
    });
    if (p && p.custoUnitarioCalculado) return p.custoUnitarioCalculado;
  }
  return 0;
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
  const [modalVisualizarOpen, setModalVisualizarOpen] = useState(false);
  const [pedidoVisualizando, setPedidoVisualizando] = useState<Pedido | null>(null);
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

  // Estados para Cálculo e Opções de Envio
  const [pedidoTipoEnvio, setPedidoTipoEnvio] = useState<string>('RETIRADA');
  const [pedidoValorFrete, setPedidoValorFrete] = useState<string>('0');
  const [pedidoCepDestino, setPedidoCepDestino] = useState<string>('');
  const [pedidoPrazoEnvio, setPedidoPrazoEnvio] = useState<string>('Imediato');
  const [cepDestinoInfo, setCepDestinoInfo] = useState<string>('');
  const [calculandoFrete, setCalculandoFrete] = useState<boolean>(false);
  const [opcoesFrete, setOpcoesFrete] = useState<{ id: string; nome: string; tipo: string; valor: number; prazo: string; descricao: string }[]>([]);
  const [destinoUf, setDestinoUf] = useState<string>('');

  // Estados de Pacote e Dimensões para Cálculo de Frete / Cubagem
  const [pacotePreset, setPacotePreset] = useState<'P' | 'M' | 'G' | 'ENVELOPE' | 'CUSTOM'>('M');
  const [comprimentoCm, setComprimentoCm] = useState<number>(24);
  const [larguraCm, setLarguraCm] = useState<number>(18);
  const [alturaCm, setAlturaCm] = useState<number>(12);
  const [pesoKg, setPesoKg] = useState<number>(0.8);

  const gerarOpcoesFrete = (
    uf: string,
    cCm: number,
    lCm: number,
    aCm: number,
    pKg: number,
    atualizarFreteSelecionado = true
  ) => {
    // Cálculo de Cubagem e Peso Tarifado Logístico Padrão
    const vCm3 = (cCm || 1) * (lCm || 1) * (aCm || 1);
    const pesoCubado = vCm3 / 6000;
    const pesoTarifado = Math.max(pKg || 0.1, pesoCubado);
    const pesoExcedente = Math.max(0, pesoTarifado - 0.5); // base até 500g

    // Sobretaxa de pacote volumoso (Correios: lado > 70cm ou soma > 200cm)
    const ehVolumoso = cCm > 70 || lCm > 70 || aCm > 70 || (cCm + lCm + aCm) > 200;
    const taxaVolumosoCorreios = ehVolumoso ? 79.00 : 0;
    const taxaVolumosoTransp = ehVolumoso ? 35.00 : 0;

    let pacBase = 24.90;
    let sedexBase = 42.00;
    let transpBase = 29.90;
    let taxaKgPac = 6.50;
    let taxaKgSedex = 12.00;
    let taxaKgTransp = 4.50;

    let prazoPac = '4 a 7 dias úteis';
    let prazoSedex = '1 a 2 dias úteis';
    let prazoTransp = '3 a 5 dias úteis';

    const ufUpper = (uf || '').toUpperCase();
    if (['DF', 'GO'].includes(ufUpper)) {
      pacBase = 17.50;
      taxaKgPac = 4.00;
      prazoPac = '2 a 4 dias úteis';
      sedexBase = 24.90;
      taxaKgSedex = 7.00;
      prazoSedex = '1 a 2 dias úteis';
      transpBase = 19.90;
      taxaKgTransp = 3.50;
      prazoTransp = '2 a 3 dias úteis';
    } else if (['SP', 'RJ', 'MG', 'ES', 'PR', 'SC', 'RS', 'MS', 'MT'].includes(ufUpper)) {
      pacBase = 26.50;
      taxaKgPac = 6.80;
      prazoPac = '4 a 7 dias úteis';
      sedexBase = 46.90;
      taxaKgSedex = 13.50;
      prazoSedex = '2 a 3 dias úteis';
      transpBase = 32.50;
      taxaKgTransp = 5.20;
      prazoTransp = '3 a 6 dias úteis';
    } else if (['BA', 'PE', 'CE', 'RN', 'PB', 'AL', 'SE', 'PI', 'MA'].includes(ufUpper)) {
      pacBase = 34.90;
      taxaKgPac = 9.50;
      prazoPac = '6 a 10 dias úteis';
      sedexBase = 62.00;
      taxaKgSedex = 18.00;
      prazoSedex = '2 a 4 dias úteis';
      transpBase = 39.90;
      taxaKgTransp = 7.00;
      prazoTransp = '5 a 8 dias úteis';
    } else {
      pacBase = 44.50;
      taxaKgPac = 13.00;
      prazoPac = '8 a 15 dias úteis';
      sedexBase = 79.90;
      taxaKgSedex = 24.00;
      prazoSedex = '3 a 5 dias úteis';
      transpBase = 52.00;
      taxaKgTransp = 9.50;
      prazoTransp = '7 a 12 dias úteis';
    }

    const pacFinal = pacBase + (pesoExcedente * taxaKgPac) + taxaVolumosoCorreios;
    const sedexFinal = sedexBase + (pesoExcedente * taxaKgSedex) + taxaVolumosoCorreios;
    const transpFinal = transpBase + (pesoExcedente * taxaKgTransp) + taxaVolumosoTransp;

    const listaOpcoes = [
      {
        id: 'pac',
        nome: 'Correios - PAC',
        tipo: 'CORREIOS_PAC',
        valor: Math.round(pacFinal * 100) / 100,
        prazo: prazoPac,
        descricao: `Econômico • Tarifado p/ ${pesoTarifado.toFixed(2)} kg${ehVolumoso ? ' (+ taxa volumoso)' : ''}`
      },
      {
        id: 'sedex',
        nome: 'Correios - SEDEX',
        tipo: 'CORREIOS_SEDEX',
        valor: Math.round(sedexFinal * 100) / 100,
        prazo: prazoSedex,
        descricao: `Expresso prioritário • Tarifado p/ ${pesoTarifado.toFixed(2)} kg${ehVolumoso ? ' (+ taxa volumoso)' : ''}`
      },
      {
        id: 'transp',
        nome: 'Transportadora Parceira',
        tipo: 'TRANSPORTADORA',
        valor: Math.round(transpFinal * 100) / 100,
        prazo: prazoTransp,
        descricao: `Rodoviário regional • Tarifado p/ ${pesoTarifado.toFixed(2)} kg`
      }
    ];

    setOpcoesFrete(listaOpcoes);

    if (atualizarFreteSelecionado) {
      const opcaoSelecionada = listaOpcoes.find(o => o.tipo === pedidoTipoEnvio);
      if (opcaoSelecionada) {
        setPedidoValorFrete(opcaoSelecionada.valor.toFixed(2));
        setPedidoPrazoEnvio(opcaoSelecionada.prazo);
      }
    }

    return { listaOpcoes, pesoTarifado };
  };

  const calcularFretePorCep = async (
    cepInput: string,
    cCm = comprimentoCm,
    lCm = larguraCm,
    aCm = alturaCm,
    pKg = pesoKg
  ) => {
    const digits = onlyNumbers(cepInput);
    if (digits.length !== 8) {
      toast('Informe um CEP válido com 8 dígitos para calcular.', 'error');
      return;
    }
    setCalculandoFrete(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!res.ok) throw new Error('Falha ao consultar CEP');
      const data = await res.json();
      if (data.erro) {
        toast('CEP não localizado nos Correios.', 'error');
        setCepDestinoInfo('');
        setDestinoUf('');
        setOpcoesFrete([]);
        return;
      }

      const infoEndereco = [
        data.logradouro,
        data.bairro,
        `${data.localidade} - ${data.uf}`
      ].filter(Boolean).join(', ');

      setCepDestinoInfo(infoEndereco);
      const uf = (data.uf || '').toUpperCase();
      setDestinoUf(uf);

      const { pesoTarifado } = gerarOpcoesFrete(uf, cCm, lCm, aCm, pKg, false);
      toast(`Frete calculado para ${data.localidade}/${data.uf} (${pesoTarifado.toFixed(2)} kg tarifado)!`, 'success');
    } catch (err: any) {
      toast('Erro ao buscar CEP. Verifique a conexão com a internet.', 'error');
    } finally {
      setCalculandoFrete(false);
    }
  };

  const aplicarPresetPacote = (presetId: 'P' | 'M' | 'G' | 'ENVELOPE' | 'CUSTOM') => {
    setPacotePreset(presetId);
    const p = PACOTE_PRESETS.find(item => item.id === presetId);
    if (p && presetId !== 'CUSTOM') {
      setComprimentoCm(p.comprimento);
      setLarguraCm(p.largura);
      setAlturaCm(p.altura);
      setPesoKg(p.peso);
      if (destinoUf) {
        gerarOpcoesFrete(destinoUf, p.comprimento, p.largura, p.altura, p.peso);
      } else {
        const digits = onlyNumbers(pedidoCepDestino);
        if (digits.length === 8) {
          calcularFretePorCep(digits, p.comprimento, p.largura, p.altura, p.peso);
        }
      }
    }
  };

  const handleDimensaoChange = (
    campo: 'comprimento' | 'largura' | 'altura' | 'peso',
    valor: number
  ) => {
    setPacotePreset('CUSTOM');
    let c = comprimentoCm;
    let l = larguraCm;
    let a = alturaCm;
    let p = pesoKg;
    if (campo === 'comprimento') { setComprimentoCm(valor); c = valor; }
    if (campo === 'largura') { setLarguraCm(valor); l = valor; }
    if (campo === 'altura') { setAlturaCm(valor); a = valor; }
    if (campo === 'peso') { setPesoKg(valor); p = valor; }

    if (destinoUf) {
      gerarOpcoesFrete(destinoUf, c, l, a, p);
    } else {
      const digits = onlyNumbers(pedidoCepDestino);
      if (digits.length === 8) {
        calcularFretePorCep(digits, c, l, a, p);
      }
    }
  };

  const handleCepDestinoChange = (val: string) => {
    const formatado = maskCep(val);
    setPedidoCepDestino(formatado);
    const digits = onlyNumbers(formatado);
    if (digits.length === 8) {
      calcularFretePorCep(digits, comprimentoCm, larguraCm, alturaCm, pesoKg);
    }
  };

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
      let res = await fetch('/api/pedidos-operacionais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novoPedido),
      });
      if (!res.ok && res.status === 404) {
        res = await fetch('/pedidos-operacionais', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(novoPedido),
        });
      }
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.erro || err?.error || `Erro ao salvar pedido (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast('Pedido registrado com sucesso!');
      fecharModalPedido();
    },
    onError: (err: any) => {
      toast(err.message || 'Erro ao salvar pedido', 'error');
    }
  });

  const atualizarPedidoMutation = useMutation({
    mutationFn: async ({ id, pedido }: { id: number; pedido: Pedido }) => {
      let res = await fetch(`/api/pedidos-operacionais/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pedido),
      });
      if (!res.ok && res.status === 404) {
        res = await fetch(`/pedidos-operacionais/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pedido),
        });
      }
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.erro || err?.error || `Erro ao atualizar pedido (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast('Pedido atualizado com sucesso!');
      fecharModalPedido();
    },
    onError: (err: any) => {
      toast(err.message || 'Erro ao atualizar pedido', 'error');
    }
  });

  const deletarPedidoMutation = useMutation({
    mutationFn: async (id: number) => {
      let res = await fetch(`/api/pedidos-operacionais/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status === 404) {
        res = await fetch(`/pedidos-operacionais/${id}`, { method: 'DELETE' });
      }
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.erro || err?.error || `Erro ao excluir pedido (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast('Pedido excluído com sucesso!');
    },
    onError: (err: any) => {
      toast(err.message || 'Erro ao excluir pedido', 'error');
    }
  });

  const toggleEntregueMutation = useMutation({
    mutationFn: async ({ id, entregue }: { id: number; entregue: boolean }) => {
      let res = await fetch(`/api/pedidos-operacionais/${id}/entregue`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entregue }),
      });
      if (!res.ok && res.status === 404) {
        res = await fetch(`/pedidos-operacionais/${id}/entregue`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entregue }),
        });
      }
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.erro || err?.error || `Erro ao atualizar status (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: any) => {
      toast(err.message || 'Erro ao atualizar status', 'error');
    }
  });

  const togglePagamentoMutation = useMutation({
    mutationFn: async ({ id, dataPagamento }: { id: number; dataPagamento: string | null }) => {
      let res = await fetch(`/api/pedidos-operacionais/${id}/pagamento`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataPagamento }),
      });
      if (!res.ok && res.status === 404) {
        res = await fetch(`/pedidos-operacionais/${id}/pagamento`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataPagamento }),
        });
      }
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.erro || err?.error || `Erro ao atualizar pagamento (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast('Status de pagamento atualizado com sucesso!');
    },
    onError: (err: any) => {
      toast(err.message || 'Erro ao atualizar pagamento', 'error');
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

    let custoUnitario = 0;
    let variacaoId: number | undefined = undefined;
    let kitId: number | undefined = undefined;

    if (tipoItem === 'PRODUTO') {
      const p = produtosDisponiveis.find(
        (prod) => prod.id === Number(selectedProdutoId) ||
          `${prod.produtoNome} (${prod.nomeTamanho})`.toLowerCase() === nome.toLowerCase()
      );
      if (p) {
        custoUnitario = Number(p.custoUnitarioCalculado) || 0;
        variacaoId = p.id;
      }
    } else if (tipoItem === 'KIT') {
      const kitNomePuro = nome.replace(/^Kit:\s*/i, '').trim().toLowerCase();
      const k = kitsDisponiveis.find(
        (kit) => kit.id === Number(selectedKitId) ||
          kit.nome.toLowerCase() === kitNomePuro ||
          kit.nome.toLowerCase() === nome.toLowerCase()
      );
      if (k) {
        custoUnitario = Number(k.custoTotalCalculado) || 0;
        kitId = k.id;
      }
    }

    const novoItem: ProdutoItem = {
      nome: itemDesconto > 0 ? `${nome} (desc. ${itemDesconto}%)` : nome,
      qtd,
      preco,
      tipo: tipoItem,
      precoOriginal: itemPrecoBase > 0 ? itemPrecoBase : preco,
      desconto: tipoItem === 'KIT' ? 0 : itemDesconto,
      custoUnitario,
      variacaoId,
      kitId,
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
        const custoUnit = Number(data.custoUnitarioCalculado) || 0;
        setItensDoPedidoAtual((prev) => {
          const idx = prev.findIndex((it) => it.nome.toLowerCase() === itemNomeCompleto.toLowerCase());
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], qtd: copy[idx].qtd + 1, custoUnitario: custoUnit, variacaoId: data.id };
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
                desconto: 0,
                custoUnitario: custoUnit,
                variacaoId: data.id,
              }
            ];
          }
        });
        toast(`"${itemNomeCompleto}" bipado com sucesso!`, 'success');
        setBarcodeInput('');
      } else if (data.tipo === 'KIT') {
        const itemNomeCompleto = `Kit: ${data.nome}`;
        const preco = Number(data.precoVenda) || 0;
        const custoUnit = Number(data.custoTotalCalculado) || 0;
        setItensDoPedidoAtual((prev) => {
          const idx = prev.findIndex((it) => it.nome.toLowerCase() === itemNomeCompleto.toLowerCase());
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], qtd: copy[idx].qtd + 1, custoUnitario: custoUnit, kitId: data.id };
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
                desconto: 0,
                custoUnitario: custoUnit,
                kitId: data.id,
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
      const custoUnit = item.custoUnitario && item.custoUnitario > 0
        ? item.custoUnitario
        : obterCustoUnitarioItem(item, produtosDisponiveis, kitsDisponiveis);
      totalCusto += custoUnit * item.qtd;
    });

    const subtotalProdutos = itensDoPedidoAtual.reduce((acc, i) => acc + i.qtd * i.preco, 0);
    const valorFreteNum = parseFloat(pedidoValorFrete) || 0;
    const totalPedido = subtotalProdutos + valorFreteNum;
    const totalVenda = totalPedido;
    // Lucro Bruto Realizado = Preço de Venda dos Produtos - Custo dos Produtos (o frete repassa o serviço de entrega)
    const lucroBruto = subtotalProdutos - totalCusto;
    const margemPercentual = subtotalProdutos > 0 ? (lucroBruto / subtotalProdutos) * 100 : 0;

    return { totalCusto, subtotalProdutos, valorFreteNum, totalPedido, totalVenda, lucroBruto, margemPercentual };
  };

  const imprimirPedido = (pedido: Pedido) => {
    const cliente = clientes.find(c => c.id === pedido.clienteId);
    const itens = pedido.itens || pedido.produtos || [];
    const frete = pedido.valorFrete || 0;
    const subtotalProdutos = itens.reduce((acc, i) => acc + i.qtd * i.preco, 0);
    const totalVenda = pedido.valor ?? (subtotalProdutos + frete);
    const totalCusto = (pedido.valorCustoTotal !== undefined && pedido.valorCustoTotal !== null && pedido.valorCustoTotal > 0)
      ? pedido.valorCustoTotal
      : itens.reduce((acc, i) => acc + i.qtd * obterCustoUnitarioItem(i, produtosDisponiveis, kitsDisponiveis), 0);
    const lucro = pedido.lucroBruto !== undefined && pedido.lucroBruto !== null
      ? pedido.lucroBruto
      : (subtotalProdutos - totalCusto);
    const margem = subtotalProdutos > 0 ? ((lucro / subtotalProdutos) * 100).toFixed(1) : '0.0';
    const dataFormatada = pedido.dataPagamento
      ? pedido.dataPagamento.split('-').reverse().join('/')
      : new Date().toLocaleDateString('pt-BR');

    const printWindow = window.open('', '_blank', 'width=850,height=950');
    if (!printWindow) {
      toast('Não foi possível abrir a janela de impressão. Permita popups no navegador.', 'error');
      return;
    }

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Comprovante de Pedido #${pedido.id ?? ''} - ${pedido.clienteNome}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 24px;
      color: #0f172a;
      background: #fff;
      font-size: 13px;
      line-height: 1.5;
    }
    .header {
      border-bottom: 2px solid #0284c7;
      padding-bottom: 12px;
      margin-bottom: 18px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .brand { font-size: 22px; font-weight: 800; color: #0284c7; letter-spacing: -0.5px; }
    .subtitle { font-size: 12px; color: #64748b; margin-top: 2px; }
    .order-badge {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      text-align: right;
    }
    .meta-box {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 16px;
      margin-bottom: 20px;
    }
    .meta-group { margin-bottom: 6px; }
    .meta-label { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; }
    .meta-value { font-size: 13px; font-weight: 600; color: #1e293b; margin-top: 1px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th {
      background: #f1f5f9;
      text-align: left;
      padding: 9px 12px;
      font-size: 11px;
      text-transform: uppercase;
      color: #475569;
      border-bottom: 2px solid #cbd5e1;
      font-weight: 700;
    }
    td {
      padding: 9px 12px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 12px;
      vertical-align: middle;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    
    .financial-summary {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 24px;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      align-items: center;
    }
    .kpi-title { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #166534; }
    .kpi-val { font-size: 18px; font-weight: 800; margin-top: 2px; }
    .kpi-formula { font-size: 10px; color: #166534; margin-top: 2px; font-weight: 600; }
    
    .signatures {
      margin-top: 45px;
      padding-top: 20px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
    }
    .sig-line {
      border-top: 1px solid #475569;
      text-align: center;
      padding-top: 8px;
      font-size: 11px;
      color: #475569;
    }
    
    .status-pill {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
    }
    .status-entregue { background: #dcfce7; color: #166534; }
    .status-pendente { background: #fef9c3; color: #854d0e; }

    @media print {
      body { margin: 10mm; font-size: 12px; }
      .no-print { display: none !important; }
      @page { margin: 10mm; size: auto; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">PRECIFIQ</div>
      <div class="subtitle">Comprovante de Pedido & Ordem de Entrega</div>
    </div>
    <div>
      <div class="order-badge">PEDIDO #${pedido.id ?? 'NOVO'}</div>
      <div style="font-size: 12px; color: #64748b; text-align: right;">Data: ${dataFormatada}</div>
    </div>
  </div>

  <div class="meta-box">
    <div>
      <div class="meta-group">
        <div class="meta-label">Cliente</div>
        <div class="meta-value">${pedido.clienteNome}</div>
      </div>
      <div class="meta-group">
        <div class="meta-label">Telefone / WhatsApp</div>
        <div class="meta-value">${cliente?.telefone ? maskPhone(cliente.telefone) : 'Não informado'}</div>
      </div>
      <div class="meta-group">
        <div class="meta-label">Endereço de Entrega</div>
        <div class="meta-value">${cliente?.endereco || 'Retirada no local / Não informado'}</div>
      </div>
    </div>

    <div>
      <div class="meta-group">
        <div class="meta-label">Modalidade de Envio</div>
        <div class="meta-value">${pedido.tipoEnvio || 'Retirada no Local'}${pedido.prazoEnvio ? ` • Prazo: ${pedido.prazoEnvio}` : ''}</div>
      </div>
      <div class="meta-group">
        <div class="meta-label">CEP Destino / Frete</div>
        <div class="meta-value">${pedido.cepDestino ? maskCep(pedido.cepDestino) + ' • ' : ''}<strong>${frete > 0 ? `R$ ${frete.toFixed(2)}` : 'Grátis / Retirada'}</strong></div>
      </div>
      <div class="meta-group">
        <div class="meta-label">Pacote / Dimensões & Peso</div>
        <div class="meta-value">${pedido.comprimentoCm || 24}×${pedido.larguraCm || 18}×${pedido.alturaCm || 12} cm • Real: ${(pedido.pesoKg || 0.8).toFixed(2)} kg (Cubado: ${(((pedido.comprimentoCm || 24) * (pedido.larguraCm || 18) * (pedido.alturaCm || 12)) / 6000).toFixed(2)} kg)</div>
      </div>
      <div class="meta-group">
        <div class="meta-label">Forma de Pagamento</div>
        <div class="meta-value">${pedido.formaPagamento} (${dataFormatada})</div>
      </div>
      <div class="meta-group">
        <div class="meta-label">Status da Entrega</div>
        <div class="meta-value">
          <span class="status-pill ${pedido.entregue ? 'status-entregue' : 'status-pendente'}">
            ${pedido.entregue ? '✔ ENTREGUE' : '⏳ PENDENTE DE ENTREGA'}
          </span>
        </div>
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Produto / Item</th>
        <th class="text-center">Tipo</th>
        <th class="text-right">Qtd</th>
        <th class="text-right">Preço Unitário</th>
        <th class="text-right">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${itens.map(it => `
        <tr>
          <td><strong>${it.nome}</strong></td>
          <td class="text-center">${it.tipo || 'PRODUTO'}</td>
          <td class="text-right font-mono">${it.qtd}</td>
          <td class="text-right font-mono">R$ ${it.preco.toFixed(2)}</td>
          <td class="text-right font-mono"><strong>R$ ${(it.qtd * it.preco).toFixed(2)}</strong></td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="financial-summary">
    <div>
      <div class="kpi-title">Subtotal Produtos</div>
      <div class="kpi-val" style="color: #1e293b;">R$ ${subtotalProdutos.toFixed(2)}</div>
    </div>
    <div>
      <div class="kpi-title">Frete / Envio</div>
      <div class="kpi-val" style="color: #0284c7;">R$ ${frete.toFixed(2)}</div>
      <div class="kpi-formula">${pedido.tipoEnvio || 'Envio'}</div>
    </div>
    <div>
      <div class="kpi-title">Valor Total da Venda</div>
      <div class="kpi-val" style="color: #0284c7;">R$ ${totalVenda.toFixed(2)}</div>
      <div class="kpi-formula">Itens + Frete</div>
    </div>
    <div>
      <div class="kpi-title">Lucro Bruto Realizado</div>
      <div class="kpi-val" style="color: ${lucro >= 0 ? '#15803d' : '#dc2626'};">
        R$ ${lucro.toFixed(2)}
      </div>
      <div class="kpi-formula">Venda - Custo (${margem}%)</div>
    </div>
  </div>

  <div class="signatures">
    <div class="sig-line">
      Assinatura do Vendedor / Expedição
    </div>
    <div class="sig-line">
      Recebido por (Cliente / Destinatário)<br>
      Data: ____/____/________
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(() => {
        window.print();
      }, 300);
    };
  </script>
</body>
</html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const abrirModalCliente = (cliente?: Cliente) => {
    if (cliente) {
      setEditingClienteId(cliente.id);
      setClienteNome(cliente.nome);
      setClienteTelefone(maskPhone(cliente.telefone || ''));
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
      telefone: onlyNumbers(clienteTelefone) || undefined,
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
      const itensOriginais = pedido.itens || pedido.produtos || [];
      const itensComCusto = itensOriginais.map(it => ({
        ...it,
        custoUnitario: it.custoUnitario && it.custoUnitario > 0
          ? it.custoUnitario
          : obterCustoUnitarioItem(it, produtosDisponiveis, kitsDisponiveis)
      }));
      setItensDoPedidoAtual(itensComCusto);
      setPedidoPagamento(pedido.formaPagamento || 'Pix');
      setPedidoData(pedido.dataPagamento || new Date().toISOString().split('T')[0]);
      setPedidoEntregue(pedido.entregue || false);
      setPedidoTipoEnvio(pedido.tipoEnvio || 'RETIRADA');
      setPedidoValorFrete(pedido.valorFrete !== undefined ? String(pedido.valorFrete) : '0');
      setPedidoCepDestino(pedido.cepDestino ? maskCep(pedido.cepDestino) : '');
      setPedidoPrazoEnvio(pedido.prazoEnvio || 'Imediato');
      setComprimentoCm(pedido.comprimentoCm !== undefined && pedido.comprimentoCm !== null ? pedido.comprimentoCm : 24);
      setLarguraCm(pedido.larguraCm !== undefined && pedido.larguraCm !== null ? pedido.larguraCm : 18);
      setAlturaCm(pedido.alturaCm !== undefined && pedido.alturaCm !== null ? pedido.alturaCm : 12);
      setPesoKg(pedido.pesoKg !== undefined && pedido.pesoKg !== null ? pedido.pesoKg : 0.8);
      setPacotePreset('CUSTOM');
      setCepDestinoInfo('');
      setOpcoesFrete([]);
    } else {
      setEditingPedidoId(null);
      setItensDoPedidoAtual([]);
      setPedidoClienteId('');
      setBuscaCliente('');
      setPedidoPagamento('Pix');
      setPedidoData(new Date().toISOString().split('T')[0]);
      setPedidoEntregue(false);
      setPedidoTipoEnvio('RETIRADA');
      setPedidoValorFrete('0');
      setPedidoCepDestino('');
      setPedidoPrazoEnvio('Imediato');
      setComprimentoCm(24);
      setLarguraCm(18);
      setAlturaCm(12);
      setPesoKg(0.8);
      setPacotePreset('M');
      setCepDestinoInfo('');
      setOpcoesFrete([]);
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
    setPedidoTipoEnvio('RETIRADA');
    setPedidoValorFrete('0');
    setPedidoCepDestino('');
    setPedidoPrazoEnvio('Imediato');
    setComprimentoCm(24);
    setLarguraCm(18);
    setAlturaCm(12);
    setPesoKg(0.8);
    setPacotePreset('M');
    setCepDestinoInfo('');
    setOpcoesFrete([]);
  };

  const abrirModalRelatorio = () => {
    setRelatorioClienteId('');
    setModalRelatorioOpen(true);
  };

  const fecharModalRelatorio = () => {
    setModalRelatorioOpen(false);
    setRelatorioClienteId('');
  };

  const abrirVisualizarPedido = (pedido: Pedido) => {
    setPedidoVisualizando(pedido);
    setModalVisualizarOpen(true);
  };

  const fecharVisualizarPedido = () => {
    setModalVisualizarOpen(false);
    setPedidoVisualizando(null);
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

    const subtotalProdutos = itensDoPedidoAtual.reduce((acc, i) => acc + (i.qtd * i.preco), 0);
    const valorFreteNum = parseFloat(pedidoValorFrete) || 0;
    const totalPedido = subtotalProdutos + valorFreteNum;

    const totalCusto = itensDoPedidoAtual.reduce((acc, i) => {
      const custoUn = i.custoUnitario && i.custoUnitario > 0
        ? i.custoUnitario
        : obterCustoUnitarioItem(i, produtosDisponiveis, kitsDisponiveis);
      return acc + (i.qtd * custoUn);
    }, 0);
    // Lucro Bruto Realizado = Preço de Venda dos Produtos - Custo dos Produtos (CMV)
    const lucroBruto = subtotalProdutos - totalCusto;

    const itensNormalizados = itensDoPedidoAtual.map(i => ({
      ...i,
      custoUnitario: i.custoUnitario && i.custoUnitario > 0
        ? i.custoUnitario
        : obterCustoUnitarioItem(i, produtosDisponiveis, kitsDisponiveis)
    }));

    const pedidoPayload: Pedido = {
      clienteId: finalClienteId as number,
      clienteNome: finalClienteNome,
      itens: itensNormalizados,
      produtos: itensNormalizados,
      valor: totalPedido,
      valorCustoTotal: totalCusto,
      lucroBruto: lucroBruto,
      valorFrete: valorFreteNum,
      tipoEnvio: pedidoTipoEnvio,
      cepDestino: pedidoCepDestino ? onlyNumbers(pedidoCepDestino) : undefined,
      prazoEnvio: pedidoPrazoEnvio || undefined,
      comprimentoCm: Number(comprimentoCm) || 24,
      larguraCm: Number(larguraCm) || 18,
      alturaCm: Number(alturaCm) || 12,
      pesoKg: Number(pesoKg) || 0.8,
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
            <div className="kpi-trend text-muted">Faturamento bruto confirmado</div>
          </div>
        </div>
        <div className="kpi-card purple">
          <div className="kpi-icon purple"><TrendingUp size={20} /></div>
          <div className="kpi-content">
            <div className="kpi-label">Lucro Bruto Realizado</div>
            <div className="kpi-value purple" title="Preço de Venda Total - Preço de Custo Total">
              R$ {pedidos.reduce((acc, p) => {
                const venda = p.valor ?? 0;
                const custo = (p.valorCustoTotal !== undefined && p.valorCustoTotal !== null && p.valorCustoTotal > 0)
                  ? p.valorCustoTotal
                  : (p.itens || p.produtos || []).reduce((sum, it) => sum + it.qtd * obterCustoUnitarioItem(it, produtosDisponiveis, kitsDisponiveis), 0);
                const lucro = p.lucroBruto !== undefined && p.lucroBruto !== null ? p.lucroBruto : (venda - custo);
                return acc + lucro;
              }, 0).toFixed(2)}
            </div>
            <div className="kpi-trend text-muted">Preço Venda - Preço Custo</div>
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
                  <th className="table-cell text-right" style={{ whiteSpace: 'nowrap' }}>Valor Total</th>
                  <th className="table-cell" style={{ whiteSpace: 'nowrap' }}>Forma de Pagamento</th>
                  <th className="table-cell" style={{ whiteSpace: 'nowrap' }}>Data de Pagamento</th>
                  <th className="table-cell" style={{ whiteSpace: 'nowrap' }}>Status Entrega</th>
                  <th className="table-cell text-center" style={{ whiteSpace: 'nowrap' }}>Ações</th>
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

                      const freteLinha = p.valorFrete || 0;
                      const totalVendaLinha = p.valor ?? 0;
                      const totalCustoLinha = (p.valorCustoTotal !== undefined && p.valorCustoTotal !== null && p.valorCustoTotal > 0)
                        ? p.valorCustoTotal
                        : (p.itens || p.produtos || []).reduce((acc, it) => acc + it.qtd * obterCustoUnitarioItem(it, produtosDisponiveis, kitsDisponiveis), 0);
                      const lucroLinha = p.lucroBruto !== undefined && p.lucroBruto !== null
                        ? p.lucroBruto
                        : (totalVendaLinha - freteLinha - totalCustoLinha);

                      return (
                        <tr key={index}>
                          <td className="table-cell font-medium">{p.clienteNome}</td>
                          <td className="table-cell" style={{ maxWidth: '300px' }} title={stringProdutos}>
                            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {stringProdutos || '—'}
                            </div>
                            {freteLinha > 0 ? (
                              <div style={{ fontSize: '11px', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                                <Truck size={12} />
                                <span>Frete: <strong>R$ {freteLinha.toFixed(2)}</strong> ({p.tipoEnvio || 'Envio'})</span>
                                {p.prazoEnvio && <span style={{ color: '#64748b' }}>• {p.prazoEnvio}</span>}
                              </div>
                            ) : (
                              <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                                <span>🏪 Retirada no Local</span>
                              </div>
                            )}
                          </td>
                          <td className="table-cell text-right font-medium td-mono" style={{ whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 700, color: 'var(--primary)' }}>R$ {totalVendaLinha.toFixed(2)}</div>
                            {freteLinha > 0 && (
                              <div style={{ fontSize: '10px', color: '#0284c7' }} title="Subtotal Produtos + Frete">
                                Itens: R$ {(totalVendaLinha - freteLinha).toFixed(2)} + Frete: R$ {freteLinha.toFixed(2)}
                              </div>
                            )}
                            <div style={{ fontSize: '11px', color: '#64748b' }} title="Preço de Custo Total">
                              Custo: R$ {totalCustoLinha.toFixed(2)}
                            </div>
                            <div
                              style={{
                                fontSize: '11px',
                                color: lucroLinha >= 0 ? '#059669' : '#dc2626',
                                fontWeight: 700
                              }}
                              title="Lucro Bruto Realizado = Preço de Venda dos Produtos - Preço de Custo"
                            >
                              Lucro: R$ {lucroLinha.toFixed(2)}
                            </div>
                          </td>
                          <td className="table-cell" style={{ whiteSpace: 'nowrap' }}><span className="badge badge-gray">{p.formaPagamento}</span></td>
                          <td className="table-cell" style={{ whiteSpace: 'nowrap' }}>
                            {(() => {
                              const isPago = Boolean(p.dataPagamento && p.dataPagamento.trim() !== '');
                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (p.id) {
                                      togglePagamentoMutation.mutate({
                                        id: p.id,
                                        dataPagamento: isPago ? null : new Date().toISOString().split('T')[0]
                                      });
                                    }
                                  }}
                                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                                  title={isPago ? 'Clique para marcar pagamento como PENDENTE' : 'Clique para CONFIRMAR pagamento com data de hoje'}
                                >
                                  <span className={`badge ${isPago ? 'badge-green' : 'badge-yellow'}`}>
                                    {isPago ? `✔ Pago (${dataFormatada})` : '⏳ Pendente'}
                                  </span>
                                </button>
                              );
                            })()}
                          </td>
                          <td className="table-cell" style={{ whiteSpace: 'nowrap' }}>{statusBadge}</td>
                          <td className="table-cell text-center" style={{ whiteSpace: 'nowrap', minWidth: '180px' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center', flexWrap: 'nowrap' }}>
                              <button
                                className={`btn btn-sm ${p.entregue ? 'btn-secondary' : 'btn-primary'}`}
                                style={{ whiteSpace: 'nowrap', minWidth: '76px', padding: '4px 8px' }}
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
                                onClick={() => abrirVisualizarPedido(p)}
                                className="btn btn-action btn-icon"
                                title="Visualizar Pedido e Lucro Realizado"
                                style={{ color: '#0284c7' }}
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                onClick={() => imprimirPedido(p)}
                                className="btn btn-action btn-icon"
                                title="Imprimir Comprovante do Pedido"
                                style={{ color: '#475569' }}
                              >
                                <Printer size={16} />
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
        <div className="modal-overlay active" style={{ zIndex: 1100 }} onClick={(e) => {
          if (e.target === e.currentTarget) fecharModalCliente();
        }}>
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingClienteId ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}</h3>
              <button className="modal-close" onClick={fecharModalCliente}>&times;</button>
            </div>
            <form id="form-cliente" onSubmit={salvarCliente}>
              <div className="modal-body">
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
                    onChange={(e) => setClienteTelefone((e.target.value = maskPhone(e.target.value)))}
                    maxLength={15}
                    inputMode="numeric"
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

            <form id="form-pedido" noValidate onSubmit={salvarPedido}>
              <div className="modal-body">
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
                              if (cliente.endereco) {
                                const matchCep = cliente.endereco.match(/\b\d{5}-?\d{3}\b/);
                                if (matchCep) {
                                  const cepLimpo = matchCep[0];
                                  setPedidoCepDestino(maskCep(cepLimpo));
                                  calcularFretePorCep(cepLimpo);
                                }
                              }
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

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'end' }}>
                  <div className="form-group" style={{ flex: '0 0 80px', marginBottom: 0 }}>
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

                  <div className="form-group" style={{ flex: '1', minWidth: '100px', marginBottom: 0 }}>
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

                  <div className="form-group" style={{ flex: '1', minWidth: '100px', marginBottom: 0 }}>
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

                  <div className="form-group" style={{ flex: '1', minWidth: '100px', marginBottom: 0 }}>
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

                  <div style={{ flex: '0 0 auto', marginBottom: 0 }}>
                    <button
                      type="button"
                    className="btn btn-primary btn-sm"
                    style={{ height: '38px', whiteSpace: 'nowrap' }}
                    onClick={adicionarItemNaLista}
                  >
                    <Plus size={16} /> Adicionar
                    </button>
                  </div>
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

              {/* Seção de Cálculo e Opções de Envio / Frete */}
              <div
                style={{
                  background: 'var(--surface-2, #f8fafc)',
                  border: '1px solid var(--border, #e2e8f0)',
                  borderRadius: 'var(--radius, 8px)',
                  padding: '16px',
                  marginTop: '16px',
                  marginBottom: '16px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Truck size={20} style={{ color: 'var(--primary, #0284c7)' }} />
                    <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text, #0f172a)' }}>
                      Cálculo & Opções de Envio
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--muted, #64748b)', fontWeight: 600 }}>
                    {pedidoTipoEnvio === 'RETIRADA' && '🏪 Retirada no Local'}
                    {pedidoTipoEnvio === 'MOTOBOY' && '🛵 Entrega Local / Motoboy'}
                    {pedidoTipoEnvio === 'CORREIOS_PAC' && '📦 Correios PAC'}
                    {pedidoTipoEnvio === 'CORREIOS_SEDEX' && '⚡ Correios SEDEX'}
                    {pedidoTipoEnvio === 'TRANSPORTADORA' && '🚚 Transportadora'}
                    {pedidoTipoEnvio === 'PERSONALIZADO' && '✏️ Frete Personalizado'}
                  </span>
                </div>

                {/* Modos de Envio */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${pedidoTipoEnvio === 'RETIRADA' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                    onClick={() => {
                      setPedidoTipoEnvio('RETIRADA');
                      setPedidoValorFrete('0');
                      setPedidoPrazoEnvio('Imediato / Balcão');
                    }}
                  >
                    🏪 Retirada (R$ 0,00)
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${pedidoTipoEnvio === 'MOTOBOY' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                    onClick={() => {
                      setPedidoTipoEnvio('MOTOBOY');
                      if (!pedidoValorFrete || pedidoValorFrete === '0') setPedidoValorFrete('15.00');
                      setPedidoPrazoEnvio('No mesmo dia / 24h');
                    }}
                  >
                    🛵 Motoboy / Local
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${['CORREIOS_PAC', 'CORREIOS_SEDEX', 'TRANSPORTADORA'].includes(pedidoTipoEnvio) ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                    onClick={() => {
                      if (!['CORREIOS_PAC', 'CORREIOS_SEDEX', 'TRANSPORTADORA'].includes(pedidoTipoEnvio)) {
                        setPedidoTipoEnvio('CORREIOS_PAC');
                      }
                      if (pedidoCepDestino && onlyNumbers(pedidoCepDestino).length === 8 && opcoesFrete.length === 0) {
                        calcularFretePorCep(pedidoCepDestino);
                      }
                    }}
                  >
                    📦 Correios / Transportadora (com CEP)
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${pedidoTipoEnvio === 'PERSONALIZADO' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                    onClick={() => {
                      setPedidoTipoEnvio('PERSONALIZADO');
                    }}
                  >
                    ✏️ Personalizado
                  </button>
                </div>

                {/* Detalhes para MOTOBOY */}
                {pedidoTipoEnvio === 'MOTOBOY' && (
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', marginBottom: '12px' }}>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                      Taxas pré-definidas de entrega local expressa:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {[10, 15, 20, 25, 30].map(val => (
                        <button
                          key={val}
                          type="button"
                          className={`btn btn-sm ${Number(pedidoValorFrete) === val ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ fontSize: '12px', padding: '4px 10px' }}
                          onClick={() => setPedidoValorFrete(val.toFixed(2))}
                        >
                          R$ {val.toFixed(2)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Detalhes para CORREIOS / TRANSPORTADORA (com cálculo por CEP) */}
                {['CORREIOS_PAC', 'CORREIOS_SEDEX', 'TRANSPORTADORA'].includes(pedidoTipoEnvio) && (
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '14px', marginBottom: '12px' }}>
                    {/* Dimensões do Pacote & Cubagem */}
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Package size={16} style={{ color: 'var(--primary, #0284c7)' }} />
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                            Dimensões do Pacote & Cubagem
                          </span>
                        </div>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          Fator de cubagem padrão: <strong>divisão por 6.000</strong>
                        </span>
                      </div>

                      {/* Presets Rápidos de Embalagem */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                        {PACOTE_PRESETS.map((preset) => {
                          const isSelected = pacotePreset === preset.id;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              className={`btn btn-xs ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                              style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px' }}
                              title={preset.descricao}
                              onClick={() => aplicarPresetPacote(preset.id)}
                            >
                              {preset.nome}
                            </button>
                          );
                        })}
                      </div>

                      {/* 4 Inputs: Comprimento, Largura, Altura, Peso */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px', marginBottom: '10px' }}>
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '2px', textTransform: 'uppercase' }}>
                            Comprimento (cm)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={comprimentoCm || ''}
                            onChange={(e) => handleDimensaoChange('comprimento', parseFloat(e.target.value) || 0)}
                            style={{ width: '100%', height: '32px', fontSize: '12px', background: '#fff' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '2px', textTransform: 'uppercase' }}>
                            Largura (cm)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={larguraCm || ''}
                            onChange={(e) => handleDimensaoChange('largura', parseFloat(e.target.value) || 0)}
                            style={{ width: '100%', height: '32px', fontSize: '12px', background: '#fff' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '2px', textTransform: 'uppercase' }}>
                            Altura (cm)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={alturaCm || ''}
                            onChange={(e) => handleDimensaoChange('altura', parseFloat(e.target.value) || 0)}
                            style={{ width: '100%', height: '32px', fontSize: '12px', background: '#fff' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '2px', textTransform: 'uppercase' }}>
                            Peso Real (kg)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={pesoKg || ''}
                            onChange={(e) => handleDimensaoChange('peso', parseFloat(e.target.value) || 0)}
                            style={{ width: '100%', height: '32px', fontSize: '12px', background: '#fff', fontWeight: 700 }}
                          />
                        </div>
                      </div>

                      {/* Resumo de Cubagem e Tarifação */}
                      {(() => {
                        const vCm3 = (comprimentoCm || 0) * (larguraCm || 0) * (alturaCm || 0);
                        const cubado = vCm3 / 6000;
                        const tarifado = Math.max(pesoKg || 0, cubado);
                        const isBulky = (comprimentoCm > 70) || (larguraCm > 70) || (alturaCm > 70) || ((comprimentoCm + larguraCm + alturaCm) > 200);

                        return (
                          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '8px 10px', fontSize: '11px', color: '#475569', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <div>
                              <span>Vol: <strong>{vCm3.toLocaleString('pt-BR')} cm³</strong></span>
                              <span style={{ margin: '0 6px' }}>•</span>
                              <span>Peso Real: <strong>{(pesoKg || 0).toFixed(2)} kg</strong></span>
                              <span style={{ margin: '0 6px' }}>•</span>
                              <span>Cubagem: <strong>{cubado.toFixed(2)} kg</strong></span>
                            </div>
                            <div>
                              <span style={{ background: cubado > (pesoKg || 0) ? '#fef3c7' : '#e0f2fe', color: cubado > (pesoKg || 0) ? '#92400e' : '#0369a1', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                                ⚖️ Peso Tarifado: {tarifado.toFixed(2)} kg
                              </span>
                            </div>
                            {isBulky && (
                              <div style={{ width: '100%', color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', padding: '4px 8px', borderRadius: '4px', marginTop: '4px', fontSize: '11px' }}>
                                ⚠️ <strong>Pacote volumoso:</strong> Medida superior a 70 cm ou soma {'>'} 200 cm (sujeito a taxa de manuseio especial).
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'end', marginBottom: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                          CEP de Destino do Cliente
                        </label>
                        <input
                          type="text"
                          placeholder="00000-000"
                          value={pedidoCepDestino}
                          onChange={(e) => handleCepDestinoChange(e.target.value)}
                          maxLength={9}
                          inputMode="numeric"
                          style={{ width: '100%', height: '36px', fontSize: '13px' }}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ height: '36px', whiteSpace: 'nowrap' }}
                        onClick={() => calcularFretePorCep(pedidoCepDestino)}
                        disabled={calculandoFrete || onlyNumbers(pedidoCepDestino).length !== 8}
                      >
                        {calculandoFrete ? 'Calculando...' : 'Calcular Frete'}
                      </button>
                    </div>

                    {cepDestinoInfo && (
                      <div style={{ fontSize: '12px', color: '#059669', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '6px 10px', borderRadius: '4px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>📍</span> <strong>Destino:</strong> {cepDestinoInfo}
                      </div>
                    )}

                    {/* Cards de Cotação de Frete */}
                    {opcoesFrete.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px' }}>
                        {opcoesFrete.map((op) => {
                          const isSelected = pedidoTipoEnvio === op.tipo;
                          return (
                            <div
                              key={op.id}
                              onClick={() => {
                                setPedidoTipoEnvio(op.tipo as any);
                                setPedidoValorFrete(op.valor.toFixed(2));
                                setPedidoPrazoEnvio(op.prazo);
                              }}
                              style={{
                                border: `2px solid ${isSelected ? 'var(--primary, #0284c7)' : '#e2e8f0'}`,
                                background: isSelected ? 'rgba(2, 132, 199, 0.06)' : '#fff',
                                borderRadius: '6px',
                                padding: '10px 12px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <span style={{ fontWeight: 700, fontSize: '13px', color: isSelected ? 'var(--primary, #0284c7)' : '#1e293b' }}>
                                  {op.nome}
                                </span>
                                {isSelected && <span style={{ color: 'var(--primary, #0284c7)', fontSize: '12px', fontWeight: 800 }}>✓</span>}
                              </div>
                              <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginBottom: '2px' }}>
                                R$ {op.valor.toFixed(2)}
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>
                                Prazo: <strong>{op.prazo}</strong>
                              </div>
                              <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
                                {op.descricao}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Inputs de Valor do Frete e Prazo */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                  <div style={{ flex: '1', minWidth: '130px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Valor do Frete (R$)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={pedidoValorFrete}
                      onChange={(e) => setPedidoValorFrete(e.target.value)}
                      disabled={pedidoTipoEnvio === 'RETIRADA'}
                      style={{ width: '100%', height: '36px', fontSize: '13px', fontWeight: 600 }}
                    />
                  </div>

                  <div style={{ flex: '2', minWidth: '160px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Prazo Estimado de Entrega
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Imediato, 1 a 2 dias úteis, etc."
                      value={pedidoPrazoEnvio}
                      onChange={(e) => setPedidoPrazoEnvio(e.target.value)}
                      disabled={pedidoTipoEnvio === 'RETIRADA'}
                      style={{ width: '100%', height: '36px', fontSize: '13px' }}
                    />
                  </div>
                </div>
              </div>

              {/* Painel Financeiro do Pedido: CMV, Lucro Bruto e Margem */}
              {(() => {
                const { totalCusto, subtotalProdutos, valorFreteNum, totalPedido, lucroBruto, margemPercentual } = calcularAnaliseFinanceiraPedido();
                return (
                  <div
                    style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      padding: '14px 16px',
                      marginTop: '16px',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                      gap: '12px',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>
                        Subtotal Produtos
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
                        R$ {subtotalProdutos.toFixed(2)}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>
                        Frete / Envio
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#0284c7' }}>
                        R$ {valorFreteNum.toFixed(2)}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--muted)' }}>
                        {pedidoTipoEnvio === 'RETIRADA' ? 'Retirada grátis' : (pedidoPrazoEnvio || 'A combinar')}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>
                        Custo Estimado (CMV)
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#475569' }}>
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
                      <div style={{ fontSize: '10px', color: 'var(--muted)' }}>
                        Margem: {margemPercentual.toFixed(1)}%
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700 }}>
                        Total a Pagar
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent)' }} id="p-pedido-total-label">
                        R$ {totalPedido.toFixed(2)}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--muted)' }}>
                        Produtos + Frete
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label htmlFor="p-data" style={{ margin: 0 }}>Data de Pagamento</label>
                    <button
                      type="button"
                      onClick={() => setPedidoData(pedidoData ? '' : new Date().toISOString().split('T')[0])}
                      style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      {pedidoData ? 'Limpar (Deixar Pendente)' : 'Marcar Pago Hoje'}
                    </button>
                  </div>
                  <input
                    type="date"
                    id="p-data"
                    value={pedidoData}
                    onChange={(e) => setPedidoData(e.target.value)}
                  />
                  <div style={{ fontSize: '11px', color: pedidoData ? '#10b981' : '#f59e0b', marginTop: '3px', fontWeight: 600 }}>
                    {pedidoData ? '✔ Pagamento confirmado' : '⏳ Pagamento pendente (a receber)'}
                  </div>
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
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={fecharModalPedido}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={salvarPedidoMutation.isPending || itensDoPedidoAtual.length === 0}>
                  {salvarPedidoMutation.isPending ? 'Salvando...' : (editingPedidoId ? 'Atualizar Pedido' : 'Confirmar Pedido')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Visualização do Pedido */}
      {modalVisualizarOpen && pedidoVisualizando && (() => {
        const p = pedidoVisualizando;
        const cliente = clientes.find(c => c.id === p.clienteId);
        const itens = p.itens || p.produtos || [];
        
        const frete = p.valorFrete || 0;
        const subtotalProdutos = itens.reduce((acc, it) => acc + it.qtd * it.preco, 0);
        const totalVenda = p.valor ?? (subtotalProdutos + frete);
        const totalCusto = (p.valorCustoTotal !== undefined && p.valorCustoTotal !== null && p.valorCustoTotal > 0)
          ? p.valorCustoTotal
          : itens.reduce((acc, it) => acc + it.qtd * obterCustoUnitarioItem(it, produtosDisponiveis, kitsDisponiveis), 0);
        const lucroBrutoRealizado = p.lucroBruto !== undefined && p.lucroBruto !== null
          ? p.lucroBruto
          : (subtotalProdutos - totalCusto);
        const margemRealizada = subtotalProdutos > 0 ? ((lucroBrutoRealizado / subtotalProdutos) * 100) : 0;
        const dataFormatada = p.dataPagamento ? p.dataPagamento.split('-').reverse().join('/') : '—';

        return (
          <div className="modal-overlay active" onClick={(e) => {
            if (e.target === e.currentTarget) fecharVisualizarPedido();
          }}>
            <div className="modal-content" style={{ maxWidth: '850px', width: '95%' }}>
              <div className="modal-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '14px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShoppingCart size={22} style={{ color: 'var(--primary)' }} />
                    <h3 style={{ margin: 0 }}>Pedido #{p.id ?? '—'}</h3>
                    {p.entregue ? (
                      <span className="badge badge-green" style={{ fontSize: '12px' }}>✔ Entregue</span>
                    ) : (
                      <span className="badge badge-yellow" style={{ fontSize: '12px' }}>⏳ Aguardando Entrega</span>
                    )}
                  </div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                    Data de Pagamento: {dataFormatada} • Forma: <strong>{p.formaPagamento}</strong>
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => imprimirPedido(p)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    title="Imprimir Comprovante do Pedido"
                  >
                    <Printer size={15} /> Imprimir
                  </button>
                  <button className="modal-close" onClick={fecharVisualizarPedido}>&times;</button>
                </div>
              </div>

              <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto', padding: '20px' }}>
                {/* Dados do Cliente */}
                <div style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '14px 16px',
                  marginBottom: '20px'
                }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', fontWeight: 700, marginBottom: '8px' }}>
                    Dados do Cliente
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block' }}>Nome</span>
                      <strong style={{ fontSize: '14px', color: 'var(--text)' }}>{p.clienteNome}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block' }}>Telefone / WhatsApp</span>
                      <span style={{ fontSize: '13px', color: 'var(--text)' }}>{cliente?.telefone ? maskPhone(cliente.telefone) : 'Não informado'}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block' }}>E-mail</span>
                      <span style={{ fontSize: '13px', color: 'var(--text)' }}>{cliente?.email || 'Não informado'}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block' }}>Endereço de Entrega</span>
                      <span style={{ fontSize: '13px', color: 'var(--text)' }}>{cliente?.endereco || 'Não informado / Retirada'}</span>
                    </div>
                  </div>
                </div>

                {/* Dados de Envio e Frete */}
                <div style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '14px 16px',
                  marginBottom: '20px'
                }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Truck size={14} style={{ color: 'var(--primary)' }} /> Dados de Envio & Entrega
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block' }}>Modalidade</span>
                      <strong style={{ fontSize: '13px', color: 'var(--text)' }}>
                        {p.tipoEnvio === 'RETIRADA' && '🏪 Retirada no Local'}
                        {p.tipoEnvio === 'MOTOBOY' && '🛵 Entrega Local / Motoboy'}
                        {p.tipoEnvio === 'CORREIOS_PAC' && '📦 Correios - PAC'}
                        {p.tipoEnvio === 'CORREIOS_SEDEX' && '⚡ Correios - SEDEX'}
                        {p.tipoEnvio === 'TRANSPORTADORA' && '🚚 Transportadora'}
                        {p.tipoEnvio === 'PERSONALIZADO' && '✏️ Personalizado'}
                        {!['RETIRADA', 'MOTOBOY', 'CORREIOS_PAC', 'CORREIOS_SEDEX', 'TRANSPORTADORA', 'PERSONALIZADO'].includes(p.tipoEnvio || '') && (p.tipoEnvio || 'Retirada no Local')}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block' }}>Valor do Frete</span>
                      <strong style={{ fontSize: '14px', color: frete > 0 ? '#0284c7' : 'var(--text)' }}>
                        {frete > 0 ? `R$ ${frete.toFixed(2)}` : 'Grátis / R$ 0,00'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block' }}>CEP de Destino</span>
                      <span style={{ fontSize: '13px', color: 'var(--text)' }}>
                        {p.cepDestino ? maskCep(p.cepDestino) : (cliente?.endereco ? 'Conforme endereço cadastrado' : 'Não informado')}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block' }}>Prazo Estimado</span>
                      <span style={{ fontSize: '13px', color: 'var(--text)' }}>{p.prazoEnvio || 'Imediato / A combinar'}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block' }}>Dimensões do Pacote</span>
                      <span style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 600 }}>
                        {p.comprimentoCm || 24} × {p.larguraCm || 18} × {p.alturaCm || 12} cm
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block' }}>Peso & Cubagem</span>
                      <span style={{ fontSize: '13px', color: 'var(--text)' }}>
                        Real: <strong>{(p.pesoKg || 0.8).toFixed(2)} kg</strong> • Cubado: <strong>{(((p.comprimentoCm || 24) * (p.larguraCm || 18) * (p.alturaCm || 12)) / 6000).toFixed(2)} kg</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tabela de Produtos */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', fontWeight: 700, marginBottom: '8px' }}>
                    Produtos Solicitados ({itens.length})
                  </div>
                  <div className="table-wrapper">
                    <table style={{ width: '100%', background: 'var(--surface)' }}>
                      <thead>
                        <tr style={{ background: 'var(--surface-2)' }}>
                          <th>Item</th>
                          <th className="text-center">Tipo</th>
                          <th className="text-right">Qtd</th>
                          <th className="text-right">Preço Venda</th>
                          <th className="text-right">Preço Custo</th>
                          <th className="text-right">Subtotal Venda</th>
                          <th className="text-right">Subtotal Custo</th>
                          <th className="text-right">Lucro Item</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itens.map((it, idx) => {
                          const custoUn = it.custoUnitario && it.custoUnitario > 0
                            ? it.custoUnitario
                            : obterCustoUnitarioItem(it, produtosDisponiveis, kitsDisponiveis);
                          const subVenda = it.qtd * it.preco;
                          const subCusto = it.qtd * custoUn;
                          const lucroItem = subVenda - subCusto;

                          return (
                            <tr key={idx}>
                              <td style={{ fontWeight: 600 }}>{it.nome}</td>
                              <td className="text-center">
                                {it.tipo === 'KIT' ? (
                                  <span className="badge badge-purple" style={{ fontSize: '10px' }}>Kit</span>
                                ) : (
                                  <span className="badge badge-blue" style={{ fontSize: '10px' }}>Produto</span>
                                )}
                              </td>
                              <td className="text-right td-mono">{it.qtd}</td>
                              <td className="text-right td-mono">R$ {it.preco.toFixed(2)}</td>
                              <td className="text-right td-mono" style={{ color: 'var(--muted)' }}>
                                R$ {custoUn.toFixed(2)}
                              </td>
                              <td className="text-right td-mono font-medium" style={{ color: 'var(--primary)' }}>
                                R$ {subVenda.toFixed(2)}
                              </td>
                              <td className="text-right td-mono" style={{ color: 'var(--muted)' }}>
                                R$ {subCusto.toFixed(2)}
                              </td>
                              <td className="text-right td-mono" style={{
                                fontWeight: 700,
                                color: lucroItem >= 0 ? '#059669' : '#dc2626'
                              }}>
                                R$ {lucroItem.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Resumo Financeiro & Lucro Bruto Realizado */}
                <div style={{
                  background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '16px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '14px',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700 }}>
                      Subtotal Produtos
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)', marginTop: '2px' }}>
                      R$ {subtotalProdutos.toFixed(2)}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Valor dos itens</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700 }}>
                      Valor do Frete
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#0284c7', marginTop: '2px' }}>
                      R$ {frete.toFixed(2)}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{p.tipoEnvio || 'Envio'}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700 }}>
                      Total a Pagar
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--primary)', marginTop: '2px' }}>
                      R$ {totalVenda.toFixed(2)}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Faturamento final</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700 }}>
                      Custo Total (CMV)
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#475569', marginTop: '2px' }}>
                      R$ {totalCusto.toFixed(2)}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Custo dos produtos</div>
                  </div>

                  <div style={{
                    background: lucroBrutoRealizado >= 0 ? '#ecfdf5' : '#fef2f2',
                    border: `1px solid ${lucroBrutoRealizado >= 0 ? '#a7f3d0' : '#fecaca'}`,
                    borderRadius: '8px',
                    padding: '10px 14px'
                  }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: lucroBrutoRealizado >= 0 ? '#065f46' : '#991b1b', fontWeight: 700 }}>
                      Lucro Bruto Realizado
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: lucroBrutoRealizado >= 0 ? '#059669' : '#dc2626', marginTop: '2px' }}>
                      R$ {lucroBrutoRealizado.toFixed(2)}
                    </div>
                    <div style={{ fontSize: '11px', color: lucroBrutoRealizado >= 0 ? '#047857' : '#b91c1c', fontWeight: 600 }}>
                      Produtos - CMV ({margemRealizada.toFixed(1)}%)
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => imprimirPedido(p)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Printer size={16} /> Imprimir Comprovante
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      fecharVisualizarPedido();
                      abrirModalPedido(p);
                    }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Edit2 size={15} /> Editar Pedido
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={fecharVisualizarPedido}>
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
