import {createContext, useContext} from 'react';
export interface ActiveEncounter {ref: string; project: string; space: string}
export const ActiveEncounterContext = createContext<ActiveEncounter | undefined>(undefined);
export const useActiveEncounter = () => useContext(ActiveEncounterContext);
