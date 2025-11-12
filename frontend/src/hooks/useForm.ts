/**
 * Hook customizado para gerenciar formulários
 */
import { useState, ChangeEvent } from 'react';

interface UseFormReturn<T> {
  formData: T;
  handleChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  setFormData: React.Dispatch<React.SetStateAction<T>>;
  setFieldValue: (name: keyof T, value: unknown) => void;
  resetForm: (newValues?: T) => void;
}

export function useForm<T extends Record<string, unknown>>(
  initialValues: T
): UseFormReturn<T> {
  const [formData, setFormData] = useState<T>(initialValues);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): void => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const setFieldValue = (name: keyof T, value: unknown): void => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetForm = (newValues: T = initialValues): void => {
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

