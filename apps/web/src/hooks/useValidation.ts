/**
 * Hook customizado para validação de formulários
 */
import { useState } from 'react';

type ValidationRule<T = unknown> = (value: unknown, formData?: T) => string | null;

interface ValidationRules<T = unknown> {
  [fieldName: string]: ValidationRule<T>[];
}

interface UseValidationReturn {
  errors: Record<string, string>;
  validate: <T extends Record<string, unknown>>(formData: T) => boolean;
  validateField: <T extends Record<string, unknown>>(
    fieldName: string,
    value: unknown,
    formData?: T
  ) => string | null;
  clearErrors: (fieldName?: string) => void;
}

export function useValidation<T extends Record<string, unknown> = Record<string, unknown>>(
  validationRules: ValidationRules<T> = {}
): UseValidationReturn {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateField = <F extends Record<string, unknown>>(
    fieldName: string,
    value: unknown,
    formData: F = {} as F
  ): string | null => {
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

  const validate = <F extends Record<string, unknown>>(formData: F): boolean => {
    const newErrors: Record<string, string> = {};
    
    Object.keys(validationRules).forEach((fieldName) => {
      const error = validateField(fieldName, formData[fieldName], formData);
      if (error) {
        newErrors[fieldName] = error;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const clearErrors = (fieldName?: string): void => {
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

