const KEY = "obra_magica_actor";

export function getActor(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setActor(name: string) {
  try {
    localStorage.setItem(KEY, name.trim());
  } catch {
    // O navegador pode bloquear armazenamento em modo privado.
  }
}

export function clearActor() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // O navegador pode bloquear armazenamento em modo privado.
  }
}

