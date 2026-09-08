import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  Sparkles, 
  Send, 
  X, 
  Copy, 
  Check, 
  Database, 
  Clock, 
  ShieldCheck, 
  HelpCircle, 
  Trash2,
  Table as TableIcon,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface CopilotResposta {
  sucesso: boolean;
  pergunta: string;
  respostaMarkdown: string;
  sqlExecutado?: string;
  colunas: string[];
  linhas: Array<Record<string, any>>;
  totalRegistros: number;
  tempoExecucaoMs: number;
  erro?: string;
}

interface MensagemChat {
  id: string;
  origem: 'user' | 'ia';
  texto: string;
  resposta?: CopilotResposta;
  timestamp: string;
}

interface Sugestao {
  id: string;
  categoria: string;
  pergunta: string;
}

interface CopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CopilotModal: React.FC<CopilotModalProps> = ({ isOpen, onClose }) => {
  const [perguntaInput, setPerguntaInput] = useState('');
  const [mensagens, setMensagens] = useState<MensagemChat[]>([]);
  const [copiedSqlIndex, setCopiedSqlIndex] = useState<number | null>(null);
  const [sqlExpandidoIndex, setSqlExpandidoIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Busca sugestões de perguntas da API
  const { data: sugestoesData } = useQuery<{ sugestoes: Sugestao[] }>({
    queryKey: ['copilot-sugestoes'],
    queryFn: async () => {
      const res = await fetch('/api/ai/copilot/sugestoes');
      if (!res.ok) {
        const fallback = await fetch('/ai/copilot/sugestoes');
        if (!fallback.ok) return { sugestoes: [] };
        return fallback.json();
      }
      return res.json();
    },
    staleTime: 300_000,
    enabled: isOpen
  });

  // Mutação para perguntar ao Copilot
  const perguntarMutation = useMutation({
    mutationFn: async (pergunta: string) => {
      const res = await fetch('/api/ai/copilot/perguntar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pergunta })
      });
      if (!res.ok) {
        const fallback = await fetch('/ai/copilot/perguntar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pergunta })
        });
        if (!fallback.ok) throw new Error('Falha ao comunicar com o Copilot IA');
        return fallback.json() as Promise<CopilotResposta>;
      }
      return res.json() as Promise<CopilotResposta>;
    },
    onSuccess: (resposta, perguntaEnviada) => {
      const novaMsgIa: MensagemChat = {
        id: `ia-${Date.now()}`,
        origem: 'ia',
        texto: resposta.respostaMarkdown,
        resposta: resposta,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
      setMensagens(prev => [...prev, novaMsgIa]);
    },
    onError: (err: any, perguntaEnviada) => {
      const novaMsgErro: MensagemChat = {
        id: `ia-${Date.now()}`,
        origem: 'ia',
        texto: `❌ **Ocorreu um erro ao processar sua pergunta**: ${err.message || 'Falha de conexão com o backend'}`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
      setMensagens(prev => [...prev, novaMsgErro]);
    }
  });

  // Foco automático no input quando o modal abre
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Scroll suave ao receber novas mensagens
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensagens, perguntarMutation.isPending]);

  // Fechar no Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleEnviar = (texto?: string) => {
    const pergunta = (texto ?? perguntaInput).trim();
    if (!pergunta || perguntarMutation.isPending) return;

    // Adiciona mensagem do usuário
    const novaMsgUsuario: MensagemChat = {
      id: `user-${Date.now()}`,
      origem: 'user',
      texto: pergunta,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    setMensagens(prev => [...prev, novaMsgUsuario]);
    setPerguntaInput('');
    perguntarMutation.mutate(pergunta);
  };

  const copiarSql = (sql: string, index: number) => {
    navigator.clipboard.writeText(sql);
    setCopiedSqlIndex(index);
    setTimeout(() => setCopiedSqlIndex(null), 2000);
  };

  const limparHistorico = () => {
    setMensagens([]);
  };

  const sugestoes = sugestoesData?.sugestoes || [
    { id: '1', categoria: 'Estoque', pergunta: 'Quais insumos estão com estoque abaixo do mínimo?' },
    { id: '2', categoria: 'Produtos', pergunta: 'Quais são os 5 produtos com maior margem de lucro?' },
    { id: '3', categoria: 'Compras', pergunta: 'Quais compras estão pendentes de recebimento?' },
    { id: '4', categoria: 'Estoque', pergunta: 'Qual o valor total imobilizado em estoque?' }
  ];

  return (
    <div 
      className="modal-overlay" 
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '60px',
        paddingBottom: '40px',
        overflowY: 'auto'
      }}
    >
      <div 
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '95%',
          maxWidth: '820px',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '85vh',
          overflow: 'hidden'
        }}
      >
        {/* Cabeçalho do Spotlight */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(to right, #f8faff, #ffffff)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #6366f1, #9333ea)',
              color: '#ffffff',
              padding: '8px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.2)'
            }}>
              <Sparkles size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '16px', color: '#1e293b' }}>
                  Copilot Operacional & Financeiro
                </span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  backgroundColor: '#e0e7ff',
                  color: '#4338ca',
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}>
                  Text-to-SQL Read-Only
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                Pergunte em linguagem natural sobre estoque, custos, produtos e compras
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {mensagens.length > 0 && (
              <button
                type="button"
                onClick={limparHistorico}
                className="btn btn-secondary btn-sm"
                title="Limpar histórico da conversa"
                style={{ fontSize: '12px', padding: '6px 10px', color: '#64748b' }}
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary btn-sm"
              style={{ padding: '6px', borderRadius: '8px' }}
              title="Fechar (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Input Bar Estilo Spotlight */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <form 
            onSubmit={(e) => { e.preventDefault(); handleEnviar(); }}
            style={{ display: 'flex', gap: '10px', alignItems: 'center' }}
          >
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                ref={inputRef}
                type="text"
                value={perguntaInput}
                onChange={(e) => setPerguntaInput(e.target.value)}
                placeholder="Pergunte ao seu ERP (ex: Quais insumos estão com estoque crítico?)..."
                disabled={perguntarMutation.isPending}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '14px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  outline: 'none',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                  transition: 'border-color 0.2s',
                  backgroundColor: perguntarMutation.isPending ? '#f8fafc' : '#ffffff'
                }}
                onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
              />
            </div>
            <button
              type="submit"
              disabled={!perguntaInput.trim() || perguntarMutation.isPending}
              style={{
                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '12px 18px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: (!perguntaInput.trim() || perguntarMutation.isPending) ? 'not-allowed' : 'pointer',
                opacity: (!perguntaInput.trim() || perguntarMutation.isPending) ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {perguntarMutation.isPending ? (
                <span>Consultando...</span>
              ) : (
                <>
                  <span>Enviar</span>
                  <Send size={15} />
                </>
              )}
            </button>
          </form>

          {/* Sugestões Rápidas de Perguntas */}
          {mensagens.length === 0 && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Sugestões de perguntas operacionais:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {sugestoes.slice(0, 4).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleEnviar(s.pergunta)}
                    style={{
                      backgroundColor: '#f1f5f9',
                      border: '1px solid #e2e8f0',
                      borderRadius: '16px',
                      padding: '5px 12px',
                      fontSize: '12px',
                      color: '#334155',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#e0e7ff';
                      e.currentTarget.style.borderColor = '#c7d2fe';
                      e.currentTarget.style.color = '#3730a3';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#f1f5f9';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.color = '#334155';
                    }}
                  >
                    💬 {s.pergunta}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Histórico do Chat */}
        <div 
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            backgroundColor: '#f8fafc'
          }}
        >
          {mensagens.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#ede9fe',
                color: '#7c3aed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px auto'
              }}>
                <Sparkles size={24} />
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', margin: '0 0 6px 0' }}>
                O que você gostaria de analisar agora?
              </h3>
              <p style={{ fontSize: '13px', margin: 0, maxWidth: '440px', marginLeft: 'auto', marginRight: 'auto' }}>
                O Copilot traduz suas perguntas diretamente para consultas seguras no PostgreSQL do ERP, trazendo resumos inteligentes e tabelas com dados ao vivo.
              </p>
            </div>
          ) : (
            mensagens.map((msg, index) => {
              const isUser = msg.origem === 'user';

              return (
                <div 
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isUser ? 'flex-end' : 'flex-start',
                    width: '100%'
                  }}
                >
                  {/* Bolha da Mensagem */}
                  <div style={{
                    maxWidth: isUser ? '80%' : '100%',
                    width: isUser ? 'auto' : '100%',
                    backgroundColor: isUser ? '#4f46e5' : '#ffffff',
                    color: isUser ? '#ffffff' : '#1e293b',
                    padding: isUser ? '10px 16px' : '18px 20px',
                    borderRadius: isUser ? '16px 16px 4px 16px' : '16px',
                    boxShadow: isUser ? '0 2px 4px rgba(79, 70, 229, 0.2)' : '0 1px 3px rgba(0, 0, 0, 0.08)',
                    border: isUser ? 'none' : '1px solid #e2e8f0'
                  }}>
                    {/* Header para Mensagem da IA */}
                    {!isUser && (
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '12px',
                        paddingBottom: '8px',
                        borderBottom: '1px solid #f1f5f9'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Sparkles size={16} style={{ color: '#7c3aed' }} />
                          <strong style={{ fontSize: '13px', color: '#1e293b' }}>Copilot IA</strong>
                        </div>
                        {msg.resposta && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', color: '#64748b' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={12} />
                              {msg.resposta.tempoExecucaoMs}ms
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <TableIcon size={12} />
                              {msg.resposta.totalRegistros} registro(s)
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Texto da Mensagem / Markdown simples */}
                    <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
                      {msg.texto.split('\n\n').map((paragrafo, pIdx) => (
                        <p key={pIdx} style={{ margin: pIdx === 0 ? 0 : '8px 0 0 0' }}>
                          {paragrafo}
                        </p>
                      ))}
                    </div>

                    {/* Tabela de Resultados caso haja dados */}
                    {!isUser && msg.resposta && msg.resposta.linhas.length > 0 && (
                      <div style={{ marginTop: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                        <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 1 }}>
                              <tr>
                                {msg.resposta.colunas.map((col, cIdx) => (
                                  <th 
                                    key={cIdx} 
                                    style={{
                                      padding: '8px 12px',
                                      textAlign: 'left',
                                      fontWeight: 600,
                                      color: '#475569',
                                      borderBottom: '1px solid #e2e8f0',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {col}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {msg.resposta.linhas.slice(0, 15).map((row, rIdx) => (
                                <tr 
                                  key={rIdx}
                                  style={{
                                    borderBottom: '1px solid #f1f5f9',
                                    backgroundColor: rIdx % 2 === 0 ? '#ffffff' : '#fafafa'
                                  }}
                                >
                                  {msg.resposta!.colunas.map((col, cIdx) => {
                                    const val = row[col];
                                    const isNumeric = typeof val === 'number';
                                    return (
                                      <td 
                                        key={cIdx}
                                        style={{
                                          padding: '8px 12px',
                                          color: '#1e293b',
                                          fontFamily: isNumeric ? 'monospace' : 'inherit'
                                        }}
                                      >
                                        {val === null || val === undefined 
                                          ? <span style={{ color: '#94a3b8' }}>—</span> 
                                          : typeof val === 'number'
                                          ? val.toLocaleString('pt-BR')
                                          : String(val)
                                        }
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {msg.resposta.linhas.length > 15 && (
                          <div style={{ padding: '6px 12px', fontSize: '11px', color: '#64748b', backgroundColor: '#f8fafc', textAlign: 'right', borderTop: '1px solid #e2e8f0' }}>
                            Exibindo primeiros 15 de {msg.resposta.totalRegistros} registros.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bloco de SQL Colapsável */}
                    {!isUser && msg.resposta?.sqlExecutado && (
                      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setSqlExpandidoIndex(sqlExpandidoIndex === index ? null : index)}
                            style={{
                              border: 'none',
                              background: 'none',
                              padding: 0,
                              fontSize: '11px',
                              fontWeight: 600,
                              color: '#6366f1',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Database size={12} />
                            {sqlExpandidoIndex === index ? 'Ocultar consulta SQL executada' : 'Ver consulta SQL executada'}
                            {sqlExpandidoIndex === index ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>

                          <button
                            type="button"
                            onClick={() => copiarSql(msg.resposta!.sqlExecutado!, index)}
                            style={{
                              border: 'none',
                              background: 'none',
                              padding: 0,
                              fontSize: '11px',
                              color: copiedSqlIndex === index ? '#16a34a' : '#64748b',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            {copiedSqlIndex === index ? <Check size={12} /> : <Copy size={12} />}
                            {copiedSqlIndex === index ? 'Copiado!' : 'Copiar SQL'}
                          </button>
                        </div>

                        {sqlExpandidoIndex === index && (
                          <pre style={{
                            margin: '8px 0 0 0',
                            padding: '10px 12px',
                            backgroundColor: '#0f172a',
                            color: '#38bdf8',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all'
                          }}>
                            {msg.resposta.sqlExecutado}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Timestamp */}
                  <span style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px', paddingLeft: '4px', paddingRight: '4px' }}>
                    {msg.timestamp}
                  </span>
                </div>
              );
            })
          )}

          {/* Estado de Carregamento */}
          {perguntarMutation.isPending && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: '#ffffff',
              padding: '12px 18px',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              maxWidth: '300px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <Sparkles size={16} className="animate-spin" style={{ color: '#7c3aed' }} />
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Traduzindo para SQL e consultando...
              </span>
            </div>
          )}
        </div>

        {/* Rodapé informativo */}
        <div style={{
          padding: '10px 20px',
          borderTop: '1px solid #f1f5f9',
          backgroundColor: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          color: '#64748b'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={14} style={{ color: '#16a34a' }} />
            <span>Consultas estritamente de leitura (SELECT). Seus dados permanecem seguros.</span>
          </div>
          <div>
            <span>Atalho: <kbd style={{ padding: '2px 5px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '10px' }}>Ctrl + K</kbd></span>
          </div>
        </div>
      </div>
    </div>
  );
};
