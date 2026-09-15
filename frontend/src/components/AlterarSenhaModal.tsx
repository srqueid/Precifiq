import React, { useState } from 'react';
import { 
  KeyRound, 
  Lock, 
  Eye, 
  EyeOff, 
  X, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck 
} from 'lucide-react';
import { toast } from '../js/app';

interface AlterarSenhaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AlterarSenhaModal: React.FC<AlterarSenhaModalProps> = ({ isOpen, onClose }) => {
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');

  const [showSenhaAtual, setShowSenhaAtual] = useState(false);
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [erroMsg, setErroMsg] = useState<string | null>(null);
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setSenhaAtual('');
    setNovaSenha('');
    setConfirmarSenha('');
    setErroMsg(null);
    setSucessoMsg(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroMsg(null);
    setSucessoMsg(null);

    if (!senhaAtual) {
      setErroMsg('Por favor, informe sua senha atual.');
      return;
    }

    if (novaSenha.length < 6) {
      setErroMsg('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setErroMsg('A confirmação da nova senha não confere.');
      return;
    }

    if (senhaAtual === novaSenha) {
      setErroMsg('A nova senha deve ser diferente da senha atual.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/global/auth/trocar-senha', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          senhaAtual,
          novaSenha
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const erro = data.error || 'Não foi possível alterar a senha.';
        setErroMsg(erro);
        toast(erro, 'error');
        setIsLoading(false);
        return;
      }

      const msg = data.message || 'Senha alterada com sucesso!';
      setSucessoMsg(msg);
      toast(msg, 'success');
      setIsLoading(false);

      setTimeout(() => {
        handleClose();
      }, 1200);
    } catch (e: any) {
      const erro = e.message || 'Erro ao conectar ao servidor.';
      setErroMsg(erro);
      toast(erro, 'error');
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="modal-overlay" 
      onClick={handleClose} 
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1100,
        padding: '16px'
      }}
    >
      <div 
        className="modal-content animate-in fade-in zoom-in-95 duration-200" 
        onClick={(e) => e.stopPropagation()}
        style={{ 
          maxWidth: '460px', 
          width: '100%', 
          maxHeight: '90vh',
          padding: 0, 
          overflow: 'hidden',
          backgroundColor: 'var(--surface)',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid var(--border)',
          margin: 'auto'
        }}
      >
        {/* Cabeçalho do Modal */}
        <div style={{
          padding: '18px 22px',
          background: 'var(--surface-2)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'rgba(99, 102, 241, 0.12)',
              color: '#6366f1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <KeyRound size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>
                Alterar Minha Senha
              </h2>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted)' }}>
                Atualize sua credencial de acesso ao Precifiq
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={handleClose}
            className="btn-icon"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Corpo do Formulário */}
        <form onSubmit={handleSubmit} style={{ padding: '22px' }}>
          {erroMsg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}>
              <AlertCircle size={16} className="shrink-0" />
              <span>{erroMsg}</span>
            </div>
          )}

          {sucessoMsg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              color: '#15803d',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}>
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{sucessoMsg}</span>
            </div>
          )}

          {/* Senha Atual */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
              Senha Atual
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', color: 'var(--muted)' }} />
              <input
                type={showSenhaAtual ? 'text' : 'password'}
                required
                placeholder="Informe sua senha atual"
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 40px 9px 36px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: '13px'
                }}
              />
              <button
                type="button"
                onClick={() => setShowSenhaAtual(!showSenhaAtual)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--muted)',
                  display: 'flex'
                }}
              >
                {showSenhaAtual ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Nova Senha */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
              Nova Senha (mínimo 6 caracteres)
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <KeyRound size={16} style={{ position: 'absolute', left: '12px', color: 'var(--muted)' }} />
              <input
                type={showNovaSenha ? 'text' : 'password'}
                required
                minLength={6}
                placeholder="Crie sua nova senha"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 40px 9px 36px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: '13px'
                }}
              />
              <button
                type="button"
                onClick={() => setShowNovaSenha(!showNovaSenha)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--muted)',
                  display: 'flex'
                }}
              >
                {showNovaSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirmar Nova Senha */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
              Confirmar Nova Senha
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <ShieldCheck size={16} style={{ position: 'absolute', left: '12px', color: 'var(--muted)' }} />
              <input
                type={showConfirmarSenha ? 'text' : 'password'}
                required
                minLength={6}
                placeholder="Repita a nova senha"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 40px 9px 36px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: '13px'
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmarSenha(!showConfirmarSenha)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--muted)',
                  display: 'flex'
                }}
              >
                {showConfirmarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Rodapé / Botões de Ação */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={handleClose}
              className="btn btn-secondary"
              disabled={isLoading}
              style={{ padding: '8px 16px', fontSize: '13px', cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || !senhaAtual || !novaSenha || !confirmarSenha}
              className="btn btn-primary"
              style={{
                padding: '8px 18px',
                fontSize: '13px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer'
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <KeyRound size={16} />
                  <span>Salvar Nova Senha</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AlterarSenhaModal;
