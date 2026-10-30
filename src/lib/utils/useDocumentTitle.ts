import { useEffect } from 'react';

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const trimmed = title.trim();
    document.title = trimmed ? `${trimmed} · DR Choco` : "DR Choco L'Incompris";
  }, [title]);
}
