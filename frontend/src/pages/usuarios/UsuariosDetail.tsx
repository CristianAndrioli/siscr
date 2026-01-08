import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { usuariosService, usuariosServiceHelpers, type Usuario } from '../../services/accounts/usuarios';
import { DetailView, RelatedRecords, Alert } from '../../components/common';
import { useGridColumns } from '../../hooks/useGridColumns';
import type { Tab } from '../../components/common/Tabs';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  user: 'Usuário',
  viewer: 'Visualizador',
};

/**
 * Componente para visualizar detalhes de um usuário com abas estilo Salesforce
 */
export default function UsuariosDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const carregarDados = useCallback(async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      setError('');
      const dados = await usuariosService.get(id);
      setUsuario(dados);
    } catch (err) {
      console.error('Erro ao carregar dados do usuário:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados do usuário');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      carregarDados();
    }
  }, [id, carregarDados]);

  const handleEdit = () => {
    navigate(`/usuarios/${id}?edit=true`);
  };

  const handleDelete = async () => {
    if (!id || !window.confirm('Tem certeza que deseja excluir este usuário?')) {
      return;
    }
    try {
      await usuariosService.delete(id);
      navigate('/usuarios');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir usuário');
    }
  };

  const handleBack = () => {
    navigate('/usuarios');
  };

  if (!usuario && !loading) {
    return (
      <div className="bg-white p-8 rounded-xl shadow-2xl">
        <Alert type="error" message="Usuário não encontrado" />
        <button onClick={handleBack} className="mt-4 text-indigo-600 hover:text-indigo-800">
          Voltar para lista
        </button>
      </div>
    );
  }

  // Preparar dados para a aba de detalhamento
  const detailFields = usuario ? [
    { label: 'ID', value: usuario.id },
    { label: 'Nome de Usuário', value: usuario.username },
    { label: 'E-mail', value: usuario.email },
    { label: 'Nome', value: usuario.first_name || '-' },
    { label: 'Sobrenome', value: usuario.last_name || '-' },
    { label: 'Status', value: usuario.is_active ? 'Ativo' : 'Inativo' },
    { label: 'Papel (Role)', value: usuario.role ? ROLE_LABELS[usuario.role] || usuario.role : '-' },
    { label: 'Data de Cadastro', value: usuario.date_joined ? new Date(usuario.date_joined).toLocaleDateString('pt-BR') : '-' },
    { label: 'Último Login', value: usuario.last_login ? new Date(usuario.last_login).toLocaleDateString('pt-BR') : 'Nunca' },
  ] : [];

  // Preparar dados para a aba de relacionados
  // Por enquanto, vamos mostrar o TenantMembership como relacionado
  // Futuramente podemos adicionar roles customizados se houver relação
  const relatedMemberships = usuario?.membership ? [{
    ...usuario.membership,
    // Adicionar um ID único para navegação (usar o ID do usuário já que membership não tem navegação própria)
    _id: usuario.id,
  }] : [];
  
  const membershipColumns = useGridColumns(relatedMemberships.length > 0 ? relatedMemberships : [], {
    autoConfig: {
      hiddenFields: ['id', '_id'],
      fieldOverrides: {
        role: {
          label: 'Papel',
          render: (value) => ROLE_LABELS[value as string] || value,
        },
        role_display: {
          label: 'Papel (Display)',
        },
        is_active: {
          label: 'Ativo',
          render: (value) => value ? (
            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Sim</span>
          ) : (
            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Não</span>
          ),
        },
        joined_at: {
          label: 'Entrou em',
          render: (value) => value ? new Date(value as string).toLocaleDateString('pt-BR') : '-',
        },
      },
    },
  });

  const tabs: Tab[] = [
    {
      id: 'detalhamento',
      label: 'Detalhamento',
      content: (
        <div className="space-y-6">
          {error && <Alert type="error" message={error} onClose={() => setError('')} />}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {detailFields.map((field, index) => (
              <div key={index} className="border-b border-gray-200 pb-2">
                <label className="text-sm font-medium text-gray-500">{field.label}</label>
                <p className="mt-1 text-sm text-gray-900">{field.value}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 'relacionados',
      label: 'Relacionados',
      count: relatedMemberships.length,
      content: (
        <div className="space-y-6">
          <RelatedRecords
            title="Memberships do Tenant"
            records={relatedMemberships}
            columns={membershipColumns}
            basePath="/usuarios"
            getRecordId={(record) => (record as { _id: number })._id || (record as { id: number }).id}
            emptyMessage="Nenhum membership encontrado."
          />
        </div>
      ),
    },
  ];

  return (
    <DetailView
      title={usuario ? `${usuario.first_name || ''} ${usuario.last_name || ''}`.trim() || usuario.username : 'Usuário'}
      subtitle={usuario?.email}
      tabs={tabs}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onBack={handleBack}
      loading={loading}
    />
  );
}

