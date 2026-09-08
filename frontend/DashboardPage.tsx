import React from 'react'
import { useQuery } from '@tanstack/react-query'

const DashboardPage: React.FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await fetch('/dashboard/json')
      if (!res.ok) throw new Error('Falha ao carregar dados do dashboard')
      return res.json()
    }
  })

  const d = data || {}
  const precos = d.precos || []
  const estoque = d.estoque || []
  const pendentes = d.comprasPendentes || []

  // Formatadores (baseados no app.js legado)
  const formatBRL = (v: number) => `R$ ${(Number(v) || 0).toFixed(2)}`
  const formatPct = (v: number) => `${((Number(v) || 0) * 100).toFixed(0)}%`

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Visão geral do sistema</p>
        </div>

        {isLoading && <div className="mb-4 text-gray-500 bg-white p-4 rounded-xl shadow-sm">Carregando dashboard...</div>}
        {error && <div className="mb-4 text-red-600 bg-red-50 p-4 rounded-xl shadow-sm">Erro: {(error as Error).message}</div>}

        {/* KPIs (Imitando os kpi-cards do dashboard.html) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
            <div className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">Compras Aguardando</div>
            <div className="text-3xl font-bold text-emerald-500">{d.comprasPendentesCount ?? 0}</div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
            <div className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">Orçamentos em Elaboração</div>
            <div className="text-3xl font-bold text-yellow-500">{d.orcamentosCount ?? 0}</div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
            <div className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">Orçamentos Aprovados</div>
            <div className="text-3xl font-bold text-blue-500">{d.aprovadosCount ?? 0}</div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
            <div className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">Compras do Mês</div>
            <div className="text-3xl font-bold text-red-500">{formatBRL(d.comprasTotal)}</div>
          </div>
        </div>

        {/* Conteúdo principal */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
          
          {/* Planilha de Preços (1.4fr ~ col-span-7) */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-7 overflow-x-auto flex flex-col">
            <h2 className="text-lg font-bold mb-4 text-gray-900 border-b pb-3">Planilha de Preços</h2>
            <div className="flex-1">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="p-3 font-semibold">Produto</th>
                    <th className="p-3 font-semibold">Tamanho</th>
                    <th className="p-3 font-semibold">Custo</th>
                    <th className="p-3 font-semibold">Venda</th>
                    <th className="p-3 font-semibold">Margem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {precos.map((p: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="p-3 text-gray-900 font-medium">{p.produtoNome}</td>
                      <td className="p-3 text-gray-600">{p.nomeTamanho}</td>
                      <td className="p-3 text-blue-600 font-mono font-medium">{formatBRL(p.custoUnitarioCalculado)}</td>
                      <td className="p-3 text-blue-600 font-mono font-medium">{formatBRL(p.precoVenda)}</td>
                      <td className="p-3 text-emerald-600 font-mono font-bold">{formatPct(p.margemLucro)}</td>
                    </tr>
                  ))}
                  {precos.length === 0 && !isLoading && (
                    <tr><td colSpan={5} className="p-6 text-center text-gray-400">Nenhum produto precificado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-gray-500">Atualizado automaticamente com base no custo calculado.</p>
          </div>

          {/* Estoque (1fr ~ col-span-5) */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-5 overflow-x-auto">
            <h2 className="text-lg font-bold mb-4 text-gray-900 border-b pb-3">Estoque</h2>
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="p-3 font-semibold">Nome</th>
                  <th className="p-3 font-semibold">Tipo</th>
                  <th className="p-3 font-semibold text-right">Estoque</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {estoque.map((i: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="p-3 text-gray-900 font-medium">{i.nome}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${i.tipo === 'Embalagem' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                        {i.tipo}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-medium text-gray-700">{i.estoque ?? '—'} {i.unidadeSigla}</td>
                  </tr>
                ))}
                {estoque.length === 0 && !isLoading && (
                  <tr><td colSpan={3} className="p-6 text-center text-gray-400">Sem dados de estoque</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Compras pendentes */}
        {pendentes.length > 0 && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
            <h2 className="text-lg font-bold mb-4 text-gray-900 border-b pb-3">Compras Aguardando Recebimento</h2>
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="p-3 font-semibold">#</th>
                  <th className="p-3 font-semibold">Data</th>
                  <th className="p-3 font-semibold text-right">Valor</th>
                  <th className="p-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pendentes.map((c: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="p-3 font-mono font-medium text-gray-600">#{c.id}</td>
                    <td className="p-3 text-gray-800">{c.dataCriacao || '—'}</td>
                    <td className="p-3 text-right font-mono font-medium text-gray-900">{formatBRL(c.valorTotal)}</td>
                    <td className="p-3">
                      <span className="px-2 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  )
}

export default DashboardPage