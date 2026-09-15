import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { MarkdownDocViewer } from '../components/MarkdownDocViewer';
import { privacidadeMarkdown } from '../docs/privacidadeData';

interface PrivacidadePageProps {
  isPublic?: boolean;
}

export const PrivacidadePage: React.FC<PrivacidadePageProps> = ({ isPublic = false }) => {
  const navigate = useNavigate();

  return (
    <MarkdownDocViewer
      content={privacidadeMarkdown}
      title="Política de Privacidade"
      subtitle="Compromisso de conformidade com a LGPD, segurança e proteção de dados da DCSys"
      icon={<Shield size={22} />}
      version="LGPD (Lei nº 13.709/2018)"
      isPublic={isPublic}
      onBackToApp={() => navigate('/login')}
    />
  );
};

export default PrivacidadePage;
