import React from 'react';

interface ClientSignatureValueProps {
  diary: any;
}

const formatCpf = (value?: string | null) => {
  const raw = (value || '').trim();
  if (!raw) return '';

  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 11) return raw;

  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

const normalizeName = (value?: string | null) => {
  const raw = (value || '').trim();
  if (!raw) return '';
  if (/assinatura externa/i.test(raw)) return '';
  return raw;
};

export const ClientSignatureValue: React.FC<ClientSignatureValueProps> = ({ diary }) => {
  const name = normalizeName(diary?.responsibleSignedBy || diary?.responsibleSignature);
  const signatureImage = (diary?.responsibleSignatureImage || '').trim();
  const cpf = formatCpf(diary?.responsibleCpf);

  return (
    <div className="flex min-h-[56px] flex-col justify-between gap-1">
      <span className="text-[8px] leading-tight">{name || '-'}</span>
      {signatureImage ? (
        <div className="h-12 flex items-center justify-center border border-gray-300 bg-white">
          <img
            src={signatureImage}
            alt="Assinatura Cliente"
            className="max-h-10 object-contain"
          />
        </div>
      ) : (
        <div className="w-full min-h-[24px] flex items-end">
          <span className="block w-full border-b border-gray-400"></span>
        </div>
      )}
      <span className="text-[7px] leading-tight">CPF: {cpf || '-'}</span>
    </div>
  );
};
