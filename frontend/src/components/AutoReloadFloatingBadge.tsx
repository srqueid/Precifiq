import React, { useState } from 'react';
import { RotateCw, Settings, Pause, Play, ChevronDown, ChevronUp } from 'lucide-react';
import { useAutoReload } from '../contexts/AutoReloadContext';

export const AutoReloadFloatingBadge: React.FC = () => {
  const {
    enabled,
    isCurrentPageSelected,
    isPaused,
    setIsPaused,
    remainingSeconds,
    openModal
  } = useAutoReload();

  const [isMinimized, setIsMinimized] = useState(false);

  // Se não estiver habilitado globalmente, não exibe o badge flutuante
  if (!enabled) return null;

  return (
    <aside
      aria-label="Controle de Recarregamento Automático"
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '16px',
        zIndex: 900,
        display: 'flex',
        alignItems: 'center',
        background: isCurrentPageSelected
          ? (isPaused ? 'var(--surface, #ffffff)' : 'var(--surface, #ffffff)')
          : 'var(--surface, #ffffff)',
        border: `1.5px solid ${
          isCurrentPageSelected
            ? (isPaused ? '#f59e0b' : '#2563eb')
            : 'var(--border, #cbd5e1)'
        }`,
        borderRadius: '30px',
        padding: isMinimized ? '6px 10px' : '6px 12px 6px 10px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        gap: '8px',
        color: 'var(--text, #0f172a)',
        fontSize: '12px',
        fontFamily: 'inherit',
        backdropFilter: 'blur(8px)',
        transition: 'all 0.2s ease-in-out'
      }}
    >
      {/* Ícone com indicador de animação */}
      <div
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          backgroundColor: isCurrentPageSelected
            ? (isPaused ? 'rgba(245, 158, 11, 0.15)' : 'rgba(37, 99, 235, 0.12)')
            : 'rgba(100, 116, 139, 0.1)',
          color: isCurrentPageSelected
            ? (isPaused ? '#d97706' : '#2563eb')
            : '#64748b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}
      >
        <RotateCw
          size={14}
          style={{
            animation: isCurrentPageSelected && !isPaused ? 'spin 3s linear infinite' : 'none'
          }}
        />
      </div>

      {!isMinimized && (
        <>
          {/* Informação textual do status e tempo */}
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
            {isCurrentPageSelected ? (
              <>
                <span style={{ fontWeight: 700, fontSize: '12px', color: isPaused ? '#d97706' : '#2563eb' }}>
                  {isPaused ? 'Reload Pausado' : `Reload em ${remainingSeconds}s`}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--muted, #64748b)' }}>
                  A cada 30 segundos
                </span>
              </>
            ) : (
              <>
                <span style={{ fontWeight: 600, fontSize: '11px', color: 'var(--muted, #64748b)' }}>
                  Reload 30s Inativo nesta página
                </span>
                <span
                  onClick={openModal}
                  style={{
                    fontSize: '10px',
                    color: '#2563eb',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Selecionar esta página
                </span>
              </>
            )}
          </div>

          {/* Botões de Ação rápida */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px' }}>
            {isCurrentPageSelected && (
              <button
                type="button"
                onClick={() => setIsPaused(!isPaused)}
                title={isPaused ? 'Retomar timer de reload' : 'Pausar temporariamente'}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: isPaused ? '#16a34a' : '#d97706',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {isPaused ? <Play size={14} /> : <Pause size={14} />}
              </button>
            )}

            <button
              type="button"
              onClick={openModal}
              title="Configurar páginas com reload automático"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary, #475569)',
                padding: '4px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Settings size={14} />
            </button>
          </div>
        </>
      )}

      {/* Botão de minimizar/expandir o badge */}
      <button
        type="button"
        onClick={() => setIsMinimized(!isMinimized)}
        title={isMinimized ? 'Expandir controle de reload' : 'Minimizar'}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--muted, #94a3b8)',
          padding: '2px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {isMinimized ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </aside>
  );
};
