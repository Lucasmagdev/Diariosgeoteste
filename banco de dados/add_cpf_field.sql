-- Script para adicionar campo de CPF na tabela profiles
-- Execute no SQL Editor do Supabase

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS cpf text;

-- Limpar valores vazios para manter consistencia
UPDATE public.profiles
SET cpf = NULL
WHERE cpf IS NOT NULL
  AND btrim(cpf) = '';
