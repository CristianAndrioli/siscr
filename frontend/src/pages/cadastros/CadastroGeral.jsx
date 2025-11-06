import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { pessoasService } from '../../services/cadastros/pessoas';
import { Input, Select, Textarea, Button, Alert } from '../../components/common';
import { useForm } from '../../hooks/useForm';
import { formatCPFCNPJ, formatCEP, formatPhone } from '../../utils/formatters';
import { formatApiError } from '../../utils/helpers';
import { ESTADOS, TIPO_CADASTRO, TIPO_PESSOA } from '../../utils/constants';

function CadastroGeral() {
  const navigate = useNavigate();
  const { codigo } = useParams();
  const editando = !!codigo;

  const initialValues = {
    codigo_cadastro: '',
    tipo: 'cliente',
    tipo_classificacao: 'PF',
    cpf_cnpj: '',
    nome_completo: '',
    razao_social: '',
    nome_fantasia: '',
    contribuinte: true,
    inscricao_estadual: '',
    cep: '',
    logradouro: '',
    numero: '',
    letra: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: 'SC',
    nome_contato: '',
    telefone_fixo: '',
    telefone_celular: '',
    email: '',
    cargo: '',
    comissoes: '0.00',
    observacoes: '',
  };

  const { formData, handleChange, setFormData, resetForm } = useForm(initialValues);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editando) {
      carregarDados();
    } else {
      carregarProximoCodigo();
    }
  }, [codigo]);

  const carregarProximoCodigo = async () => {
    try {
      const response = await pessoasService.proximoCodigo();
      setFormData((prev) => ({ ...prev, codigo_cadastro: response.proximo_codigo || 'NOVO' }));
    } catch (err) {
      console.error('Erro ao carregar próximo código:', err);
    }
  };

  const carregarDados = async () => {
    try {
      setLoading(true);
      const dados = await pessoasService.buscar(codigo);
      setFormData({
        ...dados,
        tipo_classificacao: dados.tipo === 'PF' ? 'PF' : 'PJ',
      });
    } catch (err) {
      setError('Erro ao carregar dados do cadastro');
    } finally {
      setLoading(false);
    }
  };

  // Formatação automática de campos
  const handleFormattedChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value;

    // Formatação automática
    if (name === 'cpf_cnpj') {
      formattedValue = formatCPFCNPJ(value);
    } else if (name === 'cep') {
      formattedValue = formatCEP(value);
    } else if (name === 'telefone_fixo' || name === 'telefone_celular') {
      formattedValue = formatPhone(value);
    }

    handleChange({ target: { ...e.target, value: formattedValue } });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (editando) {
        await pessoasService.atualizar(codigo, formData);
      } else {
        await pessoasService.criar(formData);
      }
      navigate('/cadastros/geral/lista');
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const limparFormulario = () => {
    resetForm(initialValues);
    carregarProximoCodigo();
  };

  // Determina quais campos mostrar baseado no tipo e classificação
  const mostrarNomeCompleto = formData.tipo === 'funcionario' || formData.tipo_classificacao === 'PF';
  const mostrarRazaoSocial = formData.tipo_classificacao === 'PJ' && formData.tipo !== 'funcionario';
  const mostrarContribuinte = formData.tipo_classificacao === 'PJ' && formData.tipo !== 'funcionario';
  const mostrarInscricaoEstadual = formData.tipo_classificacao === 'PJ' && formData.contribuinte && formData.tipo !== 'funcionario';

  if (loading && editando) {
    return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  }

  return (
    <div className="bg-white p-8 rounded-xl shadow-2xl transition-all duration-300">
      <h2 className="text-3xl font-extrabold text-gray-800 mb-6 border-b-2 border-indigo-600 pb-2">
        Cadastro Geral de Pessoas
      </h2>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Informações Básicas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="col-span-1">
            <Input
              label="Código"
              name="codigo_cadastro"
              value={formData.codigo_cadastro}
              readOnly
            />
            <p className="text-xs text-gray-500 mt-1">Gerado automaticamente.</p>
          </div>

          <Select
            label="Tipo de Cadastro"
            name="tipo"
            value={formData.tipo}
            onChange={handleChange}
            options={TIPO_CADASTRO}
            className="col-span-1"
          />

          {formData.tipo !== 'funcionario' && (
            <Select
              label="Classificação"
              name="tipo_classificacao"
              value={formData.tipo_classificacao}
              onChange={handleChange}
              options={TIPO_PESSOA}
              className="col-span-1"
            />
          )}

          <Input
            label="CPF/CNPJ"
            name="cpf_cnpj"
            value={formData.cpf_cnpj}
            onChange={handleFormattedChange}
            className="col-span-1"
          />

          {mostrarNomeCompleto && (
            <Input
              label="Nome Completo"
              name="nome_completo"
              value={formData.nome_completo}
              onChange={handleChange}
              className="col-span-4"
              required
            />
          )}

          {mostrarRazaoSocial && (
            <>
              <Input
                label="Razão Social"
                name="razao_social"
                value={formData.razao_social}
                onChange={handleChange}
                className="col-span-2"
                required
              />
              <Input
                label="Nome Fantasia"
                name="nome_fantasia"
                value={formData.nome_fantasia}
                onChange={handleChange}
                className="col-span-2"
              />
            </>
          )}

          {mostrarContribuinte && (
            <div className="col-span-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Contribuinte ICMS?</label>
              <div className="flex space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    name="contribuinte"
                    value="true"
                    checked={formData.contribuinte === true}
                    onChange={() => setFormData((prev) => ({ ...prev, contribuinte: true }))}
                    className="form-radio text-indigo-600"
                  />
                  <span className="ml-2 text-gray-700">Sim</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    name="contribuinte"
                    value="false"
                    checked={formData.contribuinte === false}
                    onChange={() => setFormData((prev) => ({ ...prev, contribuinte: false }))}
                    className="form-radio text-indigo-600"
                  />
                  <span className="ml-2 text-gray-700">Não</span>
                </label>
              </div>
            </div>
          )}

          {mostrarInscricaoEstadual && (
            <Input
              label="Inscrição Estadual"
              name="inscricao_estadual"
              value={formData.inscricao_estadual}
              onChange={handleChange}
              className="col-span-4"
            />
          )}
        </div>

        {/* Endereço */}
        <div className="border-t border-gray-200 pt-6 mt-6">
          <h3 className="text-2xl font-semibold text-gray-800 mb-4">Endereço</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Input
              label="CEP"
              name="cep"
              value={formData.cep}
              onChange={handleFormattedChange}
              className="col-span-4 md:col-span-1"
            />
            <Input
              label="Logradouro"
              name="logradouro"
              value={formData.logradouro}
              onChange={handleChange}
              className="col-span-4 md:col-span-3"
              required
            />
            <Input
              label="Número"
              name="numero"
              value={formData.numero}
              onChange={handleChange}
              className="col-span-1"
              required
            />
            <Input
              label="Letra"
              name="letra"
              value={formData.letra}
              onChange={handleChange}
              className="col-span-1"
            />
            <Input
              label="Complemento"
              name="complemento"
              value={formData.complemento}
              onChange={handleChange}
              className="col-span-2"
            />
            <Input
              label="Bairro"
              name="bairro"
              value={formData.bairro}
              onChange={handleChange}
              className="col-span-2"
              required
            />
            <Input
              label="Cidade"
              name="cidade"
              value={formData.cidade}
              onChange={handleChange}
              className="col-span-2 md:col-span-1"
              required
            />
            <Select
              label="Estado (UF)"
              name="estado"
              value={formData.estado}
              onChange={handleChange}
              options={ESTADOS}
              className="col-span-2 md:col-span-1"
              required
            />
          </div>
        </div>

        {/* Contato e Comercial */}
        <div className="border-t border-gray-200 pt-6 mt-6">
          <h3 className="text-2xl font-semibold text-gray-800 mb-4">Contato e Comercial</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Input
              label="Nome do Contato"
              name="nome_contato"
              value={formData.nome_contato}
              onChange={handleChange}
              className="col-span-4 md:col-span-2"
            />
            <Input
              label="Telefone Fixo"
              name="telefone_fixo"
              value={formData.telefone_fixo}
              onChange={handleFormattedChange}
              className="col-span-2"
            />
            <Input
              label="Celular"
              name="telefone_celular"
              value={formData.telefone_celular}
              onChange={handleFormattedChange}
              className="col-span-2"
            />
            <Input
              label="Email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              className="col-span-4 md:col-span-2"
            />
            <Input
              label="Cargo"
              name="cargo"
              value={formData.cargo}
              onChange={handleChange}
              className="col-span-2"
            />
            <Input
              label="Comissão (%)"
              name="comissoes"
              type="number"
              value={formData.comissoes}
              onChange={handleChange}
              step="0.01"
              className="col-span-2"
            />
          </div>
        </div>

        {/* Observações */}
        <div className="border-t border-gray-200 pt-6 mt-6">
          <h3 className="text-2xl font-semibold text-gray-800 mb-4">Observações</h3>
          <Textarea
            label="Detalhes Adicionais"
            name="observacoes"
            value={formData.observacoes}
            onChange={handleChange}
            rows={4}
            className="col-span-4"
          />
        </div>

        {/* Botões */}
        <div className="mt-8 pt-4 border-t border-gray-200 flex justify-start space-x-4">
          <Button type="submit" loading={loading} variant="primary">
            Salvar Cadastro
          </Button>
          <Button type="button" onClick={() => navigate(-1)} variant="secondary">
            Voltar
          </Button>
          {!editando && (
            <Button type="button" onClick={limparFormulario} variant="danger">
              Limpar
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

export default CadastroGeral;
