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
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';
import { RenameOptions, FileItem, RenameSummary } from './types';
import { applyRenameRules, resolveDuplicates, cleanFilenameForAi } from './lib/renameLogic';
import { cn } from './lib/utils';

const SUPPORTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'];

export default function App() {
  const [files, setFiles] = useState<FileItem[]>([]);
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

  // AI Feature State
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [randomSuffixes, setRandomSuffixes] = useState('');
  const [isRandomSuffixEnabled, setIsRandomSuffixEnabled] = useState(false);
  const [aiImage, setAiImage] = useState<File | null>(null);
  const [aiImagePreview, setAiImagePreview] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<{ product_type: string, base_title: string, final_title: string } | null>(null);
  const [aiCleanedName, setAiCleanedName] = useState('');
  const [aiSelectedSuffix, setAiSelectedSuffix] = useState('');
  const [aiFinalTitle, setAiFinalTitle] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isApiKeyHelpOpen, setIsApiKeyHelpOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<any | null>(null);

  // AI Usage Tracking
  const [apiKeyUsage, setApiKeyUsage] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('api_key_usage');
    return saved ? JSON.parse(saved) : {};
  });

  const hashKey = (key: string) => {
    if (!key) return '';
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  };

  const currentKeyHash = hashKey(geminiApiKey);
  const currentUsage = geminiApiKey ? (apiKeyUsage[currentKeyHash] || 0) : 0;
  const isLimitReached = currentUsage >= 50;

  // Tabs State
  const [activeTab, setActiveTab] = useState<'rename' | 'ai' | 'info'>('rename');

  useEffect(() => {
    localStorage.setItem('api_key_usage', JSON.stringify(apiKeyUsage));
  }, [apiKeyUsage]);

  useEffect(() => {
    localStorage.setItem('gemini_api_key', geminiApiKey);
  }, [geminiApiKey]);

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

  // AI Feature Logic
  const handleAiImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAiImage(file);
      setAiImagePreview(URL.createObjectURL(file));
      setAiCleanedName(cleanFilenameForAi(file.name));
      setAiResult(null);
      setAiFinalTitle('');
      setAiSelectedSuffix('');
    }
  };

  const getAiPrompt = (cleanedName: string) => {
    return `
      Analyze this image and the original filename context: "${cleanedName}".
      Generate a clean, natural English e-commerce title for this product.
      
      Rules:
      - Identify the product type from the image.
      - Understand the design theme and key features.
      - Generate a natural, high-converting English e-commerce title.
      - Avoid keyword stuffing and repeating words.
      - Avoid inventing details that are not visible in the image.
      - Use the filename only as supportive context, not absolute truth.
      
      Output in JSON format:
      {
        "product_type": "string (e.g., 'T-shirt', 'Sneakers')",
        "base_title": "string (The core product name)",
        "final_title": "string (The optimized, full e-commerce title in English)"
      }
    `;
  };

  const generateAiTitle = async () => {
    if (!aiImage) return;
    
    if (geminiApiKey && isLimitReached) {
      setAiError('API Key này đã đạt giới hạn 50 ảnh trong ứng dụng.');
      return;
    }

    setIsAiLoading(true);
    setAiError(null);

    try {
      const prompt = getAiPrompt(aiCleanedName);
      const imagePart = await fileToGenerativePart(aiImage);
      
      const response = await fetch('/api/generate-title', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: imagePart.inlineData.data,
          mimeType: imagePart.inlineData.mimeType,
          prompt,
          userApiKey: geminiApiKey || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Lỗi khi gọi API AI');
      }

      const parsed = await response.json();
      setAiResult(parsed);
      
      // Update usage only if user provided their own key
      if (geminiApiKey) {
        setApiKeyUsage(prev => ({
          ...prev,
          [currentKeyHash]: (prev[currentKeyHash] || 0) + 1
        }));
      }
      
      // Handle random suffix
      let suffix = '';
      if (isRandomSuffixEnabled && randomSuffixes.trim()) {
        const lines = randomSuffixes.split('\n').filter(l => l.trim());
        if (lines.length > 0) {
          suffix = lines[Math.floor(Math.random() * lines.length)].trim();
        }
      }
      
      setAiSelectedSuffix(suffix);
      setAiFinalTitle(`${parsed.final_title}${suffix ? ' ' + suffix : ''}`);
    } catch (error: any) {
      console.error('AI Error:', error);
      setAiError('Có lỗi xảy ra khi gọi AI. Vui lòng kiểm tra lại API Key hoặc kết nối mạng.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const applyAiTitleToRename = () => {
    if (!aiFinalTitle || !aiImage) return;
    
    // Find if this file is already in the list
    const existingFileIndex = files.findIndex(f => f.oldName === aiImage.name);
    
    if (existingFileIndex !== -1) {
      setFiles(prev => {
        const newFiles = [...prev];
        const item = newFiles[existingFileIndex];
        const ext = item.extension;
        newFiles[existingFileIndex] = {
          ...item,
          newName: aiFinalTitle + '.' + ext,
          status: 'renamed'
        };
        return newFiles;
      });
    } else {
      // Add as new file
      const dotIndex = aiImage.name.lastIndexOf('.');
      const ext = aiImage.name.substring(dotIndex + 1);
      
      const newItem: FileItem = {
        id: Math.random().toString(36).substring(7),
        file: aiImage,
        oldName: aiImage.name,
        newName: aiFinalTitle + '.' + ext,
        extension: ext,
        thumbnail: aiImagePreview!,
        status: 'renamed'
      };
      setFiles(prev => [...prev, newItem]);
    }
  };

  async function fileToGenerativePart(file: File) {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        resolve(base64.split(',')[1]);
      };
      reader.readAsDataURL(file);
    });
    return {
      inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
  }

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

  const Toggle = ({ checked, onChange, label }: { checked: boolean, onChange: (val: boolean) => void, label: string }) => (
    <label className="toggle-container group">
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
      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 group-hover:text-primary transition-colors">
        {label}
      </span>
    </label>
  );

  const renderRenameTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative z-10">
      {/* Left Column: Controls */}
      <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
        <section className="premium-card p-8 hover-glow-primary">
          <h2 className="text-sm font-bold mb-8 flex items-center gap-3 text-slate-800 dark:text-white">
            <div className="p-2.5 bg-primary/10 rounded-xl shadow-inner shadow-primary/5">
              <Settings2 size={18} className="text-primary" />
            </div>
            Quy tắc đổi tên
          </h2>
          
          <div className="space-y-6">
            <div className="space-y-4 group">
              <div className="group">
                <label className="label-premium group-focus-within:text-primary">Thêm vào đầu</label>
                <input 
                  type="text" 
                  value={options.prefix}
                  onChange={e => setOptions({...options, prefix: e.target.value})}
                  className="input-field"
                  placeholder="VD: nam-"
                />
              </div>

              <div className="group">
                <label className="label-premium group-focus-within:text-primary">Thêm vào cuối</label>
                <input 
                  type="text" 
                  value={options.suffix}
                  onChange={e => setOptions({...options, suffix: e.target.value})}
                  className="input-field"
                  placeholder="VD: -mau-1"
                />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="group">
                <label className="label-premium group-focus-within:text-primary">Dấu phân cách</label>
                <div className="relative">
                  <select 
                    value={options.separator}
                    onChange={e => setOptions({...options, separator: e.target.value as any})}
                    className="select-field"
                  >
                    <option value=" ">Khoảng trắng</option>
                    <option value="-">Dấu gạch ngang (-)</option>
                    <option value="_">Dấu gạch dưới (_)</option>
                    <option value=".">Dấu chấm (.)</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <ChevronDown size={16} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="group">
                  <label className="label-premium group-focus-within:text-primary">Tìm kiếm</label>
                  <input 
                    type="text" 
                    value={options.findText}
                    onChange={e => setOptions({...options, findText: e.target.value})}
                    className="input-field"
                    placeholder="Từ..."
                  />
                </div>
                <div className="group">
                  <label className="label-premium group-focus-within:text-primary">Thay thế</label>
                  <input 
                    type="text" 
                    value={options.replaceText}
                    onChange={e => setOptions({...options, replaceText: e.target.value})}
                    className="input-field"
                    placeholder="Bằng..."
                  />
                </div>
              </div>

              <div className="group">
                <label className="label-premium group-focus-within:text-primary">Xóa chuỗi (mỗi dòng 1 chuỗi)</label>
                <textarea 
                  rows={2}
                  onChange={e => setOptions({...options, removeFragments: e.target.value.split('\n')})}
                  className="textarea-field"
                  placeholder="Nhập các từ cần xóa..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Toggle 
                checked={options.removeOldNumbering.start}
                onChange={val => setOptions({...options, removeOldNumbering: {...options.removeOldNumbering, start: val}})}
                label="Xóa số thứ tự cũ ở đầu"
              />
              <Toggle 
                checked={options.removeOldNumbering.end}
                onChange={val => setOptions({...options, removeOldNumbering: {...options.removeOldNumbering, end: val}})}
                label="Xóa số thứ tự cũ ở cuối"
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
                    className="grid grid-cols-2 gap-4 pl-8 overflow-hidden"
                  >
                    <div className="space-y-2 group">
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
                    <div className="space-y-2 group">
                      <label className="label-premium !mb-1 !text-[9px]">Bắt đầu từ</label>
                      <input 
                        type="number" 
                        value={options.addNewNumbering.startNumber}
                        onChange={e => setOptions({...options, addNewNumbering: {...options.addNewNumbering, startNumber: parseInt(e.target.value) || 1}})}
                        className="input-field !py-2 !px-3 !text-xs"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-4">
          <motion.button 
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={previewRename}
            disabled={files.length === 0}
            className="btn-secondary"
          >
            <Eye size={18} />
            Xem trước
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={runRename}
            disabled={files.length === 0 || isProcessing}
            className="btn-primary"
          >
            {isProcessing ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Play size={18} />
                Thực hiện
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* Right Column: File List */}
      <div className="lg:col-span-8 space-y-8">
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
          <div className="premium-card p-12 flex flex-col items-center justify-center gap-6 group-hover:border-primary group-hover:bg-primary/5 hover-glow-primary transition-all duration-500 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-lg shadow-primary/10 relative z-10">
              <Upload className="text-primary" size={32} />
            </div>
            <div className="text-center space-y-2 relative z-10">
              <p className="text-xl font-black text-slate-800 dark:text-white">Kéo thả hoặc nhấn để chọn ảnh</p>
              <p className="text-xs text-slate-400 font-medium tracking-wide">Hỗ trợ: JPG, PNG, WEBP, GIF, BMP, AVIF</p>
            </div>
          </div>
        </motion.div>

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

        {/* ZIP Filename & Export */}
        <AnimatePresence>
          {files.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="premium-card p-8 flex flex-col md:flex-row md:items-end gap-8 hover-glow-blue"
            >
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-xl">
                    <Download className="text-blue-500" size={20} />
                  </div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">Xuất file ZIP</h3>
                </div>
                <div className="space-y-2 group">
                  <label className="label-premium group-focus-within:text-primary">Tên file ZIP khi tải về</label>
                  <input 
                    type="text" 
                    value={zipFilename}
                    onChange={e => setZipFilename(e.target.value)}
                    className="input-field focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder="Ví dụ: anh-da-doi-ten"
                  />
                </div>
              </div>
              <div className="flex-1 space-y-4">
                <div className="bg-blue-500/5 p-4 rounded-2xl border border-blue-500/10">
                  <p className="text-[11px] text-blue-500/80 font-medium italic">Tự động nén tất cả ảnh đã đổi tên vào 1 file ZIP duy nhất.</p>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={exportZip}
                  className="btn-primary bg-blue-500 hover:bg-blue-600 hover-glow-blue"
                >
                  <Download size={20} />
                  Tải ZIP ngay
                </motion.button>
              </div>
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
              <thead className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-20 border-b border-slate-100 dark:border-slate-800">
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

  const renderAiTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative z-10">
      {/* Left Column: AI Configuration */}
      <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
        <section className="premium-card p-8 hover-glow-purple">
          <h2 className="text-sm font-bold mb-8 flex items-center gap-3 text-slate-800 dark:text-white">
            <div className="p-2.5 bg-purple-500/10 rounded-xl shadow-inner shadow-purple-500/5">
              <Settings size={18} className="text-purple-500" />
            </div>
            Cấu hình API
          </h2>

          <div className="space-y-6">
            <div className="group">
              <label className="label-premium group-focus-within:text-purple-500">Gemini API Key (Tùy chọn)</label>
              <input 
                type="password" 
                value={geminiApiKey}
                onChange={e => setGeminiApiKey(e.target.value)}
                className="input-field focus:ring-purple-500/20 focus:border-purple-500"
                placeholder="Nhập API Key của bạn (hoặc dùng mặc định)..."
              />
              <p className="text-[9px] text-slate-400 mt-2 ml-1 italic">Key được lưu cục bộ trên trình duyệt. Nếu để trống, ứng dụng sẽ dùng Key hệ thống.</p>
            </div>

            {/* API Key Guidance */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800">
              <button 
                onClick={() => setIsApiKeyHelpOpen(!isApiKeyHelpOpen)}
                className="w-full flex items-center justify-between p-4 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                <div className="flex items-center gap-2">
                  <HelpCircle size={14} className="text-purple-500" />
                  Hướng dẫn lấy API Key
                </div>
                {isApiKeyHelpOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              <AnimatePresence>
                {isApiKeyHelpOpen && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-4 pb-4 space-y-3"
                  >
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 flex gap-2">
                        <span className="font-black text-purple-500">B1:</span> Vào Google AI Studio
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 flex gap-2">
                        <span className="font-black text-purple-500">B2:</span> Đăng nhập tài khoản Google
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 flex gap-2">
                        <span className="font-black text-purple-500">B3:</span> Tạo hoặc lấy Gemini API Key
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 flex gap-2">
                        <span className="font-black text-purple-500">B4:</span> Dán API Key vào ô bên trên
                      </p>
                    </div>
                    <p className="text-[10px] text-slate-400 italic bg-purple-500/5 p-2 rounded-lg border border-purple-500/10">
                      Mỗi API Key được dùng tối đa 50 ảnh trong ứng dụng này.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* API Key Usage Progress */}
            {geminiApiKey && (
              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sử dụng API Key cá nhân</p>
                  <p className="text-[10px] font-black text-purple-500">
                    {`Đã dùng: ${currentUsage} / 50 ảnh`}
                  </p>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner-soft">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((currentUsage / 50) * 100, 100)}%` }}
                    className={cn(
                      "h-full transition-all duration-500",
                      isLimitReached ? "bg-red-500" : "bg-purple-500"
                    )}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-[9px] text-slate-400 font-medium">
                    {`Còn lại: ${Math.max(50 - currentUsage, 0)} ảnh`}
                  </p>
                  <p className="text-[9px] font-black text-slate-400">{Math.min(Math.round((currentUsage / 50) * 100), 100)}%</p>
                </div>
                {isLimitReached && (
                  <p className="text-[10px] text-red-500 font-bold text-center bg-red-50 dark:bg-red-500/10 py-2 rounded-lg border border-red-500/20">
                    API Key này đã đạt giới hạn 50 ảnh trong ứng dụng.
                  </p>
                )}
              </div>
            )}
            {!geminiApiKey && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="bg-purple-500/5 p-4 rounded-2xl border border-purple-500/10">
                  <p className="text-[10px] text-purple-600 dark:text-purple-400 font-medium italic">Đang sử dụng API Key hệ thống (Bảo mật & Ổn định).</p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Right Column: AI Workspace */}
      <div className="lg:col-span-8 space-y-8">
        <section className="premium-card p-8 min-h-[400px] flex flex-col hover-glow-purple">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Image + Input Area */}
            <div className="space-y-6">
              <div className="relative group/upload h-64">
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleAiImageSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="h-full border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-6 flex flex-col items-center justify-center gap-3 bg-slate-50/50 dark:bg-slate-950 group-hover/upload:border-purple-500 group-hover/upload:bg-purple-500/5 transition-all shadow-inner-soft">
                  {aiImagePreview ? (
                    <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-md">
                      <img src={aiImagePreview} alt="Preview" className="w-full h-full object-contain bg-slate-100 dark:bg-slate-800" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/upload:opacity-100 transition-opacity">
                        <p className="text-white text-xs font-bold">Thay đổi ảnh</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center">
                        <FileImage className="text-purple-500" size={32} />
                      </div>
                      <p className="text-sm font-bold text-slate-500">Chọn ảnh phân tích</p>
                      <p className="text-[10px] text-slate-400">Kéo thả ảnh vào đây</p>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Toggle 
                  checked={isRandomSuffixEnabled}
                  onChange={val => setIsRandomSuffixEnabled(val)}
                  label="Thêm đuôi ngẫu nhiên"
                />

                <AnimatePresence>
                  {isRandomSuffixEnabled && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden pl-12"
                    >
                      <textarea 
                        rows={3}
                        value={randomSuffixes}
                        onChange={e => setRandomSuffixes(e.target.value)}
                        className="textarea-field focus:ring-purple-500/20 focus:border-purple-500 !text-xs"
                        placeholder="Mỗi dòng 1 đuôi..."
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Actions & Context */}
            <div className="space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner-soft">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Thông tin ảnh</p>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate">{aiImage?.name || 'Chưa chọn ảnh'}</p>
                </div>
                
                {aiImage && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-purple-500/5 rounded-2xl border border-purple-500/10 shadow-inner-soft"
                  >
                    <p className="text-[9px] font-bold text-purple-400 uppercase tracking-widest mb-2">Tên đã làm sạch (Context)</p>
                    <p className="text-xs font-black text-purple-600 dark:text-purple-400">{aiCleanedName}</p>
                  </motion.div>
                )}
              </div>

              <div className="space-y-3">
                <motion.button 
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={generateAiTitle}
                  disabled={!aiImage || isAiLoading || isLimitReached}
                  className="btn-primary bg-purple-500 hover:bg-purple-600 hover-glow-purple"
                >
                  {isAiLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Sparkles size={20} />
                      Viết title AI
                    </>
                  )}
                </motion.button>

                {aiError && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-500/20"
                  >
                    <p className="text-[10px] text-red-500 font-bold text-center leading-relaxed">{aiError}</p>
                  </motion.div>
                )}
              </div>
            </div>
          </div>

          {/* Result Preview Area */}
          <AnimatePresence>
            {aiResult && !isAiLoading && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="mt-12 pt-12 border-t border-slate-100 dark:border-slate-800 space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="p-6 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Phân tích sản phẩm</p>
                        <div className="px-2 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-lg uppercase">
                          {aiResult?.product_type}
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Title gốc gợi ý</p>
                        <p className="text-sm font-bold text-slate-600 dark:text-slate-400 leading-relaxed">{aiResult?.base_title}</p>
                      </div>
                      
                      <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Title AI tối ưu (English)</p>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => {
                              navigator.clipboard.writeText(aiResult?.final_title || '');
                            }}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-primary transition-all"
                            title="Copy title"
                          >
                            <Copy size={12} />
                          </motion.button>
                        </div>
                        <p className="text-base font-black text-slate-800 dark:text-white leading-relaxed">{aiResult?.final_title}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {aiSelectedSuffix && (
                      <div className="p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10 flex items-center justify-between">
                        <div>
                          <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-1">Đuôi random được chọn</p>
                          <p className="text-xs font-black text-blue-600 dark:text-blue-400">{aiSelectedSuffix}</p>
                        </div>
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                          <Zap size={14} />
                        </div>
                      </div>
                    )}
                    
                    <div className="p-6 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-3xl border border-purple-500/20 shadow-inner relative group">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[9px] font-bold text-purple-500 uppercase tracking-widest">Title cuối cùng</p>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => {
                            navigator.clipboard.writeText(aiFinalTitle);
                          }}
                          className="p-2 hover:bg-purple-500/10 rounded-lg text-purple-400 hover:text-purple-600 transition-all"
                          title="Copy title cuối cùng"
                        >
                          <Copy size={14} />
                        </motion.button>
                      </div>
                      <p className="text-lg font-black text-purple-600 dark:text-purple-300 leading-relaxed">{aiFinalTitle}</p>
                    </div>

                    <motion.button 
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={applyAiTitleToRename}
                      className="btn-primary bg-slate-900 dark:bg-white text-white dark:text-slate-900 !shadow-none"
                    >
                      <Wand2 size={20} />
                      Dùng title này để đổi tên
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
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

        <motion.div 
          whileHover={{ scale: 1.01 }}
          className="bg-slate-100 dark:bg-primary/10 text-slate-900 dark:text-primary p-10 rounded-[3rem] flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200/50 dark:border-white/5"
        >
          <div className="space-y-2 text-center md:text-left">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-primary/50">Phiên bản hiện tại</p>
            <p className="text-3xl font-black italic tracking-tight">v2.5.0 Premium AI</p>
          </div>
          <div className="flex gap-6">
            <div className="text-center px-8 py-4 bg-white dark:bg-white/5 rounded-3xl backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-sm">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-primary/50 mb-1">Trạng thái</p>
              <p className="text-base font-black">Ổn định</p>
            </div>
            <div className="text-center px-8 py-4 bg-white dark:bg-white/5 rounded-3xl backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-sm">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-primary/50 mb-1">Bảo mật</p>
              <p className="text-base font-black">Local Only</p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] text-slate-800 dark:text-slate-100 font-sans selection:bg-primary/30 transition-colors duration-500 relative overflow-hidden">
      {/* Animated Background Blobs */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/15 dark:bg-primary/10 rounded-full blur-[140px] animate-blob" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-500/15 dark:bg-blue-500/10 rounded-full blur-[140px] animate-blob animation-delay-2000" />
        <div className="absolute top-[30%] left-[20%] w-[40%] h-[40%] bg-purple-500/10 dark:bg-purple-500/5 rounded-full blur-[140px] animate-blob animation-delay-4000" />
        <div className="absolute inset-0 bg-slate-50/50 dark:bg-[#020617]/50 backdrop-blur-[2px]" />
      </div>

      {/* Header */}
      <div className="sticky top-0 z-50 px-4 sm:px-8 py-4 pointer-events-none">
        <header className="max-w-7xl mx-auto bg-white/80 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 px-5 h-14 flex items-center justify-between shadow-2xl shadow-slate-900/5 dark:shadow-none rounded-2xl transition-all duration-500 relative overflow-hidden pointer-events-auto group/header">
          {/* Subtle Header Glows */}
          <div className="absolute -top-12 -left-12 w-32 h-32 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-[60px] pointer-events-none" />
          <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-cyan-500/10 dark:bg-cyan-500/5 rounded-full blur-[60px] pointer-events-none" />

          <div className="flex items-center gap-3.5 relative z-10">
            <div className="relative group/logo">
              <div className="absolute -inset-1.5 bg-emerald-500/25 dark:bg-emerald-500/20 rounded-xl blur-md opacity-0 group-hover/logo:opacity-100 transition-opacity duration-500" />
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
              { id: 'ai', label: 'AI Title', icon: Sparkles },
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

      <main className="max-w-7xl mx-auto p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {activeTab === 'rename' && renderRenameTab()}
            {activeTab === 'ai' && renderAiTab()}
            {activeTab === 'info' && renderInfoTab()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-8 py-16 text-center border-t border-slate-100 dark:border-slate-800/50 mt-20">
        <div className="flex flex-col items-center gap-6">
          <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center group hover:rotate-12 transition-transform">
            <FileImage className="text-slate-400 group-hover:text-primary transition-colors" size={24} />
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">© 2026 Tool đổi tên ảnh • v2.5.0</p>
            <p className="text-xs text-slate-500 font-medium max-w-md leading-relaxed mx-auto">
              Xử lý an toàn 100% trên trình duyệt của bạn. Quyền riêng tư của bạn là ưu tiên hàng đầu của chúng tôi.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
