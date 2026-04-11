/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { 
  Upload, 
  Trash2, 
  Play, 
  Eye, 
  Download, 
  Settings, 
  Moon, 
  Sun, 
  CheckCircle2, 
  AlertCircle, 
  FileImage,
  X,
  Sparkles,
  Brain,
  Wand2,
  Copy,
  Check,
  Activity,
  Gauge,
  Info,
  Zap,
  HelpCircle,
  BookOpen,
  Settings2,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  History,
  Briefcase,
  Type,
  Monitor,
  Search,
  MessageCircle,
  Facebook,
  Users,
  ShoppingBag,
  Phone,
  ExternalLink,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';
import { RenameOptions, FileItem, RenameSummary } from './types';
import { applyRenameRules, resolveDuplicates, cleanFilenameForAi } from './lib/renameLogic';
import { 
  PRODUCT_TYPES, 
  TITLE_STYLES, 
  CASE_MODES, 
  extractTextFromImage, 
  chooseMainPhrase, 
  autoDetectProductType, 
  buildTitle,
  smartCase
} from './lib/titleLogic';
import { cn } from './lib/utils';
import { triggerMascot } from './lib/mascot';
import { HorseMascotAssistant } from './components/HorseMascotAssistant';

const SUPPORTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'];

export default function App() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [titleFiles, setTitleFiles] = useState<any[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) {
        setIsDarkMode(e.matches);
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);
  const [options, setOptions] = useState<RenameOptions>({
    prefix: '',
    suffix: '',
    separator: '_',
    findText: '',
    replaceText: '',
    removeFragments: [],
    removeOldNumbering: { start: false, end: false },
    addNewNumbering: {
      enabled: false,
      position: 'end',
      startNumber: 1,
      digitCount: 2,
      separator: '_'
    },
    normalize: true
  });
  const [summary, setSummary] = useState<RenameSummary | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [zipFilename, setZipFilename] = useState('');

  // Title Tool State
  const [titleOptions, setTitleOptions] = useState({
    prefix: '',
    suffix: '',
    suffixList: [] as string[],
    caseMode: 'Tự động'
  });
  const [isProcessingTitles, setIsProcessingTitles] = useState(false);
  const [selectedTitleFile, setSelectedTitleFile] = useState<any | null>(null);

  const [selectedTool, setSelectedTool] = useState<any | null>(null);

  // Tabs State
  const [activeTab, setActiveTab] = useState<'rename' | 'write-title' | 'info'>('rename');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      return SUPPORTED_EXTENSIONS.includes(ext);
    });

    const newFileItems: FileItem[] = validFiles.map(file => {
      const dotIndex = file.name.lastIndexOf('.');
      const name = file.name.substring(0, dotIndex);
      const ext = file.name.substring(dotIndex + 1);
      
      return {
        id: Math.random().toString(36).substring(7),
        file,
        oldName: file.name,
        newName: file.name,
        extension: ext,
        thumbnail: URL.createObjectURL(file),
        status: 'pending'
      };
    });

    setFiles(prev => [...prev, ...newFileItems]);
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const item = prev.find(f => f.id === id);
      if (item) URL.revokeObjectURL(item.thumbnail);
      return prev.filter(f => f.id !== id);
    });
  };

  const clearAll = () => {
    files.forEach(f => URL.revokeObjectURL(f.thumbnail));
    setFiles([]);
    setSummary(null);
  };

  const getRenamedFiles = () => {
    const previewed = files.map((item, index) => {
      const dotIndex = item.oldName.lastIndexOf('.');
      const nameOnly = item.oldName.substring(0, dotIndex);
      const newName = applyRenameRules(nameOnly, item.extension, index, options);
      return { ...item, newName, status: 'pending' as const };
    });

    return resolveDuplicates(previewed);
  };

  const previewRename = () => {
    const resolved = getRenamedFiles();
    setFiles(resolved);
  };

  const runRename = async () => {
    setIsProcessing(true);
    const resolved = getRenamedFiles();
    setFiles(resolved);
    
    // Calculate summary
    const stats: RenameSummary = {
      total: resolved.length,
      renamed: 0,
      skipped: 0,
      duplicateFixed: 0
    };

    resolved.forEach(f => {
      if (f.status === 'renamed') stats.renamed++;
      else if (f.status === 'skipped') stats.skipped++;
      else if (f.status === 'duplicate_fixed') stats.duplicateFixed++;
    });

    setSummary(stats);
    setIsProcessing(false);
  };

  const exportZip = async () => {
    const zip = new JSZip();
    files.forEach(item => {
      zip.file(item.newName, item.file);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    
    // Clean filename
    let finalZipName = zipFilename.trim();
    // Remove invalid characters: \ / : * ? " < > |
    finalZipName = finalZipName.replace(/[\\/:*?"<>|]/g, '');
    
    // Remove .zip if present at the end
    if (finalZipName.toLowerCase().endsWith('.zip')) {
      finalZipName = finalZipName.substring(0, finalZipName.length - 4);
    }
    
    // Fallback if empty
    if (!finalZipName) {
      finalZipName = 'anh-da-doi-ten';
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = `${finalZipName}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Title Tool Logic
  const handleSuffixFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      setTitleOptions(prev => ({ ...prev, suffixList: lines }));
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleTitleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter((file: File) => {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        return SUPPORTED_EXTENSIONS.includes(ext);
      });

      const newItems = newFiles.map((file: File) => ({
        id: Math.random().toString(36).substring(7),
        file,
        filename: file.name,
        thumbnail: URL.createObjectURL(file),
        rawText: '',
        cleanText: '',
        productType: '',
        title: '',
        status: 'pending'
      }));

      setTitleFiles(prev => [...prev, ...newItems]);
    }
  };

  const removeTitleFile = (id: string) => {
    setTitleFiles(prev => {
      const item = prev.find(f => f.id === id);
      if (item) URL.revokeObjectURL(item.thumbnail);
      if (selectedTitleFile?.id === id) setSelectedTitleFile(null);
      return prev.filter(f => f.id !== id);
    });
  };

  const clearAllTitleFiles = () => {
    titleFiles.forEach(f => URL.revokeObjectURL(f.thumbnail));
    setTitleFiles([]);
    setSelectedTitleFile(null);
  };

  const processTitles = async () => {
    if (titleFiles.length === 0 || isProcessingTitles) return;
    
    setIsProcessingTitles(true);
    triggerMascot('loading');

    const updatedFiles = [...titleFiles];
    
    for (let i = 0; i < updatedFiles.length; i++) {
      const item = updatedFiles[i];
      if (item.status === 'success') continue;
      
      try {
        // Update status to processing
        setTitleFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'processing' } : f));
        
        const dotIndex = item.filename.lastIndexOf('.');
        const stem = dotIndex !== -1 ? item.filename.substring(0, dotIndex) : item.filename;
        
        let mainText = cleanFilenameForAi(stem);
        mainText = smartCase(mainText, titleOptions.caseMode);
        
        const currentSuffix = titleOptions.suffixList.length > 0
          ? titleOptions.suffixList[Math.floor(Math.random() * titleOptions.suffixList.length)]
          : titleOptions.suffix;

        let title = `${titleOptions.prefix} ${mainText} ${currentSuffix}`.trim();
        // Clean up any extra spaces
        title = title.replace(/\s+/g, ' ').trim();
        // Apply case mode to the final title
        title = smartCase(title, titleOptions.caseMode);

        const updatedItem = {
          ...item,
          rawText: '',
          cleanText: mainText,
          productType: '',
          title,
          status: 'success'
        };
        
        updatedFiles[i] = updatedItem;
        setTitleFiles(prev => prev.map(f => f.id === item.id ? updatedItem : f));
        
        if (selectedTitleFile?.id === item.id) {
          setSelectedTitleFile(updatedItem);
        }
      } catch (error) {
        console.error("Error processing file:", item.filename, error);
        setTitleFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'error' } : f));
      }
    }

    setIsProcessingTitles(false);
    triggerMascot('success');
  };

  const downloadTitleImagesZip = async () => {
    if (titleFiles.filter(f => f.status === 'success').length === 0) return;
    
    triggerMascot('loading');
    const zip = new JSZip();
    
    titleFiles.forEach(item => {
      if (item.status === 'success' && item.title) {
        const ext = item.filename.split('.').pop() || 'jpg';
        const safeTitle = item.title.replace(/[/\\?%*:|"<>]/g, '-');
        zip.file(`${safeTitle}.${ext}`, item.file);
      }
    });
    
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Images_New_Titles.zip`;
    a.click();
    URL.revokeObjectURL(url);
    triggerMascot('success');
  };

  const Toggle = ({ checked, onChange, label }: { checked: boolean, onChange: (val: boolean) => void, label: string }) => (
    <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-all hover:shadow-[0_0_25px_rgba(34,197,94,0.25)] dark:hover:shadow-[0_0_35px_rgba(34,197,94,0.15)] group">
      <div 
        onClick={(e) => {
          e.preventDefault();
          onChange(!checked);
        }}
        className={cn(
          "toggle-switch-base",
          checked ? "toggle-switch-active" : "toggle-switch-inactive"
        )}
      >
        <div className={cn(
          "toggle-knob-base",
          checked ? "translate-x-5" : "translate-x-0"
        )} />
      </div>
      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 group-hover:text-primary transition-colors leading-tight">
        {label}
      </span>
    </label>
  );

  const renderRenameTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start relative z-10">
      {/* Left Column: Controls */}
      <div className="lg:col-span-3 space-y-4 lg:sticky lg:top-24">
        {/* Dropzone */}
        <motion.div 
          whileHover={{ scale: 1.01, y: -2 }}
          className="relative group cursor-pointer"
          onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('upload-zone-active'); }}
          onDragLeave={e => { e.preventDefault(); e.currentTarget.classList.remove('upload-zone-active'); }}
          onDrop={e => {
            e.preventDefault();
            e.currentTarget.classList.remove('upload-zone-active');
            addFiles(Array.from(e.dataTransfer.files));
          }}
        >
          <input 
            type="file" 
            multiple 
            accept={SUPPORTED_EXTENSIONS.map(ext => `.${ext}`).join(',')}
            onChange={handleFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div className="premium-card p-6 flex flex-col items-center justify-center gap-4 group-hover:border-primary group-hover:bg-primary/5 hover-glow-primary transition-all duration-500 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-lg shadow-primary/10 relative z-10">
              <Upload className="text-primary" size={24} />
            </div>
            <div className="text-center space-y-1 relative z-10">
              <p className="text-sm font-black text-slate-800 dark:text-white">Kéo thả hoặc nhấn chọn ảnh</p>
            </div>
          </div>
        </motion.div>

        <section className="premium-card p-6 hover-glow-primary">
          <h2 className="text-sm font-bold mb-6 flex items-center gap-3 text-slate-800 dark:text-white">
            <div className="p-2 bg-primary/10 rounded-lg shadow-inner shadow-primary/5">
              <Settings2 size={16} className="text-primary" />
            </div>
            Quy tắc đổi tên
          </h2>
          
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 group">
              <div className="group">
                <label className="label-premium group-focus-within:text-primary !text-[10px]">Thêm vào đầu</label>
                <input 
                  type="text" 
                  value={options.prefix}
                  onChange={e => setOptions({...options, prefix: e.target.value})}
                  className="input-field !py-2 !px-3 !text-xs"
                  placeholder="VD: nam-"
                />
              </div>

              <div className="group">
                <label className="label-premium group-focus-within:text-primary !text-[10px]">Thêm vào cuối</label>
                <input 
                  type="text" 
                  value={options.suffix}
                  onChange={e => setOptions({...options, suffix: e.target.value})}
                  className="input-field !py-2 !px-3 !text-xs"
                  placeholder="VD: -mau-1"
                />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="grid grid-cols-2 gap-3">
                <div className="group">
                  <label className="label-premium group-focus-within:text-primary !text-[10px]">Tìm kiếm</label>
                  <input 
                    type="text" 
                    value={options.findText}
                    onChange={e => setOptions({...options, findText: e.target.value})}
                    className="input-field !py-2 !px-3 !text-xs"
                    placeholder="Từ..."
                  />
                </div>
                <div className="group">
                  <label className="label-premium group-focus-within:text-primary !text-[10px]">Thay thế</label>
                  <input 
                    type="text" 
                    value={options.replaceText}
                    onChange={e => setOptions({...options, replaceText: e.target.value})}
                    className="input-field !py-2 !px-3 !text-xs"
                    placeholder="Bằng..."
                  />
                </div>
              </div>

              <div className="group">
                <label className="label-premium group-focus-within:text-primary !text-[10px]">Xóa chuỗi (mỗi dòng 1 chuỗi)</label>
                <textarea 
                  rows={2}
                  onChange={e => setOptions({...options, removeFragments: e.target.value.split('\n')})}
                  className="textarea-field !py-2 !px-3 !text-xs"
                  placeholder="Nhập các từ cần xóa..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Toggle 
                checked={options.removeOldNumbering.start}
                onChange={val => setOptions({...options, removeOldNumbering: {...options.removeOldNumbering, start: val}})}
                label="Xóa số cũ ở đầu"
              />
              <Toggle 
                checked={options.removeOldNumbering.end}
                onChange={val => setOptions({...options, removeOldNumbering: {...options.removeOldNumbering, end: val}})}
                label="Xóa số cũ ở cuối"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <Toggle 
                checked={options.addNewNumbering.enabled}
                onChange={val => setOptions({...options, addNewNumbering: {...options.addNewNumbering, enabled: val}})}
                label="Thêm số thứ tự mới"
              />
              
              <AnimatePresence>
                {options.addNewNumbering.enabled && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="grid grid-cols-1 gap-3 pl-8 overflow-hidden mt-3"
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1 group">
                        <label className="label-premium !mb-1 !text-[9px]">Vị trí</label>
                        <div className="relative">
                          <select 
                            value={options.addNewNumbering.position}
                            onChange={e => setOptions({...options, addNewNumbering: {...options.addNewNumbering, position: e.target.value as any}})}
                            className="select-field !py-2 !px-3 !text-xs"
                          >
                            <option value="start">Đầu</option>
                            <option value="end">Cuối</option>
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            <ChevronDown size={12} />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1 group">
                        <label className="label-premium !mb-1 !text-[9px]">Bắt đầu từ</label>
                        <input 
                          type="number" 
                          value={options.addNewNumbering.startNumber}
                          onChange={e => setOptions({...options, addNewNumbering: {...options.addNewNumbering, startNumber: parseInt(e.target.value) || 1}})}
                          className="input-field !py-2 !px-3 !text-xs"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-1 group">
                      <label className="label-premium !mb-1 !text-[9px]">Dấu phân cách</label>
                      <div className="relative">
                        <select 
                          value={options.separator}
                          onChange={e => setOptions({...options, separator: e.target.value as any})}
                          className="select-field !py-2 !px-3 !text-xs"
                        >
                          <option value=" ">Khoảng trắng</option>
                          <option value="-">Dấu gạch ngang (-)</option>
                          <option value="_">Dấu gạch dưới (_)</option>
                          <option value=".">Dấu chấm (.)</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          <ChevronDown size={12} />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <motion.button 
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={previewRename}
            disabled={files.length === 0}
            className="btn-secondary !py-2.5 !text-xs"
          >
            <Eye size={16} />
            Xem trước
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={runRename}
            disabled={files.length === 0 || isProcessing}
            className="btn-primary !py-2.5 !text-xs"
          >
            {isProcessing ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Play size={16} />
                Thực hiện
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* Right Column: File List */}
      <div className="lg:col-span-9 space-y-6">
        {/* ZIP Filename & Export moved to TOP */}
        <AnimatePresence>
          {files.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="premium-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover-glow-blue"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-2xl">
                  <Download className="text-blue-500" size={24} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-1">Tải xuống kết quả</h3>
                  <p className="text-xs text-slate-500">Nén tất cả ảnh đã đổi tên vào 1 file ZIP</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 flex-1 md:max-w-md">
                <input 
                  type="text" 
                  value={zipFilename}
                  onChange={e => setZipFilename(e.target.value)}
                  className="input-field !py-2.5 focus:ring-blue-500/20 focus:border-blue-500 flex-1"
                  placeholder="Tên file ZIP (VD: anh-da-doi-ten)"
                />
                <motion.button 
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={exportZip}
                  className="btn-primary bg-blue-500 hover:bg-blue-600 hover-glow-blue whitespace-nowrap !py-2.5"
                >
                  <Download size={18} />
                  Tải ZIP
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Summary Cards */}
        <AnimatePresence>
          {summary && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4"
            >
              {[
                { label: 'Tổng số', value: summary.total, color: 'slate', icon: FileImage },
                { label: 'Đã đổi tên', value: summary.renamed, color: 'green', icon: CheckCircle2 },
                { label: 'Bỏ qua', value: summary.skipped, color: 'yellow', icon: AlertCircle },
                { label: 'Trùng lặp', value: summary.duplicateFixed, color: 'blue', icon: History },
              ].map((stat) => (
                <div key={stat.label} className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-premium dark:shadow-none flex flex-col items-center gap-2">
                  <div className={cn(
                    "p-2 rounded-xl mb-1",
                    stat.color === 'green' && "bg-green-500/10 text-green-500",
                    stat.color === 'yellow' && "bg-yellow-500/10 text-yellow-500",
                    stat.color === 'blue' && "bg-blue-500/10 text-blue-500",
                    stat.color === 'slate' && "bg-slate-500/10 text-slate-500"
                  )}>
                    <stat.icon size={16} />
                  </div>
                  <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest">{stat.label}</p>
                  <p className={cn(
                    "text-2xl font-black",
                    stat.color === 'green' && "text-green-500",
                    stat.color === 'yellow' && "text-yellow-500",
                    stat.color === 'blue' && "text-blue-500",
                    stat.color === 'slate' && "text-slate-800 dark:text-white"
                  )}>{stat.value}</p>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* File Table */}
        <div className="premium-card overflow-hidden hover-glow-primary">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-slate-200 dark:bg-slate-800 rounded-xl">
                <FileImage size={18} className="text-slate-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white">Danh sách tệp</h3>
                <p className="text-xs text-slate-400 font-medium">Đã chọn {files.length} ảnh</p>
              </div>
            </div>
            {files.length > 0 && (
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={clearAll}
                className="btn-danger !py-2 !px-4 !text-[10px] !rounded-xl flex items-center gap-2"
              >
                <Trash2 size={14} />
                Xóa hết
              </motion.button>
            )}
          </div>

          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white/95 dark:bg-slate-900/95 z-20 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="p-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">#</th>
                  <th className="p-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Ảnh</th>
                  <th className="p-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Tên cũ</th>
                  <th className="p-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Tên mới</th>
                  <th className="p-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Trạng thái</th>
                  <th className="p-5 text-[9px] font-black text-slate-400 uppercase tracking-widest"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                <AnimatePresence mode="popLayout">
                  {files.map((item, index) => (
                    <motion.tr 
                      key={item.id}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: index * 0.01 }}
                      className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="p-5 text-[10px] font-bold text-slate-400">{index + 1}</td>
                      <td className="p-5">
                        <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                          <img src={item.thumbnail} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      </td>
                      <td className="p-5">
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-400 truncate max-w-[180px]" title={item.oldName}>
                          {item.oldName}
                        </p>
                      </td>
                      <td className="p-5">
                        <p className="text-xs font-black text-primary truncate max-w-[180px]" title={item.newName}>
                          {item.newName}
                        </p>
                      </td>
                      <td className="p-5">
                        {item.status === 'renamed' && (
                          <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-green-500 bg-green-500/10 px-3 py-1.5 rounded-full border border-green-500/20">
                            <CheckCircle2 size={12} /> Đã đổi
                          </span>
                        )}
                        {item.status === 'skipped' && (
                          <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-yellow-500 bg-yellow-500/10 px-3 py-1.5 rounded-full border border-yellow-500/20">
                            <AlertCircle size={12} /> Bỏ qua
                          </span>
                        )}
                        {item.status === 'duplicate_fixed' && (
                          <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-blue-500 bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20">
                            <History size={12} /> Trùng lặp
                          </span>
                        )}
                        {item.status === 'pending' && (
                          <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-slate-400 bg-slate-400/10 px-3 py-1.5 rounded-full border border-slate-400/20">
                            Chờ...
                          </span>
                        )}
                      </td>
                      <td className="p-5 text-right">
                        <motion.button 
                          whileHover={{ scale: 1.2, rotate: 90 }}
                          whileTap={{ scale: 0.8 }}
                          onClick={() => removeFile(item.id)}
                          className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <X size={18} />
                        </motion.button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {files.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-24 text-center">
                      <div className="flex flex-col items-center gap-4 opacity-30">
                        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center">
                          <FileImage size={40} />
                        </div>
                        <p className="text-xs font-black uppercase tracking-widest">Chưa có tệp nào được chọn</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const renderWriteTitleTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start relative z-10">
      {/* Left Column: Controls */}
      <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-24">
        {/* Dropzone */}
        <motion.div 
          whileHover={{ scale: 1.01, y: -2 }}
          className="relative group cursor-pointer"
          onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('upload-zone-active'); }}
          onDragLeave={e => { e.preventDefault(); e.currentTarget.classList.remove('upload-zone-active'); }}
          onDrop={e => {
            e.preventDefault();
            e.currentTarget.classList.remove('upload-zone-active');
            if (e.dataTransfer.files) {
              const newFiles = Array.from(e.dataTransfer.files).filter((file: File) => {
                const ext = file.name.split('.').pop()?.toLowerCase() || '';
                return SUPPORTED_EXTENSIONS.includes(ext);
              });

              const newItems = newFiles.map((file: File) => ({
                id: Math.random().toString(36).substring(7),
                file,
                filename: file.name,
                thumbnail: URL.createObjectURL(file),
                rawText: '',
                cleanText: '',
                productType: '',
                title: '',
                status: 'pending'
              }));

              setTitleFiles(prev => [...prev, ...newItems]);
            }
          }}
        >
          <input 
            type="file" 
            multiple 
            accept={SUPPORTED_EXTENSIONS.map(ext => `.${ext}`).join(',')}
            onChange={handleTitleFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div className="premium-card p-6 flex flex-col items-center justify-center gap-4 group-hover:border-primary group-hover:bg-primary/5 hover-glow-primary transition-all duration-500 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-lg shadow-primary/10 relative z-10">
              <Upload className="text-primary" size={24} />
            </div>
            <div className="text-center space-y-1 relative z-10">
              <p className="text-sm font-black text-slate-800 dark:text-white">Kéo thả hoặc nhấn chọn ảnh</p>
            </div>
          </div>
        </motion.div>

        <section className="premium-card p-6 hover-glow-primary">
          <h2 className="text-sm font-bold mb-6 flex items-center gap-3 text-slate-800 dark:text-white">
            <div className="p-2 bg-primary/10 rounded-lg shadow-inner shadow-primary/5">
              <Settings2 size={16} className="text-primary" />
            </div>
            Thiết lập Title
          </h2>
          
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="group">
                <label className="label-premium group-focus-within:text-primary !text-[10px]">Keyword đầu</label>
                <input 
                  type="text" 
                  value={titleOptions.prefix}
                  onChange={e => setTitleOptions({...titleOptions, prefix: e.target.value})}
                  className="input-field !py-2 !px-3 !text-xs"
                />
              </div>

              <div className="group">
                <div className="flex items-center justify-between mb-1">
                  <label className="label-premium group-focus-within:text-primary !text-[10px] !mb-0">Đuôi title</label>
                  <label className="cursor-pointer text-[9px] text-primary hover:underline font-bold">
                    + Up file .txt
                    <input type="file" accept=".txt" className="hidden" onChange={handleSuffixFileUpload} />
                  </label>
                </div>
                {titleOptions.suffixList.length > 0 ? (
                  <div className="flex items-center justify-between input-field !py-2 !px-3 !text-xs bg-primary/5 border-primary/20">
                    <span className="text-primary font-medium truncate">Đã tải {titleOptions.suffixList.length} dòng (Random)</span>
                    <button 
                      onClick={() => setTitleOptions(prev => ({ ...prev, suffixList: [] }))}
                      className="text-red-500 hover:text-red-700 ml-2 flex-shrink-0"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <input 
                    type="text" 
                    value={titleOptions.suffix}
                    onChange={e => setTitleOptions({...titleOptions, suffix: e.target.value})}
                    className="input-field !py-2 !px-3 !text-xs"
                    placeholder="Nhập đuôi title..."
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1 group">
                <label className="label-premium !mb-1 !text-[9px]">Chuẩn hóa chữ</label>
                <div className="relative">
                  <select 
                    value={titleOptions.caseMode}
                    onChange={e => setTitleOptions({...titleOptions, caseMode: e.target.value})}
                    className="select-field !py-2 !px-3 !text-xs"
                  >
                    {CASE_MODES.map(cm => <option key={cm} value={cm}>{cm}</option>)}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <ChevronDown size={12} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-3">
          <motion.button 
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={processTitles}
            disabled={titleFiles.length === 0 || isProcessingTitles}
            className="btn-primary !py-2.5 !text-xs"
          >
            {isProcessingTitles ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Play size={16} />
                Quét + tạo title
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* Right Column: File List */}
      <div className="lg:col-span-8 space-y-6">
        <div className="premium-card overflow-hidden hover-glow-primary flex flex-col">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-200 dark:bg-slate-800 rounded-xl">
                  <FileImage size={16} className="text-slate-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">Danh sách title</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Đã chọn {titleFiles.length} ảnh</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {titleFiles.length > 0 && (
                  <>
                    <button onClick={downloadTitleImagesZip} className="btn-primary !py-1.5 !px-3 !text-[10px] !rounded-lg flex items-center gap-1">
                      <Download size={12} />
                      Tải ZIP Ảnh
                    </button>
                    <button onClick={clearAllTitleFiles} className="btn-danger !py-1.5 !px-3 !text-[10px] !rounded-lg"><Trash2 size={12} /></button>
                  </>
                )}
              </div>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-white/95 dark:bg-slate-900/95 z-20 border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest w-1/3">File</th>
                    <th className="p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest w-2/3">Title</th>
                    <th className="p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest"></th>
                  </tr>
                </thead>
                <tbody 
                  className="divide-y divide-slate-50 dark:divide-slate-800/50"
                  onMouseLeave={() => setSelectedTitleFile(null)}
                >
                  <AnimatePresence mode="popLayout">
                    {titleFiles.map((item) => (
                      <motion.tr 
                        key={item.id}
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        onMouseEnter={() => setSelectedTitleFile(item)}
                        className="group cursor-pointer transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/30"
                      >
                        <td className="p-3">
                          <p className="text-xs font-bold text-slate-600 dark:text-slate-400 break-words" title={item.filename}>
                            {item.filename}
                          </p>
                        </td>
                        <td className="p-3">
                          {item.status === 'processing' ? (
                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                              <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                              Đang xử lý...
                            </div>
                          ) : item.status === 'error' ? (
                            <span className="text-[10px] text-red-500">Lỗi</span>
                          ) : (
                            <p className="text-[11px] font-bold text-primary break-words" title={item.title}>
                              {item.title}
                            </p>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              removeTitleFile(item.id);
                            }}
                            className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                  {titleFiles.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-12 text-center">
                        <div className="flex flex-col items-center gap-3 opacity-30">
                          <Type size={32} />
                          <p className="text-[10px] font-black uppercase tracking-widest">Chưa có tệp nào</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
      </div>

      {/* Floating Thumbnail Preview */}
      <AnimatePresence>
        {selectedTitleFile && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 left-6 z-50 bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] border border-slate-200 dark:border-slate-700 pointer-events-none max-w-[300px]"
          >
            <img src={selectedTitleFile.thumbnail} alt="" className="w-full h-48 object-contain rounded-xl bg-slate-100 dark:bg-slate-900 mb-3" />
            <div className="space-y-1.5">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tên cũ</span>
                <p className="text-[10px] font-medium text-slate-600 dark:text-slate-300 break-words line-clamp-2">
                  {selectedTitleFile.filename}
                </p>
              </div>
              {selectedTitleFile.title && (
                <div>
                  <span className="text-[9px] font-bold text-primary uppercase tracking-wider">Tên mới</span>
                  <p className="text-[11px] font-bold text-slate-800 dark:text-white break-words line-clamp-3">
                    {selectedTitleFile.title}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const renderInfoTab = () => {
    const TOOLS = [
      {
        id: 'portfolio',
        title: 'Portfolio',
        description: 'Tổng hợp dự án và sản phẩm',
        icon: Briefcase,
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
        url: 'https://www.behance.net/gallery/226503331/Portfolio',
        features: [
          '🚀 Nơi tổng hợp các dự án, giao diện và tool đã làm',
          '✅ Xem nhanh các sản phẩm nổi bật',
          '✅ Giao diện gọn, dễ theo dõi',
          '✅ Phù hợp để chia sẻ cho khách hoặc cộng đồng',
          '✅ Có thể dùng làm trang giới thiệu cá nhân'
        ],
        note: '🔥 Tổng hợp những thứ Hưng đẹp trai từng build!',
        action: 'Xem ngay'
      },
      {
        id: 'font',
        title: 'Tìm Font',
        description: 'Tìm font nhanh, gọn, dễ quản lý',
        icon: Type,
        color: 'text-purple-500',
        bgColor: 'bg-purple-500/10',
        url: 'https://drive.google.com/drive/folders/1DkbvtPBSGkOSkq51UVqAVBq-WgvWe5_l?usp=drive_link',
        features: [
          '🔥 QUẢN LÝ FONT CỰC ĐÃ - KHỎI LO LẠC FONT!',
          '✅ Bật/tắt font không cần cài bừa bãi',
          '✅ Tìm font cực nhanh',
          '✅ Preview font trong 1 nốt nhạc',
          '✅ Tạo bộ sưu tập theo dự án',
          '✅ Quản lý font theo folder/tag',
          '✅ Search font theo tên siêu nhanh',
          '✅ Xem trước font + test text ngay'
        ],
        note: '🔥 Tool quản lý font cực hiệu quả cho dân design!',
        action: 'Tải ngay'
      },
      {
        id: 'offline',
        title: 'Phiên Bản Offline',
        description: 'Bản cài đặt dùng trực tiếp trên máy',
        icon: Monitor,
        color: 'text-green-500',
        bgColor: 'bg-green-500/10',
        url: 'https://drive.google.com/drive/folders/1uhwXp4iiq5w7Lo3N5perchYRKe4g-cOy?usp=drive_link',
        features: [
          '💻 Dùng trực tiếp trên máy không cần mở web',
          '✅ Gọn nhẹ, dễ dùng',
          '✅ Phù hợp khi làm việc nhiều file',
          '✅ Tốc độ xử lý ổn định hơn',
          '✅ Dễ đóng gói và chia sẻ cho người dùng riêng'
        ],
        note: '⚡ Bản dành cho ai thích dùng chắc tay trên máy tính!',
        action: 'Xem chi tiết'
      },
      {
        id: 'scan',
        title: 'Tool Quét Ảnh',
        description: 'Quét, lọc và xử lý ảnh nhanh',
        icon: Search,
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-500/10',
        url: 'https://drive.google.com/drive/folders/1c_qt28ie1aaLH5Hk-mT8lB20WdKR3jI-?usp=drive_link',
        features: [
          '🖼️ Quét và lọc ảnh nhanh theo nhu cầu',
          '✅ Hỗ trợ làm việc với số lượng ảnh lớn',
          '✅ Dễ kết hợp với workflow đổi tên file',
          '✅ Tiết kiệm thời gian thao tác thủ công',
          '✅ Phù hợp cho người cần xử lý ảnh hàng loạt'
        ],
        note: '⚡ Tool dành cho ai muốn làm ảnh nhanh, gọn, đỡ cực!',
        action: 'Khám phá'
      }
    ];

    const DEV_LINKS = [
      { label: 'Telegram', url: 'https://t.me/hungdeptraivip', icon: MessageCircle, color: 'text-sky-500', bgColor: 'bg-sky-500/10' },
      { label: 'Facebook', url: 'https://www.facebook.com/hung.hole.58/', icon: Facebook, color: 'text-blue-600', bgColor: 'bg-blue-600/10' },
      { label: 'Cộng Đồng', url: 'https://zalo.me/g/ngozis331', icon: Users, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
      { label: 'Mua Tài Khoản', url: 'https://tkpremium.cc/', icon: ShoppingBag, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
      { label: 'Zalo', url: 'https://zalo.me/0788658239', icon: Phone, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
    ];

    return (
      <div className="max-w-5xl mx-auto space-y-12">
        {/* Developer Contact Card */}
        <section className="premium-card p-8 space-y-8 relative z-10 hover-glow-primary">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-xl font-black text-slate-800 dark:text-white">Liên hệ Nhà phát triển</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium tracking-wide uppercase opacity-70">Kết nối với Hưng đẹp trai để được hỗ trợ</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-2xl text-primary">
              <Users size={24} />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {DEV_LINKS.map((link) => (
              <motion.a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.08, y: -4 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "flex flex-col items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-700/50 transition-all group",
                  link.label === 'Telegram' ? 'hover-glow-blue' :
                  link.label === 'Facebook' ? 'hover-glow-blue' :
                  link.label === 'Cộng Đồng' ? 'hover-glow-primary' :
                  link.label === 'Mua Tài Khoản' ? 'hover-glow-purple' :
                  'hover-glow-blue'
                )}
              >
                <div className={cn("p-3 rounded-xl transition-colors", link.bgColor, link.color)}>
                  <link.icon size={20} />
                </div>
                <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider group-hover:text-primary transition-colors">{link.label}</span>
              </motion.a>
            ))}
          </div>
        </section>

        <div className="text-center space-y-4 mb-16">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex p-4 bg-primary/10 rounded-3xl text-primary mb-2 shadow-lg shadow-primary/5"
          >
            <Sparkles size={40} />
          </motion.div>
          <h2 className="text-4xl font-black text-slate-800 dark:text-white tracking-tight">Một Số Tool Lỏ Từ Hưng Đẹp Trai</h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto font-medium">Khám phá các công cụ hữu ích khác để tối ưu hóa công việc của bạn.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
          {TOOLS.map((tool) => (
            <motion.button
              key={tool.id}
              whileHover={{ scale: 1.03, y: -5 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedTool(tool)}
              className={cn(
                "flex items-center gap-6 p-6 premium-card text-left group",
                tool.id === 'portfolio' ? 'hover-glow-blue' :
                tool.id === 'font' ? 'hover-glow-purple' :
                tool.id === 'offline' ? 'hover-glow-primary' :
                'hover-glow-primary'
              )}
            >
              <div className={cn("p-5 rounded-2xl transition-transform group-hover:scale-110", tool.bgColor, tool.color)}>
                <tool.icon size={28} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-800 dark:text-white">{tool.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{tool.description}</p>
              </div>
            </motion.button>
          ))}
        </div>

        <AnimatePresence>
          {selectedTool && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedTool(null)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 hover-glow-primary"
              >
                <button 
                  onClick={() => setSelectedTool(null)}
                  className="absolute top-6 right-6 btn-ghost !p-2.5 !rounded-full z-10"
                >
                  <X size={20} />
                </button>

                <div className="p-8 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className={cn("p-4 rounded-2xl", selectedTool.bgColor, selectedTool.color)}>
                      <selectedTool.icon size={32} />
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white">{selectedTool.title}</h3>
                  </div>

                  <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-700/50 space-y-3">
                    {selectedTool.features.map((feature: string, i: number) => (
                      <p key={i} className="text-sm text-slate-600 dark:text-slate-300 font-bold leading-relaxed">
                        {feature}
                      </p>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <p className="text-[11px] text-slate-400 font-bold italic max-w-[200px]">
                      {selectedTool.note}
                    </p>
                    {selectedTool.url ? (
                      <motion.a
                        href={selectedTool.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        className={cn(
                          "btn-primary !px-8",
                          selectedTool.id === 'portfolio' ? 'bg-blue-500 hover-glow-blue' :
                          selectedTool.id === 'font' ? 'bg-purple-500 hover-glow-purple' :
                          selectedTool.id === 'offline' ? 'bg-green-500 hover-glow-primary' :
                          'bg-yellow-500 hover-glow-primary'
                        )}
                      >
                        {selectedTool.action}
                        <ExternalLink size={14} />
                      </motion.a>
                    ) : (
                      <button
                        disabled
                        className="btn-secondary !px-8 opacity-50 cursor-not-allowed"
                      >
                        Sắp cập nhật
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] text-slate-800 dark:text-slate-100 font-sans selection:bg-primary/30 transition-colors duration-500 relative overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-50 px-4 sm:px-8 py-4 pointer-events-none">
        <header className="max-w-[1600px] w-full mx-auto bg-white/80 dark:bg-slate-900/90 border border-slate-200/50 dark:border-slate-800/50 px-5 h-14 flex items-center justify-between shadow-2xl shadow-slate-900/5 dark:shadow-none rounded-2xl transition-all duration-500 relative overflow-hidden pointer-events-auto group/header">
          {/* Subtle Header Glows */}
          <div className="absolute -top-12 -left-12 w-32 h-32 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full pointer-events-none" />
          <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-cyan-500/10 dark:bg-cyan-500/5 rounded-full pointer-events-none" />

          <div className="flex items-center gap-3.5 relative z-10">
            <div className="relative group/logo">
              <div className="absolute -inset-1.5 bg-emerald-500/25 dark:bg-emerald-500/20 rounded-xl opacity-0 group-hover/logo:opacity-100 transition-opacity duration-500" />
              <motion.div 
                whileHover={{ rotate: 8, scale: 1.05 }}
                className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 relative z-10"
              >
                <Zap className="text-white fill-white/10" size={20} />
              </motion.div>
            </div>
            
            <div className="flex flex-col leading-tight">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-[15px] font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-cyan-500 drop-shadow-sm">
                  ĐỔI TÊN <span className="text-slate-400 dark:text-slate-600 font-medium mx-0.5">/</span> <span className="text-slate-600 dark:text-slate-300">Hưng Đẹp Trai</span>
                </h1>
                <span className="hidden md:inline-flex px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-[7px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  PRO
                </span>
              </div>
              <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] flex items-center gap-1.5">
                v2.5.0 <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" /> <span className="opacity-70">Stable Release</span>
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <nav className="hidden md:flex items-center bg-slate-100/50 dark:bg-slate-800/40 p-1 rounded-xl border border-slate-200/40 dark:border-slate-700/40 relative z-10">
            {[
              { id: 'rename', label: 'Đổi tên', icon: LayoutGrid },
              { id: 'write-title', label: 'Viết Title', icon: Type },
              { id: 'info', label: 'Thông tin', icon: Info },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "relative flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-300",
                  activeTab === tab.id 
                    ? "text-slate-900 dark:text-white" 
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                <tab.icon size={14} className={cn(activeTab === tab.id ? "text-emerald-500" : "text-slate-400")} />
                <span>{tab.label}</span>
                {activeTab === tab.id && (
                  <motion.div 
                    layoutId="activeTabIndicator"
                    className="absolute inset-0 bg-white dark:bg-slate-700 shadow-sm rounded-lg -z-10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                {activeTab === tab.id && (
                  <motion.div 
                    layoutId="activeTabGlow"
                    className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                  />
                )}
              </button>
            ))}
          </nav>
          
          <div className="flex items-center gap-3 relative z-10">
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors relative"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={isDarkMode ? 'dark' : 'light'}
                  initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.5, rotate: 90 }}
                  transition={{ duration: 0.2 }}
                >
                  {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                </motion.div>
              </AnimatePresence>
            </motion.button>
          </div>
        </header>
      </div>

      <main className="max-w-[1600px] w-full mx-auto px-4 sm:px-8 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {activeTab === 'rename' && renderRenameTab()}
            {activeTab === 'write-title' && renderWriteTitleTab()}
            {activeTab === 'info' && renderInfoTab()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="max-w-[1600px] w-full mx-auto px-8 py-16 text-center border-t border-slate-100 dark:border-slate-800/50 mt-20">
        <div className="flex flex-col items-center gap-6">
          <div className="space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">© 2026 Tool đổi tên ảnh • v2.5.0</p>
            <p className="text-xs text-slate-500 font-medium max-w-md leading-relaxed mx-auto">
              Xử lý an toàn 100% trên trình duyệt của bạn. Quyền riêng tư của bạn là ưu tiên hàng đầu của chúng tôi.
            </p>
          </div>
        </div>
      </footer>

      <HorseMascotAssistant />
    </div>
  );
}
