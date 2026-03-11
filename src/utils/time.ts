export const formatTime24h = (value?: string | null): string => {
  if (!value) return '-';

  const raw = String(value).trim();
  if (!raw) return '-';

  // HH:mm ou HH:mm:ss
  const time24Match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (time24Match) {
    const hour = Number(time24Match[1]);
    const minute = Number(time24Match[2]);

    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
  }

  // h:mm AM/PM ou hh:mm:ss AM/PM
  const amPmMatch = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])$/);
  if (amPmMatch) {
    const baseHour = Number(amPmMatch[1]);
    const minute = Number(amPmMatch[2]);
    const period = amPmMatch[4].toUpperCase();

    if (baseHour >= 1 && baseHour <= 12 && minute >= 0 && minute <= 59) {
      const convertedHour =
        period === 'AM'
          ? (baseHour === 12 ? 0 : baseHour)
          : (baseHour === 12 ? 12 : baseHour + 12);

      return `${String(convertedHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
  }

  // Fallback para strings de data/hora parseáveis
  const parsedDate = new Date(raw);
  if (!Number.isNaN(parsedDate.getTime())) {
    return parsedDate.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  // Último fallback: remove AM/PM se vier em formato inesperado
  return raw.replace(/\s*[AaPp][Mm]\s*$/, '').trim() || '-';
};

export const formatTime24hOrEmpty = (value?: string | null): string => {
  const formatted = formatTime24h(value);
  return formatted === '-' ? '' : formatted;
};

export const maskTimeInput = (value?: string | null): string => {
  const raw = String(value ?? '');
  const digits = raw.replace(/\D/g, '').slice(0, 4);

  if (!digits) return '';
  if (digits.length <= 2) return digits;
  if (digits.length === 3) return `${digits.slice(0, 1)}:${digits.slice(1)}`;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
};

export const normalizeTimeInput = (value?: string | null): string => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  if (/[AaPp][Mm]/.test(raw)) {
    return formatTime24hOrEmpty(raw);
  }

  let hour = 0;
  let minute = 0;

  if (raw.includes(':')) {
    const [h, m = '0'] = raw.split(':');
    hour = Number(h);
    minute = Number(m);
  } else {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    if (!digits) return '';
    if (digits.length <= 2) {
      hour = Number(digits);
      minute = 0;
    } else if (digits.length === 3) {
      hour = Number(digits.slice(0, 1));
      minute = Number(digits.slice(1));
    } else {
      hour = Number(digits.slice(0, 2));
      minute = Number(digits.slice(2));
    }
  }

  if (Number.isNaN(hour) || Number.isNaN(minute)) return '';

  const safeHour = Math.min(23, Math.max(0, hour));
  const safeMinute = Math.min(59, Math.max(0, minute));

  return `${String(safeHour).padStart(2, '0')}:${String(safeMinute).padStart(2, '0')}`;
};
