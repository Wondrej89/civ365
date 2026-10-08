import { createContext, useContext } from 'react';
export interface WorkforceFocus {
  resource: string;
  request: number;
}
export const WorkbookNavigation = createContext<{
  openWorkforce: (resource: string) => void;
  openSheet: (id: string) => void;
  workforceFocus: WorkforceFocus | null;
} | null>(null);
export function useWorkbookNavigation() {
  const navigation = useContext(WorkbookNavigation);
  if (!navigation) throw new Error('Workbook navigation provider is missing.');
  return navigation;
}
