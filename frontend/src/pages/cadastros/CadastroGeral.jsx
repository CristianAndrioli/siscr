import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { pessoasService } from '../../services/pessoas';

function CadastroGeral() {
  const navigate = useNavigate();
  const { codigo } = useParams();
  const editando = !!codigo;

  const [formData, setFormData] = useState({
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
  });

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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
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
      setError(err.response?.data?.detail || 'Erro ao salvar cadastro');
    } finally {
      setLoading(false);
    }
  };

  const limparFormulario = () => {
    setFormData({
      ...formData,
      codigo_cadastro: '',
      cpf_cnpj: '',
      nome_completo: '',
      razao_social: '',
      nome_fantasia: '',
      inscricao_estadual: '',
      cep: '',
      logradouro: '',
      numero: '',
      letra: '',
      complemento: '',
      bairro: '',
      cidade: '',
      nome_contato: '',
      telefone_fixo: '',
      telefone_celular: '',
      email: '',
      cargo: '',
      comissoes: '0.00',
      observacoes: '',
    });
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

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md" role="alert">
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Informações Básicas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="col-span-1">
            <label htmlFor="codigo_cadastro" className="block text-sm font-medium text-gray-700">
              Código
            </label>
            <input
              type="text"
              id="codigo_cadastro"
              name="codigo_cadastro"
              value={formData.codigo_cadastro}
              readOnly
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-gray-100 p-2"
            />
            <p className="text-xs text-gray-500 mt-1">Gerado automaticamente.</p>
          </div>

          <div className="col-span-1">
            <label htmlFor="tipo" className="block text-sm font-medium text-gray-700">
              Tipo de Cadastro
            </label>
            <select
              id="tipo"
              name="tipo"
              value={formData.tipo}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
            >
              <option value="cliente">Cliente</option>
              <option value="fornecedor">Fornecedor</option>
              <option value="funcionario">Funcionário</option>
            </select>
          </div>

          {formData.tipo !== 'funcionario' && (
            <div className="col-span-1" id="div_tipo_classificacao">
              <label htmlFor="tipo_classificacao" className="block text-sm font-medium text-gray-700">
                Classificação
              </label>
              <select
                id="tipo_classificacao"
                name="tipo_classificacao"
                value={formData.tipo_classificacao}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
              >
                <option value="PF">Pessoa Física (PF)</option>
                <option value="PJ">Pessoa Jurídica (PJ)</option>
              </select>
            </div>
          )}

          <div className="col-span-1">
            <label htmlFor="cpf_cnpj" className="block text-sm font-medium text-gray-700">
              CPF/CNPJ
            </label>
            <input
              type="text"
              id="cpf_cnpj"
              name="cpf_cnpj"
              value={formData.cpf_cnpj}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
            />
          </div>

          {mostrarNomeCompleto && (
            <div className="col-span-4">
              <label htmlFor="nome_completo" className="block text-sm font-medium text-gray-700">
                Nome Completo
              </label>
              <input
                type="text"
                id="nome_completo"
                name="nome_completo"
                value={formData.nome_completo}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
              />
            </div>
          )}

          {mostrarRazaoSocial && (
            <>
              <div className="col-span-2">
                <label htmlFor="razao_social" className="block text-sm font-medium text-gray-700">
                  Razão Social
                </label>
                <input
                  type="text"
                  id="razao_social"
                  name="razao_social"
                  value={formData.razao_social}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                />
              </div>
              <div className="col-span-2">
                <label htmlFor="nome_fantasia" className="block text-sm font-medium text-gray-700">
                  Nome Fantasia
                </label>
                <input
                  type="text"
                  id="nome_fantasia"
                  name="nome_fantasia"
                  value={formData.nome_fantasia}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                />
              </div>
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
            <div className="col-span-4">
              <label htmlFor="inscricao_estadual" className="block text-sm font-medium text-gray-700">
                Inscrição Estadual
              </label>
              <input
                type="text"
                id="inscricao_estadual"
                name="inscricao_estadual"
                value={formData.inscricao_estadual}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
              />
            </div>
          )}
        </div>

        {/* Endereço */}
        <div className="border-t border-gray-200 pt-6 mt-6">
          <h3 className="text-2xl font-semibold text-gray-800 mb-4">Endereço</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="col-span-4 md:col-span-1">
              <label htmlFor="cep" className="block text-sm font-medium text-gray-700">CEP</label>
              <input
                type="text"
                id="cep"
                name="cep"
                value={formData.cep}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
              />
            </div>
            <div className="col-span-4 md:col-span-3">
              <label htmlFor="logradouro" className="block text-sm font-medium text-gray-700">Logradouro</label>
              <input
                type="text"
                id="logradouro"
                name="logradouro"
                value={formData.logradouro}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
              />
            </div>

            <div className="col-span-1">
              <label htmlFor="numero" className="block text-sm font-medium text-gray-700">Número</label>
              <input
                type="text"
                id="numero"
                name="numero"
                value={formData.numero}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
              />
            </div>
            <div className="col-span-1">
              <label htmlFor="letra" className="block text-sm font-medium text-gray-700">Letra</label>
              <input
                type="text"
                id="letra"
                name="letra"
                value={formData.letra}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
              />
            </div>
            <div className="col-span-2">
              <label htmlFor="complemento" className="block text-sm font-medium text-gray-700">Complemento</label>
              <input
                type="text"
                id="complemento"
                name="complemento"
                value={formData.complemento}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
              />
            </div>

            <div className="col-span-2">
              <label htmlFor="bairro" className="block text-sm font-medium text-gray-700">Bairro</label>
              <input
                type="text"
                id="bairro"
                name="bairro"
                value={formData.bairro}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
              />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label htmlFor="cidade" className="block text-sm font-medium text-gray-700">Cidade</label>
              <input
                type="text"
                id="cidade"
                name="cidade"
                value={formData.cidade}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
              />
            </div>

            <div className="col-span-2 md:col-span-1">
              <label htmlFor="estado" className="block text-sm font-medium text-gray-700">Estado (UF)</label>
              <select
                id="estado"
                name="estado"
                value={formData.estado}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
              >
                <option value="AC">Acre</option>
                <option value="AL">Alagoas</option>
                <option value="AP">Amapá</option>
                <option value="AM">Amazonas</option>
                <option value="BA">Bahia</option>
                <option value="CE">Ceará</option>
                <option value="DF">Distrito Federal</option>
                <option value="ES">Espírito Santo</option>
                <option value="GO">Goiás</option>
                <option value="MA">Maranhão</option>
                <option value="MT">Mato Grosso</option>
                <option value="MS">Mato Grosso do Sul</option>
                <option value="MG">Minas Gerais</option>
                <option value="PA">Pará</option>
                <option value="PB">Paraíba</option>
                <option value="PR">Paraná</option>
                <option value="PE">Pernambuco</option>
                <option value="PI">Piauí</option>
                <option value="RJ">Rio de Janeiro</option>
                <option value="RN">Rio Grande do Norte</option>
                <option value="RS">Rio Grande do Sul</option>
                <option value="RO">Rondônia</option>
                <option value="RR">Roraima</option>
                <option value="SC">Santa Catarina</option>
                <option value="SP">São Paulo</option>
                <option value="SE">Sergipe</option>
                <option value="TO">Tocantins</option>
              </select>
            </div>
          </div>
        </div>

        {/* Contato e Comercial */}
        <div className="border-t border-gray-200 pt-6 mt-6">
          <h3 className="text-2xl font-semibold text-gray-800 mb-4">Contato e Comercial</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="col-span-4 md:col-span-2">
              <label htmlFor="nome_contato" className="block text-sm font-medium text-gray-700">Nome do Contato</label>
              <input
                type="text"
                id="nome_contato"
                name="nome_contato"
                value={formData.nome_contato}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
              />
            </div>
            <div className="col-span-2">
              <label htmlFor="telefone_fixo" className="block text-sm font-medium text-gray-700">Telefone Fixo</label>
              <input
                type="text"
                id="telefone_fixo"
                name="telefone_fixo"
                value={formData.telefone_fixo}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
              />
            </div>
            <div className="col-span-2">
              <label htmlFor="telefone_celular" className="block text-sm font-medium text-gray-700">Celular</label>
              <input
                type="text"
                id="telefone_celular"
                name="telefone_celular"
                value={formData.telefone_celular}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
              />
            </div>
            <div className="col-span-4 md:col-span-2">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
              />
            </div>
            <div className="col-span-2">
              <label htmlFor="cargo" className="block text-sm font-medium text-gray-700">Cargo</label>
              <input
                type="text"
                id="cargo"
                name="cargo"
                value={formData.cargo}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
              />
            </div>
            <div className="col-span-2">
              <label htmlFor="comissoes" className="block text-sm font-medium text-gray-700">Comissão (%)</label>
              <input
                type="number"
                id="comissoes"
                name="comissoes"
                value={formData.comissoes}
                onChange={handleChange}
                step="0.01"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
              />
            </div>
          </div>
        </div>

        {/* Observações */}
        <div className="border-t border-gray-200 pt-6 mt-6">
          <h3 className="text-2xl font-semibold text-gray-800 mb-4">Observações</h3>
          <div className="col-span-4">
            <label htmlFor="observacoes" className="block text-sm font-medium text-gray-700">Detalhes Adicionais</label>
            <textarea
              id="observacoes"
              name="observacoes"
              value={formData.observacoes}
              onChange={handleChange}
              rows="4"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
            />
          </div>
        </div>

        {/* Botões */}
        <div className="mt-8 pt-4 border-t border-gray-200 flex justify-start space-x-4">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition duration-300 disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Salvar Cadastro'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-6 py-2 bg-gray-300 text-gray-800 font-semibold rounded-lg shadow-md hover:bg-gray-400 transition duration-300"
          >
            Voltar
          </button>
          {!editando && (
            <button
              type="button"
              onClick={limparFormulario}
              className="px-6 py-2 bg-red-500 text-white font-semibold rounded-lg shadow-md hover:bg-red-600 transition duration-300"
            >
              Limpar
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export default CadastroGeral;

