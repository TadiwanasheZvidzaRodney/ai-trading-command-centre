export interface ReportFormatOptions {
  includeDataFreshness?: boolean;
  includeLimitations?: boolean;
  includeMacroEvents?: boolean;
  maxAge?: number; // minutes - warn if data older than this
}

export interface FormattedReport {
  markdown: string;
  sections: {
    analysis: string;
    dataFreshness: string;
    technicalSetup: string;
    macroEvents: string;
    limitations: string;
    invalidationConditions: string;
    disclaimer: string;
  };
}
