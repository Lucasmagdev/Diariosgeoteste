import { supabase } from '../lib/supabaseClient';

const BUCKET = 'portal-docs';

// Comprime imagem para upload (PDFs vao sem compressao). Espelha collaboratorPhotoStorage.
const compressImage = (file: File, maxWidth: number = 1600, quality: number = 0.82): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível obter contexto do canvas'));
          return;
        }
        let { width, height } = img;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Erro ao converter imagem'))),
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Erro ao carregar imagem'));
      if (e.target?.result) img.src = e.target.result as string;
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsDataURL(file);
  });
};

export interface UploadedDoc {
  url: string;
  fileType: string;
}

// Faz upload de um documento (PDF ou imagem) do portal e retorna URL publica.
export const uploadPortalDoc = async (file: File, obraId: string): Promise<UploadedDoc> => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
  if (!validTypes.includes(file.type)) {
    throw new Error('Formato não suportado. Use PDF, JPG, PNG ou WEBP.');
  }

  const maxSize = 20 * 1024 * 1024; // 20MB
  if (file.size > maxSize) {
    throw new Error('Arquivo muito grande. Máximo 20MB.');
  }

  const isPdf = file.type === 'application/pdf';
  const rand = Math.random().toString(36).slice(2, 10);
  let body: Blob = file;
  let contentType = file.type;
  let ext = file.name.split('.').pop()?.toLowerCase() || (isPdf ? 'pdf' : 'jpg');

  if (!isPdf) {
    body = await compressImage(file);
    contentType = 'image/jpeg';
    ext = 'jpg';
  }

  const fileName = `${obraId}/${Date.now()}_${rand}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, body, { contentType, cacheControl: '3600', upsert: false });

  if (error) {
    if (error.message?.toLowerCase().includes('not found')) {
      throw new Error('Bucket "portal-docs" não encontrado. Rode o SQL do portal no Supabase.');
    }
    throw error;
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  return { url: publicUrl, fileType: contentType };
};

// Deleta documento do storage a partir da URL publica.
export const deletePortalDoc = async (url: string): Promise<void> => {
  try {
    if (!url) return;
    const marker = `/${BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return;
    const path = url.slice(idx + marker.length).split('?')[0];
    await supabase.storage.from(BUCKET).remove([path]);
  } catch (err) {
    console.error('Erro ao deletar documento do portal:', err);
  }
};
