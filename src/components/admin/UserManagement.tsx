
import React, { useState, useEffect } from 'react';
import { Edit, Key, Trash2, X, Save, Search, UserPlus } from 'lucide-react';
import { User } from '../../types';
import { supabase } from '../../lib/supabase';
import { DataImporter } from './DataImporter';

interface UserManagementProps {
  currentUser: User | null;
}

const UserManagement: React.FC<UserManagementProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<User>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('name');

      if (error) throw error;

      const usersList = (data || []).map(row => ({
        id: row.id,
        name: row.name,
        username: row.username,
        phone: row.phone || '',
        role: row.role as any,
        branch: row.branch || '',
        email: row.email || '',
        status: row.status as any,
        regDate: row.reg_date || ''
      }));

      setUsers(usersList);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData(user);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        const { error } = await supabase
          .from('users')
          .delete()
          .eq('id', id);

        if (error) throw error;

        setUsers(users.filter(u => u.id !== id));
      } catch (error) {
        console.error(error);
      }
    }
  };

  const handleCreate = () => {
      setEditingUser(null);
      setFormData({
          status: 'Active',
          role: 'User',
          branch: 'Kisii Branch'
      });
      setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const userId = editingUser ? editingUser.id : Date.now().toString();
      const userData = {
        ...formData,
        id: userId,
        regDate: editingUser ? editingUser.regDate : new Date().toISOString().split('T')[0]
      } as User;

      const { error } = await supabase
        .from('users')
        .upsert({
          id: userData.id,
          name: userData.name,
          username: userData.username,
          phone: userData.phone || '',
          role: userData.role,
          branch: userData.branch || '',
          email: userData.email || '',
          status: userData.status,
          reg_date: userData.regDate,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

      if (error) throw error;
      
      if (editingUser) {
        setUsers(users.map(u => u.id === userId ? userData : u));
      } else {
        setUsers([...users, userData]);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="bg-gray-50 min-h-[calc(100vh-80px)] p-4 md:p-8">
      {/* Top Bar matching screenshot style (Blue bar at top of card) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="h-2 bg-blue-800 w-full"></div>
        
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800 uppercase tracking-wide">User Management</h2>
            <button onClick={handleCreate} className="bg-blue-800 text-white px-4 py-2 rounded font-bold text-sm shadow-sm hover:bg-blue-900 flex items-center gap-2">
                <UserPlus size={16} /> Add New User
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs font-bold uppercase tracking-wider border-b border-gray-100">
                  <th className="p-4">Name</th>
                  <th className="p-4">Username</th>
                  <th className="p-4">Tel</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">RegDate</th>
                  <th className="p-4">Active</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-medium text-gray-700 text-sm uppercase">{user.name}</td>
                    <td className="p-4 text-gray-600 text-sm uppercase">{user.username}</td>
                    <td className="p-4 text-gray-600 text-sm">{user.phone}</td>
                    <td className="p-4 text-gray-600 text-sm">{user.role}</td>
                    <td className="p-4 text-gray-600 text-sm">{user.regDate}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${user.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {user.status === 'Active' ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleEdit(user)} className="bg-blue-800 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 hover:bg-blue-900 shadow-sm">
                          <Edit size={12} /> Edit
                        </button>
                        <button className="bg-amber-500 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 hover:bg-amber-600 shadow-sm">
                          <Key size={12} /> Set Pwd
                        </button>
                        <button onClick={() => handleDelete(user.id)} className="bg-red-600 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 hover:bg-red-700 shadow-sm">
                          <Trash2 size={12} /> Del
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Data Importer Section for Match Syncing */}
      {currentUser?.role === 'Super Admin' && (
        <div className="mt-8">
          <DataImporter />
        </div>
      )}

      {/* Edit Modal matching Screenshot 3 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white w-full max-w-4xl rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header Strip */}
            <div className="h-1.5 bg-orange-500 w-full"></div>
            
            <div className="p-8">
              <h3 className="text-xl font-bold text-gray-800 mb-6 border-b border-gray-100 pb-2">
                  {editingUser ? 'Update User Details' : 'Create New User'}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Full Name</label>
                  <input 
                    type="text" 
                    className="w-full p-2.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none uppercase" 
                    value={formData.name || ''} 
                    onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Phone Number</label>
                  <input 
                    type="text" 
                    className="w-full p-2.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none" 
                    value={formData.phone || ''} 
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Username</label>
                  <input 
                    type="text" 
                    className="w-full p-2.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none uppercase" 
                    value={formData.username || ''} 
                    onChange={e => setFormData({...formData, username: e.target.value.toUpperCase()})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Email</label>
                  <input 
                    type="email" 
                    className="w-full p-2.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none" 
                    value={formData.email || ''} 
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Role</label>
                  <select 
                    className="w-full p-2.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                    value={formData.role || 'User'}
                    onChange={e => setFormData({...formData, role: e.target.value as any})}
                  >
                    <option value="Super Admin">Super Admin</option>
                    <option value="Admin">Admin</option>
                    <option value="User">User</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Branch</label>
                  <select 
                    className="w-full p-2.5 border-2 border-orange-400/50 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                    value={formData.branch || 'Kisii Branch'}
                    onChange={e => setFormData({...formData, branch: e.target.value})}
                  >
                    <option value="Kisii Branch">Kisii Branch</option>
                    <option value="Nairobi Branch">Nairobi Branch</option>
                    <option value="Mombasa Branch">Mombasa Branch</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Status</label>
                  <select 
                    className="w-full p-2.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                    value={formData.status || 'Active'}
                    onChange={e => setFormData({...formData, status: e.target.value as any})}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8 border-t border-gray-100 pt-6">
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-6 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-md hover:bg-gray-200 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave} 
                  className="px-6 py-2.5 bg-blue-700 text-white font-bold rounded-md hover:bg-blue-800 transition-colors text-sm shadow-sm"
                >
                  {editingUser ? 'Update Record' : 'Create Record'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;