import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { FuncionalidadeKey, CATALOGO_FUNCIONALIDADES } from '../types/permissoes';

export interface UsePermissionsResult {
  hasPermission: (key: FuncionalidadeKey | string) => boolean;
  canAccessRoute: (pathname: string) => boolean;
  userPermissions: string[];
  isSuperuser: boolean;
  perfilNome: string;
  perfilCodigo: string;
}

export function usePermissions(): UsePermissionsResult {
  const { user, isSuperuser } = useAuth();
  const { activeCompany } = useTenant();

  return useMemo(() => {
    // 1. Se for Superusuário do sistema, tem acesso irrestrito a todas as funcionalidades
    if (isSuperuser || user?.isSuperuser) {
      return {
        hasPermission: () => true,
        canAccessRoute: () => true,
        userPermissions: CATALOGO_FUNCIONALIDADES.map(f => f.key),
        isSuperuser: true,
        perfilNome: 'Superusuário DcSys',
        perfilCodigo: 'SUPERUSER'
      };
    }

    // 2. Obter o vínculo do usuário com a empresa ativa selecionada no switcher
    const vinculo = user?.empresas?.find(e => e.empresaId === activeCompany?.id) || user?.empresas?.[0];
    const perfilNome = vinculo?.perfilNome || 'Operador';
    const perfilCodigo = vinculo?.perfilCodigo || 'OPERADOR';
    const permissoesRaw = vinculo?.permissoes || '';

    // Se o perfil for Administrador Global/Matriz padrão sem restrições explícitas
    const upperRaw = permissoesRaw.toUpperCase();
    const hasTotalAccess = 
      upperRaw.includes('GLOBAL_ALL') || 
      upperRaw.includes('MATRIZ_ALL') || 
      upperRaw.includes('*') || 
      upperRaw.includes('ALL') ||
      (perfilCodigo === 'ADMIN' && !permissoesRaw);

    if (hasTotalAccess) {
      return {
        hasPermission: () => true,
        canAccessRoute: (path: string) => {
          // Rotas exclusivas de superusuário continuam restritas
          if (path === '/superadmin' || path === '/gestao-global') return false;
          return true;
        },
        userPermissions: CATALOGO_FUNCIONALIDADES.map(f => f.key),
        isSuperuser: false,
        perfilNome,
        perfilCodigo
      };
    }

    // 3. Parser de permissões selecionadas
    const permsSet = new Set<string>(
      permissoesRaw
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean)
    );

    // Se não tiver nenhuma permissão definida (ex: perfil novo em branco), por segurança concede ao menos dashboard
    if (permsSet.size === 0) {
      permsSet.add('dashboard');
    }

    const hasPermission = (key: FuncionalidadeKey | string): boolean => {
      const lowerKey = key.toLowerCase();
      return permsSet.has(lowerKey);
    };

    const canAccessRoute = (pathname: string): boolean => {
      // Rotas de superusuário
      if (pathname === '/superadmin' || pathname === '/gestao-global') {
        return false;
      }

      // Rotas padrão do sistema mapeadas para funcionalidades
      if (pathname === '/' || pathname === '/dashboard') return hasPermission('dashboard');
      if (pathname.startsWith('/pedido')) return hasPermission('pedidos_clientes');
      if (pathname.startsWith('/produtos')) return hasPermission('produtos');
      if (pathname.startsWith('/kits')) return hasPermission('kits');
      if (pathname.startsWith('/estoque')) return hasPermission('estoque_produtos');
      if (pathname.startsWith('/insumos')) return hasPermission('insumos');
      if (pathname.startsWith('/pedidos') || pathname.startsWith('/pedido-compra')) return hasPermission('pedidos_compra');
      if (pathname.startsWith('/compras')) return hasPermission('compras');
      if (pathname.startsWith('/fornecedores')) return hasPermission('fornecedores');
      if (pathname.startsWith('/orcamentos')) return hasPermission('orcamentos');
      if (pathname.startsWith('/unidades')) return hasPermission('unidades_medida');
      if (pathname.startsWith('/configuracoes')) return hasPermission('configuracoes');

      return true;
    };

    return {
      hasPermission,
      canAccessRoute,
      userPermissions: Array.from(permsSet),
      isSuperuser: false,
      perfilNome,
      perfilCodigo
    };
  }, [isSuperuser, user, activeCompany?.id]);
}
