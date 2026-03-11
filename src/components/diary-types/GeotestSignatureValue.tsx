import React from 'react';

interface GeotestSignatureValueProps {
  diary: any;
}

const formatCpf = (value?: string | null) => {
  const raw = (value || '').trim();
  if (!raw) return '';

  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 11) return raw;

  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

export const GeotestSignatureValue: React.FC<GeotestSignatureValueProps> = ({ diary }) => {
  const formattedCpf = formatCpf(diary?.geotestCpf);

  return (
    <div className="flex min-h-[56px] flex-col justify-between gap-1">
      <span className="text-[8px] leading-tight">{diary?.geotestSignature || '-'}</span>
      {diary?.geotestSignatureImage && (
        <div className="h-12 flex items-center justify-center border border-gray-300 bg-white">
          <img
            src={diary.geotestSignatureImage}
            alt="Assinatura Geoteste"
            className="max-h-10 object-contain"
          />
        </div>
      )}
      <span className="text-[7px] leading-tight">CPF: {formattedCpf || '-'}</span>
    </div>
  );
};
