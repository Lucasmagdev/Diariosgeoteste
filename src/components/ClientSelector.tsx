import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Building2 } from 'lucide-react';

interface Client {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

interface ClientSelectorProps {
  clients: Client[];
  value: string;
  onChange: (value: string) => void;
  loading?: boolean;
  required?: boolean;
}

export const ClientSelector: React.FC<ClientSelectorProps> = ({
  clients,
  value,
  onChange,
  loading = false,
  required = false,
}) => {
  const [searchTerm, setSearchTerm] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [filteredClients, setFilteredClients] = useState<Client[]>(clients);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  useEffect(() => {
    setFilteredClients(clients);
  }, [clients]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const normalizeText = (value?: string | null) => (typeof value === 'string' ? value.trim() : '');

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setIsOpen(true);
    const normalizedTerm = term.trim().toLowerCase();

    if (!normalizedTerm) {
      setFilteredClients(clients);
      onChange('');
      return;
    }

    const filtered = clients.filter((client) =>
      normalizeText(client.name).toLowerCase().includes(normalizedTerm) ||
      normalizeText(client.email).toLowerCase().includes(normalizedTerm)
    );
    setFilteredClients(filtered);

    // Se o termo digitado corresponde exatamente a um cliente, seleciona
    const exactMatch = clients.find(
      (client) => normalizeText(client.name).toLowerCase() === normalizedTerm
    );
    if (exactMatch) {
      onChange(normalizeText(exactMatch.name));
    } else {
      onChange('');
    }
  };

  const handleSelect = (client: Client) => {
    const selectedName = normalizeText(client.name);
    setSearchTerm(selectedName);
    onChange(selectedName);
    setIsOpen(false);
  };

  const handleFocus = () => {
    setIsOpen(true);
    setFilteredClients(clients);
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
          onFocus={handleFocus}
          className="w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
          placeholder="Pesquisar ou selecionar cliente..."
          required={required}
          disabled={loading}
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute inset-y-0 right-0 pr-3 flex items-center"
          disabled={loading}
        >
          <ChevronDown
            className={`h-5 w-5 text-gray-400 transition-transform ${
              isOpen ? 'transform rotate-180' : ''
            }`}
          />
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && !loading && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredClients.length > 0 ? (
            <ul className="py-1">
              {filteredClients.map((client) => (
                <li key={client.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(client)}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-start space-x-3"
                  >
                    <Building2 className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {normalizeText(client.name) || 'Cliente sem nome'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {normalizeText(client.email) || '-'}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
              Nenhum cliente encontrado
            </div>
          )}
        </div>
      )}

      {/* Mensagem quando não há clientes */}
      {clients.length === 0 && !loading && (
        <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
          Nenhum cliente cadastrado.
        </p>
      )}
    </div>
  );
};

