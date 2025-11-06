/**
 * Hook customizado para gerenciar formulários
 * @param {object} initialValues - Valores iniciais do formulário
 * @returns {object} - { formData, handleChange, setFormData, resetForm }
 */
import { useState } from 'react';

export function useForm(initialValues = {}) {
  const [formData, setFormData] = useState(initialValues);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const setFieldValue = (name, value) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetForm = (newValues = initialValues) => {
    setFormData(newValues);
  };

  return {
    formData,
    handleChange,
    setFormData,
    setFieldValue,
    resetForm,
  };
}

