import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  KeyRound, 
  Lock, 
  Eye, 
  EyeOff, 
  X, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  RefreshCw, 
  ShieldCheck, 
  HelpCircle 
} from 'lucide-react';
import { toast } from '../js/app';

interface RecuperarSenhaModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
  onSenhaRedefinida?: (email: string) => void;
}

export const RecuperarSenhaModal: React.FC<RecuperarSenhaModalProps> = ({
  isOpen,
  onClose,
  initialEmail = '',
  onSenhaRedefinida
}) => {
  const [step, setStep] = useState<'SOLICITAR' | 'REDEFINIR'>('SOLICITAR');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');

  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [erroMsg, setErroMsg] = useState<string | null>(null);
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEmail(initialEmail.trim());
      setStep('SOLICITAR');
      setCodigo('');
      setNovaSenha('');
      setConfirmarSenha('');
      setErroMsg(null);
      setSucessoMsg(null);
    }
  }, [isOpen, initialEmail]);

  if (!isOpen) return null;

  const handleSolicitarCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroMsg(null);
    setSucessoMsg(null);

    const emailLimpo = email.trim();
    if (!emailLimpo || !emailLimpo.includes('@')) {
      setErroMsg('Por favor, informe um endereço de e-mail válido.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/global/auth/esqueci-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailLimpo })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const erro = data.error || 'Falha ao solicitar código de recuperação.';
        setErroMsg(erro);
        toast(erro, 'error');
        setIsLoading(false);
        return;
      }

      const msg = data.message || 'Código de recuperação enviado para o seu e-mail!';
      setSucessoMsg(msg);
      toast(msg, 'success');
      setIsLoading(false);
      setStep('REDEFINIR');
    } catch (e: any) {
      const erro = e.message || 'Erro ao conectar ao servidor.';
      setErroMsg(erro);
      toast(erro, 'error');
      setIsLoading(false);
    }
  };

  const handleRedefinirSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroMsg(null);
    setSucessoMsg(null);

    const codigoLimpo = codigo.trim();
    if (!codigoLimpo) {
      setErroMsg('Por favor, digite o código de 6 dígitos recebido por e-mail.');
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

    setIsLoading(true);

    try {
      const res = await fetch('/api/global/auth/redefinir-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          token: codigoLimpo,
          novaSenha
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const erro = data.error || 'Código inválido ou expirado.';
        setErroMsg(erro);
        toast(erro, 'error');
        setIsLoading(false);
        return;
      }

      const msg = data.message || 'Senha redefinida com sucesso!';
      setSucessoMsg(msg);
      toast(msg, 'success');
      setIsLoading(false);

      if (onSenhaRedefinida) {
        onSenhaRedefinida(email.trim());
      }

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (e: any) {
      const erro = e.message || 'Erro ao conectar ao servidor.';
      setErroMsg(erro);
      toast(erro, 'error');
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1050 }}>
      <div 
        className="modal-content animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '440px', width: '92%', padding: 0, overflow: 'hidden' }}
      >
        {/* Topo do Modal */}
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
                Recuperação de Senha
              </h2>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted)' }}>
                {step === 'SOLICITAR' ? 'Informe seu e-mail cadastrado' : 'Cadastre sua nova senha com o código'}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="btn-icon"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Mensagens de Feedback */}
        <div style={{ padding: '0 22px', paddingTop: (erroMsg || sucessoMsg) ? '16px' : '0' }}>
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
              gap: '8px'
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
              gap: '8px'
            }}>
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{sucessoMsg}</span>
            </div>
          )}
        </div>

        {/* ETAPA 1: Solicitar Código */}
        {step === 'SOLICITAR' ? (
          <form onSubmit={handleSolicitarCodigo} style={{ padding: '22px' }}>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: 0, marginBottom: '16px', lineHeight: 1.5 }}>
              Digite o e-mail de acesso cadastrado na plataforma. Nós enviaremos um código de 6 dígitos com validade de 15 minutos para redefinição segura da senha.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
                E-mail Cadastrado
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Mail size={16} style={{ position: 'absolute', left: '12px', color: 'var(--muted)' }} />
                <input
                  type="email"
                  required
                  placeholder="seu.email@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 36px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: '13px'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
                disabled={isLoading}
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLoading || !email.trim()}
                className="btn btn-primary"
                style={{
                  padding: '8px 18px',
                  fontSize: '13px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Enviando código...</span>
                  </>
                ) : (
                  <>
                    <span>Enviar Código</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* ETAPA 2: Digitar Código e Nova Senha */
          <form onSubmit={handleRedefinirSenha} style={{ padding: '22px' }}>
            <div style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '12px',
              color: 'var(--text)',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                Código enviado para <strong>{email}</strong>
              </div>
              <button
                type="button"
                onClick={() => { setStep('SOLICITAR'); setErroMsg(null); }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#6366f1',
                  fontWeight: 600,
                  fontSize: '11px',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Alterar e-mail
              </button>
            </div>

            {/* Código de Segurança */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
                Código de Segurança (6 dígitos)
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <KeyRound size={16} style={{ position: 'absolute', left: '12px', color: 'var(--muted)' }} />
                <input
                  type="text"
                  required
                  maxLength={10}
                  placeholder="Ex: 123456"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\s+/g, ''))}
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 36px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    letterSpacing: '2px'
                  }}
                />
              </div>
            </div>

            {/* Nova Senha */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
                Nova Senha (mínimo 6 caracteres)
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', color: 'var(--muted)' }} />
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={handleSolicitarCodigo}
                disabled={isLoading}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--muted)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
                <span>Reenviar código</span>
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-secondary"
                  disabled={isLoading}
                  style={{ padding: '8px 14px', fontSize: '13px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !codigo.trim() || !novaSenha || !confirmarSenha}
                  className="btn btn-primary"
                  style={{
                    padding: '8px 18px',
                    fontSize: '13px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={16} />
                      <span>Redefinir Senha</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default RecuperarSenhaModal;
