import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Printer, 
  Share2, 
  ArrowUp, 
  Check, 
  BookOpen, 
  ListCollapse, 
  ExternalLink,
  ChevronRight,
  Info,
  AlertTriangle,
  Lightbulb,
  X,
  ZoomIn
} from 'lucide-react';

interface MarkdownDocViewerProps {
  content: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  version?: string;
  onBackToApp?: () => void;
  isPublic?: boolean;
}

interface TocItem {
  id: string;
  title: string;
  level: number;
}

// Converte texto de título para id de âncora consistente com o markdown
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// Normaliza caminhos de imagens relativas para rota pública absoluta
function resolveImageUrl(raw: string): string {
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) {
    return raw;
  }
  let cleaned = raw.replace(/^\.\//, '');
  if (!cleaned.startsWith('/')) {
    cleaned = '/' + cleaned;
  }
  return cleaned;
}

export const MarkdownDocViewer: React.FC<MarkdownDocViewerProps> = ({
  content,
  title,
  subtitle,
  icon,
  version = 'v0.1.0',
  onBackToApp,
  isPublic = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [showToc, setShowToc] = useState(true);
  const [activeTocId, setActiveTocId] = useState<string>('');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);

  // Monitora scroll para botão "Voltar ao topo" e tecla ESC para fechar modal de imagem
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedImage(null);
    };
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Extrai sumário (TOC) a partir dos títulos # e ## e ###
  const tocList = useMemo<TocItem[]>(() => {
    const lines = content.split('\n');
    const items: TocItem[] = [];

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') && !trimmed.startsWith('####')) {
        const level = trimmed.indexOf(' ');
        if (level > 0 && level <= 3) {
          const rawText = trimmed.substring(level).trim();
          const cleanText = rawText.replace(/\*\*/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1');
          const id = slugify(cleanText);
          if (cleanText) {
            items.push({ id, title: cleanText, level });
          }
        }
      }
    });

    return items;
  }, [content]);

  // Copiar link atual
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Navegar para âncora suavemente
  const scrollToAnchor = (id: string) => {
    setActiveTocId(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Renderizador seguro e robusto de Markdown
  const renderedElements = useMemo(() => {
    const lines = content.split('\n');
    const nodes: React.ReactNode[] = [];
    let i = 0;

    const parseInline = (text: string): React.ReactNode[] => {
      const parts: React.ReactNode[] = [];
      let remaining = text;
      let keyCounter = 0;

      // Imagens: ![alt](url)
      const imgRegex = /!\[(.*?)\]\((.*?)\)/;
      // Links: [texto](url)
      const linkRegex = /\[(.*?)\]\((.*?)\)/;
      // Código inline: `code`
      const codeRegex = /`([^`]+)`/;
      // Negrito: **bold**
      const boldRegex = /\*\*([^*]+)\*\*/;
      // Itálico: *italic*
      const italicRegex = /\*([^*]+)\*/;

      while (remaining.length > 0) {
        // Encontra o mais próximo
        const imgMatch = remaining.match(imgRegex);
        const linkMatch = remaining.match(linkRegex);
        const codeMatch = remaining.match(codeRegex);
        const boldMatch = remaining.match(boldRegex);
        const italicMatch = remaining.match(italicRegex);

        const matches = [
          imgMatch ? { type: 'img', index: imgMatch.index!, match: imgMatch } : null,
          linkMatch ? { type: 'link', index: linkMatch.index!, match: linkMatch } : null,
          codeMatch ? { type: 'code', index: codeMatch.index!, match: codeMatch } : null,
          boldMatch ? { type: 'bold', index: boldMatch.index!, match: boldMatch } : null,
          italicMatch ? { type: 'italic', index: italicMatch.index!, match: italicMatch } : null,
        ].filter(Boolean) as { type: string; index: number; match: RegExpMatchArray }[];

        if (matches.length === 0) {
          // Destaca termos de busca, se houver
          if (searchTerm.trim().length > 1) {
            const query = searchTerm.toLowerCase();
            const lowerRem = remaining.toLowerCase();
            const sIdx = lowerRem.indexOf(query);
            if (sIdx !== -1) {
              parts.push(remaining.substring(0, sIdx));
              parts.push(
                <mark 
                  key={`mark-${keyCounter++}`} 
                  style={{ background: '#fef08a', color: '#854d0e', padding: '0 2px', borderRadius: '3px', fontWeight: 600 }}
                >
                  {remaining.substring(sIdx, sIdx + query.length)}
                </mark>
              );
              remaining = remaining.substring(sIdx + query.length);
              continue;
            }
          }
          parts.push(remaining);
          break;
        }

        matches.sort((a, b) => a.index - b.index);
        const first = matches[0];

        if (first.index > 0) {
          parts.push(remaining.substring(0, first.index));
        }

        if (first.type === 'img') {
          const alt = first.match[1];
          const rawSrc = first.match[2];
          const src = resolveImageUrl(rawSrc);
          parts.push(
            <span 
              key={`img-${keyCounter++}`} 
              className="doc-img-container" 
              style={{ display: 'block', margin: '20px 0', textAlign: 'center' }}
            >
              <span
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  maxWidth: '100%',
                  cursor: 'zoom-in',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: '1px solid var(--border)',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.06)'
                }}
                onClick={() => setSelectedImage({ src, alt })}
                title="Clique para ampliar em alta definição"
              >
                <img 
                  src={src} 
                  alt={alt} 
                  loading="lazy"
                  style={{
                    maxWidth: '100%',
                    height: 'auto',
                    maxHeight: '520px',
                    objectFit: 'contain',
                    display: 'block'
                  }} 
                />
              </span>
              {alt && (
                <span style={{ 
                  display: 'block', 
                  fontSize: '11px', 
                  color: 'var(--text-secondary)', 
                  textAlign: 'center', 
                  marginTop: '8px',
                  fontWeight: 500
                }}>
                  📷 {alt}
                </span>
              )}
            </span>
          );
        } else if (first.type === 'link') {
          const linkText = first.match[1];
          const linkUrl = first.match[2];
          const isAnchor = linkUrl.startsWith('#');
          parts.push(
            <a
              key={`link-${keyCounter++}`}
              href={linkUrl}
              onClick={(e) => {
                if (isAnchor) {
                  e.preventDefault();
                  scrollToAnchor(linkUrl.substring(1));
                }
              }}
              target={isAnchor ? undefined : '_blank'}
              rel={isAnchor ? undefined : 'noreferrer noopener'}
              style={{
                color: '#2563eb',
                fontWeight: 600,
                textDecoration: 'underline',
                textUnderlineOffset: '2px'
              }}
            >
              {linkText}
              {!isAnchor && <ExternalLink size={11} style={{ display: 'inline', marginLeft: '3px', verticalAlign: 'middle' }} />}
            </a>
          );
        } else if (first.type === 'code') {
          parts.push(
            <code
              key={`code-${keyCounter++}`}
              style={{
                background: 'var(--surface-2, rgba(0,0,0,0.06))',
                color: 'var(--text)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '0.88em',
                fontFamily: 'monospace',
                border: '1px solid var(--border)'
              }}
            >
              {first.match[1]}
            </code>
          );
        } else if (first.type === 'bold') {
          parts.push(<strong key={`bold-${keyCounter++}`}>{first.match[1]}</strong>);
        } else if (first.type === 'italic') {
          parts.push(<em key={`italic-${keyCounter++}`}>{first.match[1]}</em>);
        }

        remaining = remaining.substring(first.index + first.match[0].length);
      }

      return parts;
    };

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // Bloco de código com ```
      if (trimmed.startsWith('```')) {
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        nodes.push(
          <div key={`codeblock-${i}`} style={{ margin: '16px 0', position: 'relative' }}>
            <pre style={{
              background: '#0f172a',
              color: '#f8fafc',
              padding: '16px',
              borderRadius: '8px',
              overflowX: 'auto',
              fontSize: '13px',
              fontFamily: 'monospace',
              lineHeight: 1.5,
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <code>{codeLines.join('\n')}</code>
            </pre>
          </div>
        );
        i++;
        continue;
      }

      // Tabela Markdown: | Coluna | Coluna |
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
          tableLines.push(lines[i].trim());
          i++;
        }

        if (tableLines.length >= 2) {
          const headerCols = tableLines[0].split('|').slice(1, -1).map(c => c.trim());
          const bodyRows = tableLines.slice(2).map(row => 
            row.split('|').slice(1, -1).map(c => c.trim())
          );

          nodes.push(
            <div key={`table-${i}`} style={{ overflowX: 'auto', margin: '20px 0' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '13px',
                textAlign: 'left',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid var(--border)'
              }}>
                <thead style={{ background: 'var(--surface-2, rgba(0,0,0,0.04))', borderBottom: '2px solid var(--border)' }}>
                  <tr>
                    {headerCols.map((h, colIdx) => (
                      <th key={colIdx} style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text)' }}>
                        {parseInline(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bodyRows.map((cols, rowIdx) => (
                    <tr 
                      key={rowIdx} 
                      style={{ 
                        borderBottom: '1px solid var(--border)',
                        background: rowIdx % 2 === 0 ? 'transparent' : 'var(--surface-2, rgba(0,0,0,0.015))' 
                      }}
                    >
                      {cols.map((col, colIdx) => (
                        <td key={colIdx} style={{ padding: '10px 14px', color: 'var(--text)' }}>
                          {parseInline(col)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          continue;
        }
      }

      // Linha horizontal ---
      if (trimmed === '---' || trimmed === '***') {
        nodes.push(
          <hr key={`hr-${i}`} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '24px 0' }} />
        );
        i++;
        continue;
      }

      // Imagem exclusiva na linha: ![alt](url)
      const blockImgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
      if (blockImgMatch) {
        const alt = blockImgMatch[1];
        const rawSrc = blockImgMatch[2];
        const src = resolveImageUrl(rawSrc);
        nodes.push(
          <figure
            key={`imgblock-${i}`}
            style={{
              margin: '28px 0',
              padding: '12px',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              background: 'var(--surface-2, rgba(0,0,0,0.02))',
              boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
              textAlign: 'center'
            }}
          >
            <div 
              style={{
                position: 'relative',
                display: 'inline-block',
                maxWidth: '100%',
                borderRadius: '8px',
                overflow: 'hidden',
                cursor: 'zoom-in',
                border: '1px solid var(--border)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
              }}
              onClick={() => setSelectedImage({ src, alt })}
              title="Clique para ampliar esta captura de tela em alta definição"
            >
              <img
                src={src}
                alt={alt}
                loading="lazy"
                style={{
                  maxWidth: '100%',
                  height: 'auto',
                  maxHeight: '540px',
                  objectFit: 'contain',
                  display: 'block',
                  background: 'var(--surface)'
                }}
              />
              <div style={{
                position: 'absolute',
                bottom: '10px',
                right: '10px',
                background: 'rgba(15, 23, 42, 0.78)',
                color: '#ffffff',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backdropFilter: 'blur(4px)'
              }}>
                <ZoomIn size={13} />
                <span>Ampliar</span>
              </div>
            </div>
            {alt && (
              <figcaption style={{
                marginTop: '10px',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-secondary, #64748b)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}>
                <span>📷</span>
                <span>{alt}</span>
                <span style={{ fontSize: '11px', opacity: 0.7, fontWeight: 400 }}>(clique na imagem para ampliar)</span>
              </figcaption>
            )}
          </figure>
        );
        i++;
        continue;
      }

      // Títulos #, ##, ###, ####
      if (trimmed.startsWith('#')) {
        const level = trimmed.indexOf(' ');
        if (level > 0 && level <= 4) {
          const headerText = trimmed.substring(level).trim();
          const cleanText = headerText.replace(/\*\*/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1');
          const id = slugify(cleanText);

          const headingProps = {
            id,
            style: {
              scrollMarginTop: '80px',
              marginTop: level === 1 ? '24px' : (level === 2 ? '36px' : '20px'),
              marginBottom: '12px',
              fontWeight: level === 1 ? 800 : (level === 2 ? 700 : 600),
              color: 'var(--text)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }
          };

          if (level === 1) {
            nodes.push(
              <h1 key={`h1-${i}`} {...headingProps} style={{ ...headingProps.style, fontSize: '24px', borderBottom: '2px solid var(--border)', paddingBottom: '8px' }}>
                {parseInline(headerText)}
              </h1>
            );
          } else if (level === 2) {
            nodes.push(
              <h2 key={`h2-${i}`} {...headingProps} style={{ ...headingProps.style, fontSize: '18px', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                <span style={{ color: '#2563eb' }}>§</span>
                {parseInline(headerText)}
              </h2>
            );
          } else if (level === 3) {
            nodes.push(
              <h3 key={`h3-${i}`} {...headingProps} style={{ ...headingProps.style, fontSize: '15px' }}>
                {parseInline(headerText)}
              </h3>
            );
          } else {
            nodes.push(
              <h4 key={`h4-${i}`} {...headingProps} style={{ ...headingProps.style, fontSize: '13px' }}>
                {parseInline(headerText)}
              </h4>
            );
          }
          i++;
          continue;
        }
      }

      // Blockquotes / Alertas: > texto
      if (trimmed.startsWith('>')) {
        const bqText = trimmed.substring(1).trim();
        const isAlert = bqText.toLowerCase().includes('atenção') || bqText.toLowerCase().includes('cuidado');
        const isTip = bqText.toLowerCase().includes('dica') || bqText.toLowerCase().includes('boa prática');

        nodes.push(
          <div
            key={`bq-${i}`}
            style={{
              margin: '16px 0',
              padding: '12px 16px',
              borderRadius: '8px',
              background: isAlert ? 'rgba(239, 68, 68, 0.08)' : (isTip ? 'rgba(16, 185, 129, 0.08)' : 'var(--surface-2, rgba(0,0,0,0.03))'),
              borderLeft: `4px solid ${isAlert ? '#ef4444' : (isTip ? '#10b981' : '#2563eb')}`,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px'
            }}
          >
            <div style={{ marginTop: '2px', color: isAlert ? '#ef4444' : (isTip ? '#10b981' : '#2563eb') }}>
              {isAlert ? <AlertTriangle size={18} /> : (isTip ? <Lightbulb size={18} /> : <Info size={18} />)}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.6 }}>
              {parseInline(bqText)}
            </div>
          </div>
        );
        i++;
        continue;
      }

      // Listas não-ordenadas: * ou -
      if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        const itemText = trimmed.substring(2).trim();
        nodes.push(
          <li 
            key={`li-${i}`} 
            style={{ 
              marginLeft: '20px', 
              marginBottom: '6px', 
              fontSize: '14px', 
              color: 'var(--text)',
              lineHeight: 1.6 
            }}
          >
            {parseInline(itemText)}
          </li>
        );
        i++;
        continue;
      }

      // Listas ordenadas: 1. 2. 3.
      const ordMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
      if (ordMatch) {
        nodes.push(
          <div 
            key={`oli-${i}`} 
            style={{ 
              display: 'flex', 
              alignItems: 'baseline', 
              gap: '8px', 
              marginBottom: '6px', 
              fontSize: '14px', 
              color: 'var(--text)', 
              lineHeight: 1.6 
            }}
          >
            <span style={{ fontWeight: 700, color: '#2563eb', fontSize: '13px' }}>{ordMatch[1]}.</span>
            <div>{parseInline(ordMatch[2])}</div>
          </div>
        );
        i++;
        continue;
      }

      // Linha vazia
      if (trimmed === '') {
        i++;
        continue;
      }

      // Parágrafo padrão
      nodes.push(
        <p key={`p-${i}`} style={{ fontSize: '14px', lineHeight: 1.7, margin: '8px 0', color: 'var(--text)' }}>
          {parseInline(trimmed)}
        </p>
      );
      i++;
    }

    return nodes;
  }, [content, searchTerm]);

  return (
    <div className="page" style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* Barra Superior de Navegação & Ações */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '16px 20px',
        background: 'var(--surface)',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        marginBottom: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {icon && (
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(37, 99, 235, 0.1)',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {icon}
            </div>
          )}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text)' }}>
                {title}
              </h1>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                background: 'var(--surface-2, rgba(0,0,0,0.06))',
                color: 'var(--text-secondary)',
                padding: '2px 8px',
                borderRadius: '6px',
                border: '1px solid var(--border)'
              }}>
                {version}
              </span>
            </div>
            {subtitle && (
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Ferramentas: Busca, Sumário, Copiar Link, Imprimir */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Campo de Busca Rápida no Documento */}
          <div style={{ position: 'relative', minWidth: '180px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="Buscar no texto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: '6px 10px 6px 30px',
                fontSize: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--surface-2, rgba(0,0,0,0.03))',
                color: 'var(--text)',
                width: '100%',
                outline: 'none'
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '6px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  fontSize: '11px'
                }}
              >
                ✕
              </button>
            )}
          </div>

          {tocList.length > 3 && (
            <button
              type="button"
              onClick={() => setShowToc(!showToc)}
              className="btn"
              style={{
                fontSize: '12px',
                padding: '6px 12px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: showToc ? 'rgba(37, 99, 235, 0.1)' : 'var(--surface)',
                color: showToc ? '#2563eb' : 'var(--text)',
                border: '1px solid var(--border)',
                cursor: 'pointer'
              }}
              title="Alternar Sumário"
            >
              <ListCollapse size={14} />
              <span>Sumário</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyLink}
            className="btn"
            style={{
              fontSize: '12px',
              padding: '6px 12px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'var(--surface)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              cursor: 'pointer'
            }}
            title="Copiar Link"
          >
            {copiedLink ? <Check size={14} style={{ color: '#10b981' }} /> : <Share2 size={14} />}
            <span>{copiedLink ? 'Copiado!' : 'Compartilhar'}</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="btn"
            style={{
              fontSize: '12px',
              padding: '6px 12px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'var(--surface)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              cursor: 'pointer'
            }}
            title="Imprimir Documento"
          >
            <Printer size={14} />
            <span>Imprimir</span>
          </button>

          {isPublic && onBackToApp && (
            <button
              type="button"
              onClick={onBackToApp}
              className="btn btn-primary"
              style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '8px' }}
            >
              Entrar no Sistema
            </button>
          )}
        </div>
      </div>

      {/* Layout com Sumário Lateral Opcional + Conteúdo */}
      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        {/* Sumário Navegável (TOC) */}
        {showToc && tocList.length > 3 && (
          <aside style={{
            width: '240px',
            flexShrink: 0,
            background: 'var(--surface)',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            padding: '16px',
            position: 'sticky',
            top: '20px',
            maxHeight: 'calc(100vh - 40px)',
            overflowY: 'auto',
            display: 'none'
          }} className="doc-toc-sidebar">
            <div style={{
              fontSize: '11px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: 'var(--text-secondary)',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <BookOpen size={13} />
              <span>Sumário do Documento</span>
            </div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {tocList.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollToAnchor(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    textAlign: 'left',
                    fontSize: item.level === 1 ? '12px' : '11px',
                    fontWeight: item.level === 1 ? 700 : 500,
                    padding: '5px 8px',
                    paddingLeft: `${(item.level - 1) * 12 + 8}px`,
                    borderRadius: '6px',
                    background: activeTocId === item.id ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                    color: activeTocId === item.id ? '#2563eb' : 'var(--text)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.1s ease',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                  title={item.title}
                >
                  <ChevronRight size={10} style={{ opacity: 0.5, flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</span>
                </button>
              ))}
            </nav>
          </aside>
        )}

        {/* Artigo Principal / Conteúdo Renderizado */}
        <main style={{
          flex: 1,
          minWidth: 0,
          background: 'var(--surface)',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          padding: '32px 40px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
        }}>
          {renderedElements}
        </main>
      </div>

      {/* Botão Flutuante Voltar ao Topo */}
      {showScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: '#2563eb',
            color: '#ffffff',
            border: 'none',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 90
          }}
          title="Voltar ao topo"
          aria-label="Voltar ao topo"
        >
          <ArrowUp size={18} />
        </button>
      )}

      {/* Estilo CSS embutido para responsividade do TOC */}
      <style>{`
        @media (min-width: 960px) {
          .doc-toc-sidebar {
            display: block !important;
          }
        }
        @media print {
          .sidebar, .doc-toc-sidebar, button, input {
            display: none !important;
          }
          .page {
            max-width: 100% !important;
            padding: 0 !important;
          }
        }
      `}</style>
      {/* Modal / Lightbox de Imagem Ampliada */}
      {selectedImage && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedImage(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            cursor: 'zoom-out'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            style={{ 
              position: 'relative', 
              maxWidth: '94vw', 
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              cursor: 'default'
            }}
          >
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              style={{
                position: 'absolute',
                top: '-42px',
                right: '0',
                background: 'rgba(255, 255, 255, 0.25)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              title="Fechar (Esc)"
            >
              <X size={20} />
            </button>
            <img
              src={selectedImage.src}
              alt={selectedImage.alt}
              style={{
                maxWidth: '100%',
                maxHeight: '82vh',
                objectFit: 'contain',
                borderRadius: '10px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                background: '#0f172a'
              }}
            />
            {selectedImage.alt && (
              <div style={{
                marginTop: '12px',
                color: '#f8fafc',
                fontSize: '13px',
                fontWeight: 600,
                textAlign: 'center',
                background: 'rgba(0, 0, 0, 0.5)',
                padding: '4px 16px',
                borderRadius: '20px',
                backdropFilter: 'blur(4px)'
              }}>
                {selectedImage.alt}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
