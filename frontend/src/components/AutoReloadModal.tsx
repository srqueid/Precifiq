import React from 'react';
import { 
  X, 
  RotateCw, 
  Clock, 
  CheckSquare, 
  Square, 
  Check, 
  AlertCircle,
  Play,
  Pause
} from 'lucide-react';
import { useAutoReload, AVAILABLE_RELOAD_PAGES } from '../contexts/AutoReloadContext';

export const AutoReloadModal: React.FC = () => {
  const {
    enabled,
    setEnabled,
    selectedPages,
    togglePage,
    selectAllPages,
    isPaused,
    setIsPaused,
    remainingSeconds,
    isCurrentPageSelected,
    isModalOpen,
    closeModal,
    intervalSeconds
  } = useAutoReload();

  if (!isModalOpen) return null;

  return (
    <div
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
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--surface, #ffffff)',
          color: 'var(--text, #0f172a)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid var(--border, #e2e8f0)',
          overflow: 'hidden'
        }}
      >
        {/* Cabeçalho */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface-2, #f8fafc)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: enabled ? 'rgba(37, 99, 235, 0.12)' : 'rgba(148, 163, 184, 0.15)',
                color: enabled ? '#2563eb' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <RotateCw size={22} className={enabled && !isPaused ? 'spin-slow' : ''} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                Recarregamento Automático
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted, #64748b)' }}>
                Atualização contínua a cada {intervalSeconds} segundos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeModal}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--muted, #64748b)',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Corpo com scroll */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {/* Card de ativação principal */}
          <div
            style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: enabled ? 'rgba(37, 99, 235, 0.05)' : 'var(--surface-2, #f8fafc)',
              border: `1px solid ${enabled ? 'rgba(37, 99, 235, 0.3)' : 'var(--border, #e2e8f0)'}`,
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px'
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Status do Recarregamento</span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: enabled ? (isPaused ? '#fef3c7' : '#dcfce7') : '#f1f5f9',
                    color: enabled ? (isPaused ? '#b45309' : '#15803d') : '#64748b'
                  }}
                >
                  {enabled ? (isPaused ? 'Pausado' : 'Ativo (30s)') : 'Desativado'}
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted, #64748b)' }}>
                Quando ativado, a página aberta será recarregada a cada 30 segundos se estiver marcada abaixo.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {enabled && (
                <button
                  type="button"
                  onClick={() => setIsPaused(!isPaused)}
                  title={isPaused ? 'Retomar timer' : 'Pausar temporariamente'}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: isPaused ? '#16a34a' : '#d97706',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    fontWeight: 600
                  }}
                >
                  {isPaused ? <Play size={14} /> : <Pause size={14} />}
                  <span>{isPaused ? 'Retomar' : 'Pausar'}</span>
                </button>
              )}

              <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span
                  style={{
                    position: 'absolute',
                    cursor: 'pointer',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: enabled ? '#2563eb' : '#cbd5e1',
                    transition: '0.2s',
                    borderRadius: '26px'
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      content: '""',
                      height: '20px',
                      width: '20px',
                      left: enabled ? '24px' : '3px',
                      bottom: '3px',
                      backgroundColor: 'white',
                      transition: '0.2s',
                      borderRadius: '50%',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}
                  />
                </span>
              </label>
            </div>
          </div>

          {/* Dica da página atual */}
          {enabled && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: isCurrentPageSelected ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${isCurrentPageSelected ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                marginBottom: '16px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: isCurrentPageSelected ? '#15803d' : '#b91c1c'
              }}
            >
              <Clock size={16} style={{ flexShrink: 0 }} />
              <div>
                {isCurrentPageSelected ? (
                  isPaused ? (
                    <span>Timer pausado nesta tela. Clique em &quot;Retomar&quot; para continuar.</span>
                  ) : (
                    <span>Esta tela está selecionada! Próximo reload em <strong>{remainingSeconds}s</strong>.</span>
                  )
                ) : (
                  <span>A página atual não está marcada na lista abaixo. O reload automático não ocorrerá aqui.</span>
                )}
              </div>
            </div>
          )}

          {/* Barra de Ações Rápidas */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px'
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary, #475569)' }}>
              Páginas selecionadas ({selectedPages.length}/{AVAILABLE_RELOAD_PAGES.length})
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => selectAllPages(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <CheckSquare size={13} />
                <span>Marcar Todas</span>
              </button>
              <span style={{ color: 'var(--border, #cbd5e1)' }}>|</span>
              <button
                type="button"
                onClick={() => selectAllPages(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted, #64748b)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Square size={13} />
                <span>Desmarcar Todas</span>
              </button>
            </div>
          </div>

          {/* Lista de Páginas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {AVAILABLE_RELOAD_PAGES.map((page) => {
              const isSelected = selectedPages.includes(page.path);
              return (
                <div
                  key={page.path}
                  onClick={() => togglePage(page.path)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: `1px solid ${isSelected ? 'rgba(37, 99, 235, 0.4)' : 'var(--border, #e2e8f0)'}`,
                    backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.04)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                      {page.label}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted, #64748b)' }}>
                      {page.description}
                    </div>
                  </div>

                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '6px',
                      border: `1.5px solid ${isSelected ? '#2563eb' : 'var(--border, #cbd5e1)'}`,
                      backgroundColor: isSelected ? '#2563eb' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      flexShrink: 0
                    }}
                  >
                    {isSelected && <Check size={14} strokeWidth={3} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rodapé do Modal */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface-2, #f8fafc)'
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--muted, #64748b)', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <AlertCircle size={14} />
            <span>Configurações salvas automaticamente neste navegador</span>
          </div>
          <button
            type="button"
            onClick={closeModal}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
