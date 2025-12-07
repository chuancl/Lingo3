
import React, { useState } from 'react';
import { AnkiConfig } from '../../types';
import { DEFAULT_ANKI_CONFIG } from '../../constants';
import { Monitor, Code, HelpCircle, Zap } from 'lucide-react';

const Tooltip: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => {
  return (
    <div className="group relative flex items-center">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-slate-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-lg max-w-[200px] whitespace-normal text-center">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800"></div>
      </div>
    </div>
  );
};

export const AnkiSection: React.FC = () => {
  const [ankiConfig, setAnkiConfig] = useState<AnkiConfig>(DEFAULT_ANKI_CONFIG);
  const [activeTemplate, setActiveTemplate] = useState<'front' | 'back'>('front');

  const insertVariable = (variable: string) => {
     const key = activeTemplate === 'front' ? 'frontTemplate' : 'backTemplate';
     setAnkiConfig({
        ...ankiConfig,
        templates: {
           ...ankiConfig.templates,
           [key]: ankiConfig.templates[key as keyof typeof ankiConfig.templates] + variable
        }
     });
  };

  const variables = [
     { code: '{{word}}', desc: '当前单词拼写' },
     { code: '{{phonetic}}', desc: '音标' },
     { code: '{{translation}}', desc: '中文释义 (Contextual)' },
     { code: '{{def_cn}}', desc: '单词通用中文释义' },
     { code: '{{def_context}}', desc: '单词在原文中的特定释义' },
     { code: '{{sentence}}', desc: '完整原句' },
     { code: '{{sentence-a}}', desc: '原句-前 (挖孔用)' },
     { code: '{{sentence-e}}', desc: '原句-后 (挖孔用)' },
     { code: '{{paragraph}}', desc: '完整段落' },
     { code: '{{paragraph-a}}', desc: '段落-前 (挖孔用)' },
     { code: '{{paragraph-e}}', desc: '段落-后 (挖孔用)' },
     { code: '{{mixed_sentence}}', desc: '中英混合例句' },
     { code: '{{mixed_sentence-a}}', desc: '混合句-前' },
     { code: '{{mixed_sentence-e}}', desc: '混合句-后' },
     { code: '{{source_url}}', desc: '来源网址链接' }
  ];

  // Mock Data for Preview
  const word = "ephemeral";
  const sentence = "Fashion is by nature ephemeral, changing with the seasons.";
  const paragraph = "The concept of beauty is constantly evolving. Fashion is by nature ephemeral, changing with the seasons. What is considered stylish today may be outdated tomorrow.";
  const mixed = "时尚本质上是 ephemeral (短暂) 的，随季节而变。";

  // Split Logic for Preview
  const splitStr = (str: string, key: string) => {
     const idx = str.indexOf(key);
     if (idx === -1) return { a: '', e: '' };
     return {
        a: str.substring(0, idx),
        e: str.substring(idx + key.length)
     };
     
  };

  const sSplit = splitStr(sentence, word);
  const pSplit = splitStr(paragraph, word);
  const mSplit = splitStr(mixed, word);

  const previewData = {
     word: word,
     phonetic: '/əˈfem(ə)rəl/',
     translation: '短暂的',
     def_cn: 'adj. 短暂的；朝生暮死的',
     def_context: '短暂的',
     sentence: sentence,
     'sentence-a': sSplit.a,
     'sentence-e': sSplit.e,
     paragraph: paragraph,
     'paragraph-a': pSplit.a,
     'paragraph-e': pSplit.e,
     mixed_sentence: mixed,
     'mixed_sentence-a': mSplit.a,
     'mixed_sentence-e': mSplit.e,
     source_url: 'https://example.com'
  };

  const getPreviewHtml = () => {
     let tmpl = activeTemplate === 'front' ? ankiConfig.templates.frontTemplate : ankiConfig.templates.backTemplate;
     
     // Replace longer keys first to avoid partial matches
     const keys = Object.keys(previewData).sort((a, b) => b.length - a.length);
     
     keys.forEach((key) => {
        tmpl = tmpl.replace(new RegExp(`{{${key}}}`, 'g'), (previewData as any)[key]);
     });
     return tmpl;
  };

  return (
    <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-800">Anki 集成</h2>
            <p className="text-sm text-slate-500">连接 AnkiConnect 以实现增量导入与复习进度同步。</p>
        </div>
        <div className="p-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="space-y-5">
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">AnkiConnect 地址</label>
                    <input 
                      type="text" 
                      value={ankiConfig.url}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      placeholder="http://127.0.0.1:8765"
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">目标牌组 (Deck Name)</label>
                    <input 
                      type="text" 
                      value={ankiConfig.deckName}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">同步内容范围</label>
                    <div className="flex gap-4">
                      <label className="flex items-center text-sm cursor-pointer">
                        <input type="checkbox" checked={ankiConfig.syncScope.wantToLearn} className="rounded text-blue-600 mr-2" /> 想学习
                      </label>
                      <label className="flex items-center text-sm cursor-pointer">
                        <input type="checkbox" checked={ankiConfig.syncScope.learning} className="rounded text-blue-600 mr-2" /> 正在学
                      </label>
                    </div>
                 </div>
              </div>
              <div className="space-y-5">
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">自动掌握阈值 (天)</label>
                    <div className="flex items-center gap-3">
                       <input 
                         type="number" 
                         value={ankiConfig.syncInterval}
                         className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                       />
                       <span className="text-xs text-slate-500">
                         若 Anki 复习间隔大于此天数，<br/>单词将自动移入“已掌握”。
                       </span>
                    </div>
                 </div>
                 <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                    <h4 className="text-sm font-bold text-blue-800 mb-2 flex items-center"><Monitor className="w-4 h-4 mr-2"/> 同步说明</h4>
                    <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                      <li>单向新增：仅向 Anki 添加新词，不删除已有卡片。</li>
                      <li>智能去重：根据单词和释义自动避免重复创建。</li>
                      <li>双向状态：Anki 复习进度会同步回本插件。</li>
                    </ul>
                 </div>
              </div>
           </div>
           
           {/* Templates Editor */}
           <div className="border-t border-slate-100 pt-6">
              <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center">
                 <Code className="w-4 h-4 mr-2"/> 
                 卡片模板配置
                 <Tooltip text="使用左侧变量构建 HTML 模板。AnkiConnect 将渲染此 HTML 为卡片正面和背面。">
                    <HelpCircle className="w-4 h-4 ml-2 text-slate-400 cursor-help" />
                 </Tooltip>
              </h3>
              
              <div className="flex space-x-2 mb-4">
                 <button 
                   onClick={() => setActiveTemplate('front')}
                   className={`px-4 py-2 text-sm rounded-lg border ${activeTemplate === 'front' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}
                 >
                   正面模板 (Front)
                 </button>
                 <button 
                   onClick={() => setActiveTemplate('back')}
                   className={`px-4 py-2 text-sm rounded-lg border ${activeTemplate === 'back' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}
                 >
                   背面模板 (Back)
                 </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-96">
                 {/* Editor */}
                 <div className="flex flex-col h-full">
                    <div className="flex flex-wrap gap-2 mb-2 max-h-24 overflow-y-auto p-1">
                       {variables.map(v => (
                          <Tooltip key={v.code} text={v.desc}>
                             <button 
                               onClick={() => insertVariable(v.code)}
                               className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] rounded border border-slate-200 font-mono transition"
                             >
                               {v.code}
                             </button>
                          </Tooltip>
                       ))}
                    </div>
                    <div className="relative flex-1">
                        <textarea 
                           className="w-full h-full p-4 font-mono text-xs bg-slate-900 text-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                           value={activeTemplate === 'front' ? ankiConfig.templates.frontTemplate : ankiConfig.templates.backTemplate}
                           onChange={(e) => {
                              const key = activeTemplate === 'front' ? 'frontTemplate' : 'backTemplate';
                              setAnkiConfig({...ankiConfig, templates: {...ankiConfig.templates, [key]: e.target.value}});
                           }}
                        />
                        <div className="absolute bottom-2 right-2 text-[10px] text-slate-500">HTML Supported</div>
                    </div>
                 </div>

                 {/* Live Preview */}
                 <div className="flex flex-col h-full">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center">
                        <Zap className="w-3 h-3 mr-1"/> 实时预览 (Mock Data)
                    </div>
                    <div className="flex-1 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50 p-4 overflow-auto relative">
                        <div 
                           className="prose prose-sm max-w-none"
                           dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
                        />
                        {/* Inline styles for preview context */}
                        <style>{`
                           .card { font-family: sans-serif; text-align: center; color: #333; padding: 10px; }
                           .word { font-size: 24px; font-weight: bold; margin-bottom: 8px; color: #1e293b; }
                           .phonetic { font-family: monospace; color: #64748b; margin-bottom: 16px; }
                           .sentence { font-style: italic; color: #475569; margin-top: 8px; }
                           .meaning { margin: 10px 0; font-weight: bold; color: #0f172a; }
                           .context-paragraph { text-align: left; font-size: 0.9em; color: #64748b; margin-top: 16px; line-height: 1.6; }
                        `}</style>
                    </div>
                 </div>
              </div>
           </div>
        </div>
    </section>
  );
};
