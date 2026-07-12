import React, { useState, useEffect } from 'react';
import { InventoryEquipment } from '../types';
import { getInventory, addInventoryItem, updateInventoryItem } from '../services/api';
import { Settings, Plus, Box, Search, Tag } from 'lucide-react';

const InventoryTracker: React.FC = () => {
    const [inventory, setInventory] = useState<InventoryEquipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [showAddModal, setShowAddModal] = useState(false);

    const loadInventory = async () => {
        setLoading(true);
        const data = await getInventory();
        setInventory(data);
        setLoading(false);
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadInventory();
    }, []);

    const handleAddItem = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        
        const newItem = {
            type: formData.get('type') as string,
            model: formData.get('model') as string,
            status: formData.get('status') as 'available' | 'in_use' | 'maintenance_needed',
            notes: formData.get('notes') as string
        };

        const result = await addInventoryItem(newItem);
        if (result) {
            setInventory([...inventory, result]);
            setShowAddModal(false);
        }
    };

    const handleUpdateStatus = async (id: string, status: InventoryEquipment['status']) => {
        const item = inventory.find(i => i.id === id);
        if (!item) return;

        // Optimistic update
        setInventory(inventory.map(i => i.id === id ? { ...i, status } : i));
        
        await updateInventoryItem(id, { status });
    };

    const filteredInventory = inventory.filter(item => {
        if (filterStatus !== 'all' && item.status !== filterStatus) return false;
        if (search && !item.model.toLowerCase().includes(search.toLowerCase()) && !item.id.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const getStatusColor = (status: string) => {
        switch(status) {
            case 'available': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
            case 'in_use': return 'text-brand-cyan bg-brand-cyan/10 border-brand-cyan/20';
            case 'maintenance_needed': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
            default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
        }
    };

    return (
        <div className="p-8 h-full flex flex-col space-y-6 animate-fade-in max-w-7xl mx-auto">
            <header className="flex justify-between items-center bg-slate-900 border border-white/10 p-6 rounded-2xl shadow-xl">
                <div className="flex items-center space-x-4">
                    <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
                        <Box size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white">Global Inventory</h1>
                        <p className="text-sm text-slate-400 font-medium mt-1">Manage, dispatch, and maintain equipment</p>
                    </div>
                </div>
                <button 
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center px-4 py-2 bg-brand-cyan hover:bg-cyan-400 text-slate-900 rounded-lg font-bold transition-all shadow-lg shadow-brand-cyan/20"
                >
                    <Plus size={18} className="mr-2" />
                    Add Equipment
                </button>
            </header>

            <div className="flex space-x-4 items-center">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Search by ID or Model..." 
                        className="w-full bg-slate-900 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-white font-medium focus:ring-2 focus:ring-brand-cyan focus:outline-none"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <select 
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="bg-slate-900 border border-white/10 text-white font-medium py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-cyan"
                >
                    <option value="all">All Statuses</option>
                    <option value="available">Available</option>
                    <option value="in_use">In Use</option>
                    <option value="maintenance_needed">Maintenance Needed</option>
                </select>
            </div>

            <div className="flex-1 bg-slate-900 border border-white/10 rounded-2xl shadow-xl overflow-hidden flex flex-col relative">
                {loading && (
                    <div className="absolute inset-0 z-10 flex flex-col justify-center items-center bg-slate-900/50 backdrop-blur-sm">
                         <div className="animate-spin w-8 h-8 border-4 border-brand-cyan border-t-transparent rounded-full mb-4"></div>
                         <p className="text-slate-400 font-medium uppercase tracking-widest text-xs">Loading Inventory</p>
                    </div>
                )}
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/5 border-b border-white/10 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                                <th className="p-4">ID</th>
                                <th className="p-4">Model & Type</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Assigned Project</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredInventory.map(item => (
                                <tr key={item.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center space-x-2">
                                            <Tag size={14} className="text-slate-500" />
                                            <span className="font-mono text-sm text-slate-300 font-bold">{item.id}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <p className="text-white font-bold">{item.model}</p>
                                        <p className="text-xs text-slate-500 font-medium mt-0.5">{item.type}</p>
                                    </td>
                                    <td className="p-4">
                                        <select 
                                            value={item.status}
                                            onChange={(e) => handleUpdateStatus(item.id, e.target.value as 'available' | 'in_use' | 'maintenance_needed')}
                                            className={`text-xs font-bold px-2 py-1 rounded-md border appearance-none cursor-pointer focus:outline-none ${getStatusColor(item.status)}`}
                                        >
                                            <option value="available">Available</option>
                                            <option value="in_use">In Use</option>
                                            <option value="maintenance_needed">Maintenance</option>
                                        </select>
                                    </td>
                                    <td className="p-4">
                                        {item.status === 'in_use' ? (
                                            <span className="text-xs text-blue-400 font-bold flex items-center">
                                                {item.currentProjectId || 'Unknown Project'}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-slate-600 font-medium flex items-center">-</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        <button className="p-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg transition-colors">
                                            <Settings size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {!loading && filteredInventory.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center">
                                        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Box size={24} className="text-slate-500" />
                                        </div>
                                        <p className="text-slate-400 font-medium">No inventory items found.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Modal */}
            {showAddModal && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                     <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
                         <div className="p-6 border-b border-white/10">
                             <h2 className="text-xl font-bold text-white flex items-center">
                                 <Plus className="mr-2 text-brand-cyan" /> Add New Equipment
                             </h2>
                         </div>
                         <form onSubmit={handleAddItem} className="p-6 space-y-4">
                             <div>
                                 <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Equipment Type</label>
                                 <select name="type" required className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-brand-cyan outline-none">
                                     <option value="Dehumidifier">Dehumidifier</option>
                                     <option value="Air Mover">Air Mover</option>
                                     <option value="HEPA Scrubber">HEPA Scrubber</option>
                                     <option value="Heater">Heater</option>
                                 </select>
                             </div>
                             <div>
                                 <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Model Name</label>
                                 <input type="text" name="model" required placeholder="e.g. Dri-Eaz LGR 7000XLi" className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-brand-cyan outline-none" />
                             </div>
                             <div>
                                 <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Initial Status</label>
                                 <select name="status" required className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-brand-cyan outline-none">
                                     <option value="available">Available</option>
                                     <option value="in_use">In Use</option>
                                     <option value="maintenance_needed">Needs Maintenance</option>
                                 </select>
                             </div>
                             <div>
                                 <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Notes</label>
                                 <textarea name="notes" placeholder="Optional notes" className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-brand-cyan outline-none resize-none h-24"></textarea>
                             </div>
                             <div className="flex justify-end space-x-3 pt-4 border-t border-white/10">
                                 <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold transition-colors">Cancel</button>
                                 <button type="submit" className="px-4 py-2 bg-brand-cyan hover:bg-cyan-400 text-slate-900 rounded-lg font-bold transition-colors">Add Equipment</button>
                             </div>
                         </form>
                     </div>
                 </div>
            )}
        </div>
    );
};

export default InventoryTracker;
