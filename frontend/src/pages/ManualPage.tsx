import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { MarkdownDocViewer } from '../components/MarkdownDocViewer';
import { manualMarkdown } from '../docs/manualData';

interface ManualPageProps {
  isPublic?: boolean;
}

export const ManualPage: React.FC<ManualPageProps> = ({ isPublic = false }) => {
  const navigate = useNavigate();

  return (
    <MarkdownDocViewer
      content={manualMarkdown}
      title="Manual de Utilização"
      subtitle="Guia completo de funções, boas práticas e fluxo operacional do sistema Precifiq"
      icon={<BookOpen size={22} />}
      version="v0.1.0"
      isPublic={isPublic}
      onBackToApp={() => navigate('/login')}
    />
  );
};

export default ManualPage;
