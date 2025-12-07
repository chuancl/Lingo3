
import React from 'react';

export const Dashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">学习概览</h2>
        <span className="text-sm text-slate-500">最后同步: 今天 14:20</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-2xl shadow-lg shadow-blue-200 text-white">
          <h3 className="text-sm font-medium opacity-80 uppercase tracking-wider">词汇总量</h3>
          <p className="text-4xl font-bold mt-2">2,259</p>
          <div className="mt-4 flex items-center text-sm bg-white/20 w-fit px-2 py-1 rounded">
             <span className="font-bold mr-1">+12</span> 本周新增
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">活跃学习中</h3>
          <p className="text-4xl font-bold text-slate-900 mt-2">109</p>
          <div className="mt-4 text-sm text-orange-600 font-medium">
             14 个待今日复习
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Anki 同步率</h3>
          <p className="text-4xl font-bold text-slate-900 mt-2">98%</p>
          <div className="mt-4 text-sm text-slate-400">
             自动同步开启
          </div>
        </div>
      </div>
    </div>
  );
};
