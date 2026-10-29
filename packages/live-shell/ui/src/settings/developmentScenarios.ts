/** The development scenarios' names (settings/development.ts specimens), light: the Settings panel reads them to parse its query and
 * draw its scenario picker without loading the specimens, which load only when a scenario is asked for (O-I #740). */
export const scenarioNames = ['ready','loading','inherited','overridden','dirty','invalid','immediate','restart','pending','acknowledged','refused','failed','conflict','absent-product','unavailable-connection'] as const
export type DevelopmentScenario = typeof scenarioNames[number]
