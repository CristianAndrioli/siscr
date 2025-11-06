/**
 * Hook customizado para validação de formulários
 * @param {object} validationRules - Regras de validação { campo: [regras] }
 * @returns {object} - { errors, validate, validateField, clearErrors }
 */
import { useState } from 'react';

export function useValidation(validationRules = {}) {
  const [errors, setErrors] = useState({});

  const validateField = (fieldName, value, formData = {}) => {
    const rules = validationRules[fieldName];
    if (!rules) return null;

    for (const rule of rules) {
      const error = rule(value, formData);
      if (error) {
        setErrors((prev) => ({ ...prev, [fieldName]: error }));
        return error;
      }
    }

    // Limpa erro se passou todas as validações
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
    return null;
  };

  const validate = (formData) => {
    const newErrors = {};
    
    Object.keys(validationRules).forEach((fieldName) => {
      const error = validateField(fieldName, formData[fieldName], formData);
      if (error) {
        newErrors[fieldName] = error;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const clearErrors = (fieldName = null) => {
    if (fieldName) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    } else {
      setErrors({});
    }
  };

  return {
    errors,
    validate,
    validateField,
    clearErrors,
  };
}

