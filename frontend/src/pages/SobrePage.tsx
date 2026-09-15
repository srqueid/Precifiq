import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Info } from 'lucide-react';
import { MarkdownDocViewer } from '../components/MarkdownDocViewer';
import { sobreMarkdown } from '../docs/sobreData';

interface SobrePageProps {
  isPublic?: boolean;
}

export const SobrePage: React.FC<SobrePageProps> = ({ isPublic = false }) => {
  const navigate = useNavigate();

  return (
    <MarkdownDocViewer
      content={sobreMarkdown}
      title="Sobre o Precifiq"
      subtitle="Conceito, arquitetura tecnológica, diferenciais e canais de suporte da DcSys"
      icon={<Info size={22} />}
      version="v0.1.0"
      isPublic={isPublic}
      onBackToApp={() => navigate('/login')}
    />
  );
};

export default SobrePage;
