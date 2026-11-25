import { createContext, useContext } from "react";
import type { Page, Workspace } from "./types";
export interface BuddyContext {
  data: Workspace;
  demo: boolean;
  page: Page;
  setPage: (page: Page) => void;
  mutate: (route: string, method: string, body: unknown) => Promise<void>;
  open: (kind: string, id?: string) => void;
  notify: (message: string, error?: boolean) => void;
  reload: () => Promise<void>;
}
export const Context = createContext<BuddyContext>(null!);
export const useBuddy = () => useContext(Context);
