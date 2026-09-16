import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, HardHat } from 'lucide-react';

export interface ObraOption {
  id: string;
  obraCode?: string | null;
  name: string;
  clientId?: string | null;
  clientName?: string | null;
}

interface ObraSelectorProps {
  obras: ObraOption[];
  value: string;
  onChange: (obra: ObraOption | null) => void;
  loading?: boolean;
  placeholder?: string;
}

const normalizeText = (value?: string | null) => (typeof value === 'string' ? value.trim() : '');

const obraLabel = (obra: ObraOption) => {
  const code = normalizeText(obra.obraCode);
  const client = normalizeText(obra.clientName);
  const parts = [code, client || obra.name].filter(Boolean);
  return parts.join(' — ') || obra.name;
};

export const ObraSelector: React.FC<ObraSelectorProps> = ({
  obras,
  value,
  onChange,
  loading = false,
  placeholder = 'Buscar pelo número da obra (ex: G2561)...',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const selected = obras.find((o) => o.id === value);
    setSearchTerm(selected ? obraLabel(selected) : '');
  }, [value, obras]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const normalizedTerm = searchTerm.trim().toLowerCase();
  const filteredObras = normalizedTerm
    ? obras.filter((obra) =>
        normalizeText(obra.obraCode).toLowerCase().includes(normalizedTerm) ||
        normalizeText(obra.name).toLowerCase().includes(normalizedTerm) ||
        normalizeText(obra.clientName).toLowerCase().includes(normalizedTerm)
      )
    : obras;

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setIsOpen(true);
    if (!term.trim()) onChange(null);
  };

  const handleSelect = (obra: ObraOption) => {
    setSearchTerm(obraLabel(obra));
    onChange(obra);
    setIsOpen(false);
  };

  const handleClear = () => {
    setSearchTerm('');
    onChange(null);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => setIsOpen(true)}
          className="w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
          placeholder={placeholder}
          disabled={loading}
        />
        <button
          type="button"
          onClick={() => (searchTerm ? handleClear() : setIsOpen(!isOpen))}
          className="absolute inset-y-0 right-0 pr-3 flex items-center"
          disabled={loading}
        >
          <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && !loading && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredObras.length > 0 ? (
            <ul className="py-1">
              {filteredObras.map((obra) => (
                <li key={obra.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(obra)}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-start space-x-3"
                  >
                    <HardHat className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {normalizeText(obra.obraCode) || 'Sem código'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {[normalizeText(obra.clientName), normalizeText(obra.name)].filter(Boolean).join(' · ') || '-'}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
              Nenhuma obra encontrada
            </div>
          )}
        </div>
      )}

      {obras.length === 0 && !loading && (
        <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">Nenhuma obra cadastrada.</p>
      )}
    </div>
  );
};
