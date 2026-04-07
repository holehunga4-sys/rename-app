export interface RenameOptions {
  prefix: string;
  suffix: string;
  separator: ' ' | '-' | '_' | '.';
  findText: string;
  replaceText: string;
  removeFragments: string[];
  removeOldNumbering: {
    start: boolean;
    end: boolean;
  };
  addNewNumbering: {
    enabled: boolean;
    position: 'start' | 'end';
    startNumber: number;
    digitCount: number;
    separator: string;
  };
  normalize: boolean;
}

export interface FileItem {
  id: string;
  file: File;
  oldName: string;
  newName: string;
  extension: string;
  thumbnail: string;
  status: 'pending' | 'renamed' | 'skipped' | 'duplicate_fixed' | 'error';
}

export interface RenameSummary {
  total: number;
  renamed: number;
  skipped: number;
  duplicateFixed: number;
}
