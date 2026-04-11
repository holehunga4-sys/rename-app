import { RenameOptions, FileItem } from '../types';

export function applyRenameRules(
  filename: string,
  extension: string,
  index: number,
  options: RenameOptions
): string {
  let name = filename;

  // 1. Remove old numbering at start or end
  if (options.removeOldNumbering.start) {
    name = name.replace(/^\d+[\s\-_.]*/, '');
  }
  if (options.removeOldNumbering.end) {
    name = name.replace(/[\s\-_.]*\d+$/, '');
  }

  // 2. Remove multiple text fragments
  options.removeFragments.forEach((fragment) => {
    if (fragment.trim()) {
      const escaped = fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      name = name.replace(new RegExp(escaped, 'g'), '');
    }
  });

  // 3. Find and replace text
  if (options.findText) {
    const escaped = options.findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    name = name.replace(new RegExp(escaped, 'g'), options.replaceText);
  }

  // 4. Add prefix and suffix
  if (options.prefix) {
    name = options.prefix + options.separator + name;
  }
  if (options.suffix) {
    name = name + options.separator + options.suffix;
  }

  // 5. Add new numbering
  if (options.addNewNumbering.enabled) {
    const numStr = (options.addNewNumbering.startNumber + index)
      .toString()
      .padStart(options.addNewNumbering.digitCount, '0');
    
    if (options.addNewNumbering.position === 'start') {
      name = numStr + options.addNewNumbering.separator + name;
    } else {
      name = name + options.addNewNumbering.separator + numStr;
    }
  }

  // 6. Normalize repeated separators and extra spaces
  if (options.normalize) {
    // Replace multiple separators with a single one
    const sep = options.separator;
    const escapedSep = sep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    name = name.replace(new RegExp(`${escapedSep}+`, 'g'), sep);
    
    // Replace multiple spaces with single space
    name = name.replace(/\s+/g, ' ');
    
    // Trim
    name = name.trim();
    
    // Remove leading/trailing separators
    if (name.startsWith(sep)) name = name.substring(sep.length);
    if (name.endsWith(sep)) name = name.substring(0, name.length - sep.length);
  }

  return name + '.' + extension;
}

export function resolveDuplicates(files: FileItem[]): FileItem[] {
  const nameCounts = new Map<string, number>();
  const result = [...files];

  return result.map((item) => {
    if (item.status === 'error') return item;

    let finalName = item.newName;
    let status = item.status;

    if (nameCounts.has(finalName)) {
      const count = nameCounts.get(finalName)! + 1;
      nameCounts.set(finalName, count);
      
      const dotIndex = finalName.lastIndexOf('.');
      const namePart = finalName.substring(0, dotIndex);
      const extPart = finalName.substring(dotIndex);
      
      finalName = `${namePart}_${count}${extPart}`;
      status = 'duplicate_fixed';
    } else {
      nameCounts.set(finalName, 0);
    }

    return {
      ...item,
      newName: finalName,
      status: finalName === item.oldName ? 'skipped' : status === 'duplicate_fixed' ? 'duplicate_fixed' : 'renamed'
    };
  });
}

export function cleanFilenameForAi(filename: string): string {
  let name = filename;
  
  // Remove leading numbers and separators (e.g., "14. ", "1- ", "01_")
  name = name.replace(/^\d+[\s\-_.]*/, '');

  // Remove trailing patterns like _1, -1
  name = name.replace(/[\s\-_.]+\d+$/, '');

  // Normalize separators (replace underscores, dots, dashes with spaces)
  name = name.replace(/[._\-]/g, ' ');

  // Remove extra spaces
  name = name.replace(/\s+/g, ' ').trim();

  return name;
}
