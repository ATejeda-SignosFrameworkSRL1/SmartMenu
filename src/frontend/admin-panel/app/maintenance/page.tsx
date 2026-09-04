'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Plus,
  X,
  Pencil,
  Trash2,
  MapPin,
  ChefHat,
  Wine,
  RefreshCw,
  Power,
  Tag,
  Link2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '',
});

type ZoneType = 'Dining' | 'Kitchen' | 'Bar';
type ActiveTab = ZoneType | 'Tags';

interface Zone {
  id: number;
  name: string;
  type: string;
  description: string | null;
  restaurantId: number;
  isActive: boolean;
  tableCount: number;
  availableTables: number;
}

interface DishTag {
  id: number;
  code: string;
  label: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
}

type TabConfigItem = { key: ZoneType; label: string; icon: any; color: string; description: string };

export default function MaintenancePage() {
  const t = useTranslations('maintenance');

  const TAB_CONFIG: TabConfigItem[] = [
    { key: 'Dining', label: t('tabs.dining'), icon: MapPin, color: 'bg-blue-500', description: t('tabs.diningDesc') },
    { key: 'Kitchen', label: t('tabs.kitchen'), icon: ChefHat, color: 'bg-orange-500', description: t('tabs.kitchenDesc') },
    { key: 'Bar', label: t('tabs.bar'), icon: Wine, color: 'bg-purple-500', description: t('tabs.barDesc') },
  ];

  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('Dining');
  const [showModal, setShowModal] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });

  interface TableItem { id: number; tableNumber: number; capacity: number; zoneName: string; status: string; }
  const [allTables, setAllTables] = useState<TableItem[]>([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkingZone, setLinkingZone] = useState<Zone | null>(null);

  const [tags, setTags] = useState<DishTag[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [editingTag, setEditingTag] = useState<DishTag | null>(null);
  const [tagForm, setTagForm] = useState({ label: '', icon: '', sortOrder: 0 });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const FOOD_EMOJIS = [

    '🌶️','🔥','💥','⚡','🫑','🧨',

    '🌱','🌾','🥬','🥑','🫘','🫛','🥦','🥕',

    '⭐','🌟','🏆','✨','👑','💎','❤️','🆕',

    '🥜','🥛','🐟','🧀','🥚','🍯','🧄','🧅',

    '👨‍🍳','🍳','🫕','🥘','🍽️','🔪',

    '🍖','🥩','🍗','🥓','🍤','🦞',

    '🫐','🍋','🫚','🌿','🍄','🧆',

    '🏷️','📌','🔖','🎯','💚','💛','🧡',
  ];

  const g = (obj: any, key: string) => obj?.[key] ?? obj?.[key.charAt(0).toUpperCase() + key.slice(1)] ?? '';

  const loadZones = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const res = await api.get('/api/zone');
      setZones(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Error loading zones:', error);
      toast.error(t('errors.loadData'));
    } finally {
      setLoading(false);
    }
  };

  const loadTables = async () => {
    try {
      const res = await api.get('/api/table');
      const raw: any[] = Array.isArray(res.data) ? res.data : [];
      setAllTables(raw.map(t => ({
        id:          t.id ?? t.Id,
        tableNumber: t.tableNumber ?? t.TableNumber,
        capacity:    t.capacity ?? t.Capacity,
        zoneName:    t.zoneName ?? t.ZoneName ?? '',
        status:      t.status ?? t.Status ?? '',
      })));
    } catch {
      console.error('Error loading tables');
    }
  };

  const loadTags = async () => {
    try {
      const res = await api.get('/api/dishtag');
      const raw: any[] = Array.isArray(res.data) ? res.data : [];

      setTags(raw.map(t => ({
        id:        t.id        ?? t.Id,
        code:      t.code      ?? t.Code      ?? '',
        label:     t.label     ?? t.Label     ?? '',
        icon:      t.icon      ?? t.Icon      ?? '🏷️',
        sortOrder: t.sortOrder ?? t.SortOrder ?? 0,
        isActive:  t.isActive  ?? t.IsActive  ?? false,
      })));
    } catch {
      toast.error(t('errors.loadTags'));
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      window.location.href = '/login';
      return;
    }
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    loadZones();
    loadTables();
    loadTags();
  }, []);

  const openCreateTag = () => {
    setEditingTag(null);
    setTagForm({ label: '', icon: '🏷️', sortOrder: tags.length });
    setShowEmojiPicker(false);
    setShowTagModal(true);
  };

  const openEditTag = (tag: DishTag) => {
    setEditingTag(tag);
    setTagForm({ label: tag.label, icon: tag.icon, sortOrder: tag.sortOrder });
    setShowEmojiPicker(false);
    setShowTagModal(true);
  };

  const handleSaveTag = async () => {
    if (!tagForm.label.trim()) { toast.error(t('errors.nameRequired')); return; }
    try {
      if (editingTag) {
        await api.put(`/api/dishtag/${editingTag.id}`, tagForm);
        toast.success(t('success.tagUpdated'));
      } else {
        await api.post('/api/dishtag', tagForm);
        toast.success(t('success.tagCreated'));
      }
      setShowTagModal(false);
      loadTags();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || t('errors.saveTag'));
    }
  };

  const handleDeleteTag = async (tag: DishTag) => {
    if (!confirm(t('confirm.deleteTag', { label: tag.label }))) return;
    try {
      await api.delete(`/api/dishtag/${tag.id}`);
      toast.success(t('success.tagDeleted'));
      loadTags();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || t('errors.deleteTag'));
    }
  };

  const handleToggleTag = async (tag: DishTag) => {
    try {
      await api.put(`/api/dishtag/${tag.id}/toggle`);
      loadTags();
    } catch {
      toast.error(t('errors.toggleStatus'));
    }
  };

  const filteredZones = zones.filter(z => {
    const type = g(z, 'type') || 'Dining';
    return type === activeTab;
  });

  const openCreateModal = () => {
    setEditingZone(null);
    setForm({ name: '', description: '' });
    setShowModal(true);
  };

  const openEditModal = (zone: Zone) => {
    setEditingZone(zone);
    setForm({ name: g(zone, 'name'), description: g(zone, 'description') || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error(t('errors.nameRequired'));
      return;
    }

    try {
      if (editingZone) {
        await api.put(`/api/zone/${editingZone.id}`, {
          name: form.name,
          description: form.description || null,
        });
        toast.success(t('success.updated'));
      } else {
        await api.post('/api/zone', {
          name: form.name,
          type: activeTab,
          description: form.description || null,
          restaurantId: 1,
        });
        toast.success(t('success.zoneCreated', { type: getTypeLabel(activeTab) }));
      }
      setShowModal(false);
      loadZones();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || t('errors.save'));
    }
  };

  const handleDelete = async (zone: Zone) => {
    const label = getTypeLabel(g(zone, 'type') || 'Dining').toLowerCase();
    if (!confirm(t('confirm.deleteZone', { type: label, name: g(zone, 'name') }))) return;
    try {
      await api.delete(`/api/zone/${zone.id}`);
      toast.success(t('success.deleted'));
      loadZones();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || t('errors.delete'));
    }
  };

  const handleToggle = async (zone: Zone) => {
    try {
      await api.put(`/api/zone/${zone.id}/toggle`);
      toast.success(g(zone, 'isActive') ? t('success.deactivated') : t('success.activated'));
      loadZones();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || t('errors.toggleStatus'));
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'Kitchen': return t('typeLabel.kitchen');
      case 'Bar': return t('typeLabel.bar');
      default: return t('typeLabel.zone');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Kitchen': return ChefHat;
      case 'Bar': return Wine;
      default: return MapPin;
    }
  };

  const getTablesForZone = (zoneName: string) =>
    allTables.filter(t => t.zoneName === zoneName);

  const getUnassignedOrOtherTables = (currentZoneName: string) =>
    allTables.filter(t => t.zoneName !== currentZoneName);

  const assignTableToZone = async (tableId: number, zoneId: number) => {
    try {
      await api.put(`/api/table/${tableId}`, { zoneId });
      toast.success(t('success.tableAssigned'));
      loadTables();
      loadZones();
    } catch {
      toast.error(t('errors.assignTable'));
    }
  };

  const currentTabConfig = TAB_CONFIG.find(t => t.key === activeTab) ?? TAB_CONFIG[0];

  return (
    <MainLayout title={t('pageTitle')} subtitle={t('pageSubtitle')}>
      <div className="space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t('pageTitle')}</h1>
            <p className="text-muted-foreground">{t('pageDescription')}</p>
          </div>
          <Button onClick={loadZones} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('actions.refresh')}
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {TAB_CONFIG.map(tab => {
            const count = zones.filter(z => (g(z, 'type') || 'Dining') === tab.key).length;
            const Icon = tab.icon;
            return (
              <Card
                key={tab.key}
                className={cn(
                  'border-2 cursor-pointer transition-all hover:shadow-md',
                  activeTab === tab.key ? 'border-primary shadow-md' : 'border-muted'
                )}
                onClick={() => setActiveTab(tab.key)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold">{count}</div>
                      <p className="text-xs text-muted-foreground">{tab.label}</p>
                    </div>
                    <div className={cn('p-3 rounded-lg text-white', tab.color)}>
                      <Icon className="h-6 w-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <Card
            className={cn(
              'border-2 cursor-pointer transition-all hover:shadow-md',
              activeTab === 'Tags' ? 'border-primary shadow-md' : 'border-muted'
            )}
            onClick={() => setActiveTab('Tags')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{tags.length}</div>
                  <p className="text-xs text-muted-foreground">{t('tabs.tags')}</p>
                </div>
                <div className="p-3 rounded-lg text-white bg-rose-500">
                  <Tag className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {activeTab === 'Tags' ? null : <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {(() => { const Icon = currentTabConfig.icon; return <Icon className="h-5 w-5" />; })()}
                  {currentTabConfig.label} ({filteredZones.length})
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">{currentTabConfig.description}</p>
              </div>
              <Button onClick={openCreateModal}>
                <Plus className="h-4 w-4 mr-2" />
                {activeTab === 'Kitchen' ? t('actions.newKitchen') : activeTab === 'Bar' ? t('actions.newBar') : t('actions.newZone')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t('loading')}</p>
              </div>
            ) : filteredZones.length === 0 ? (
              <div className="text-center py-12">
                {(() => { const Icon = currentTabConfig.icon; return <Icon className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />; })()}
                <p className="text-lg text-muted-foreground">
                  {activeTab === 'Kitchen' ? t('empty.noKitchens') : activeTab === 'Bar' ? t('empty.noBars') : t('empty.noZones')}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeTab === 'Kitchen' ? t('empty.createKitchenHint') : activeTab === 'Bar' ? t('empty.createBarHint') : t('empty.createZoneHint')}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredZones.map(zone => {
                  const Icon = getTypeIcon(g(zone, 'type'));
                  const isActive = g(zone, 'isActive') !== false;

                  return (
                    <div
                      key={zone.id}
                      className={cn(
                        'border-2 rounded-lg p-4 transition-all',
                        isActive ? 'border-border' : 'border-muted opacity-60'
                      )}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={cn('p-2 rounded-lg text-white', currentTabConfig.color)}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{g(zone, 'name')}</h3>
                            {g(zone, 'description') && (
                              <p className="text-xs text-muted-foreground">{g(zone, 'description')}</p>
                            )}
                          </div>
                        </div>
                        <Badge variant={isActive ? 'default' : 'secondary'} className="text-xs">
                          {isActive ? t('status.active') : t('status.inactive')}
                        </Badge>
                      </div>

                      {activeTab === 'Dining' && (() => {
                        const zoneTables = getTablesForZone(g(zone, 'name'));
                        return (
                          <div className="mb-3">
                            <div className="text-sm text-muted-foreground mb-2">
                              {t('tables.assigned', { count: zoneTables.length })}
                            </div>
                            {zoneTables.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {zoneTables.map(tbl => (
                                  <span key={tbl.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200">
                                    {t('tables.tableChip', { number: tbl.tableNumber, capacity: tbl.capacity })}
                                  </span>
                                ))}
                              </div>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full text-blue-600 border-blue-200 hover:bg-blue-50"
                              onClick={() => { setLinkingZone(zone); setShowLinkModal(true); }}
                            >
                              <Link2 className="h-3.5 w-3.5 mr-1" />
                              {t('actions.manageTables')}
                            </Button>
                          </div>
                        );
                      })()}

                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditModal(zone)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          {t('actions.edit')}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleToggle(zone)} title={isActive ? t('actions.deactivate') : t('actions.activate')}>
                          <Power className={cn('h-3.5 w-3.5', isActive ? 'text-green-500' : 'text-gray-400')} />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(zone)} className="text-destructive hover:text-destructive" title={t('actions.delete')}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>}

        {activeTab === 'Tags' && <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  {t('tagsSection.title', { count: tags.length })}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('tagsSection.description')}
                </p>
              </div>
              <Button onClick={openCreateTag}>
                <Plus className="h-4 w-4 mr-2" />
                {t('actions.newTag')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {tags.length === 0 ? (
              <div className="text-center py-12">
                <Tag className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
                <p className="text-lg text-muted-foreground">{t('empty.noTags')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('empty.createTagHint')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tags.map(tag => (
                  <div
                    key={tag.id}
                    className={cn(
                      'border-2 rounded-lg p-4 transition-all',
                      tag.isActive ? 'border-border' : 'border-muted opacity-60'
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-rose-100 text-rose-700 text-lg leading-none">
                          {tag.icon}
                        </div>
                        <div>
                          <h3 className="font-semibold">{tag.label}</h3>
                          <p className="text-xs text-muted-foreground font-mono">{tag.code}</p>
                        </div>
                      </div>
                      <Badge variant={tag.isActive ? 'default' : 'secondary'} className="text-xs">
                        {tag.isActive ? t('status.active') : t('status.inactive')}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditTag(tag)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        {t('actions.edit')}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleToggleTag(tag)} title={tag.isActive ? t('actions.deactivate') : t('actions.activate')}>
                        <Power className={cn('h-3.5 w-3.5', tag.isActive ? 'text-green-500' : 'text-gray-400')} />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDeleteTag(tag)} className="text-destructive hover:text-destructive" title={t('actions.delete')}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>}
      </div>

      {showTagModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowTagModal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{editingTag ? t('modal.editTag') : t('modal.createTag')}</h2>
              <button onClick={() => setShowTagModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">

              <div>
                <label className="block text-sm font-medium mb-1">{t('form.icon')}</label>
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(p => !p)}
                  className="w-full flex items-center gap-3 px-3 py-2 border rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700 transition-colors"
                >
                  <span className="text-3xl leading-none">{tagForm.icon || '🏷️'}</span>
                  <span className="text-sm text-muted-foreground">{showEmojiPicker ? t('form.closeIconPicker') : t('form.selectIcon')}</span>
                </button>
                {showEmojiPicker && (
                  <div className="mt-2 p-3 border rounded-xl bg-white dark:bg-gray-800 dark:border-gray-700 shadow-md">
                    <div className="grid grid-cols-8 gap-1">
                      {FOOD_EMOJIS.map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => { setTagForm({ ...tagForm, icon: emoji }); setShowEmojiPicker(false); }}
                          className={cn(
                            'text-2xl p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors leading-none',
                            tagForm.icon === emoji && 'bg-primary/10 ring-2 ring-primary'
                          )}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t('form.nameRequired')}</label>
                <input
                  type="text"
                  value={tagForm.label}
                  onChange={e => setTagForm({ ...tagForm, label: e.target.value })}
                  placeholder={t('form.tagNamePlaceholder')}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t('form.sortOrder')}</label>
                <input
                  type="number"
                  value={tagForm.sortOrder}
                  onChange={e => setTagForm({ ...tagForm, sortOrder: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                  min={0}
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowTagModal(false)}>{t('actions.cancel')}</Button>
                <Button className="flex-1" onClick={handleSaveTag}>{editingTag ? t('actions.save') : t('actions.create')}</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLinkModal && linkingZone && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowLinkModal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-lg w-full p-6 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{t('modal.tablesOfZone', { name: g(linkingZone, 'name') })}</h2>
              <button onClick={() => setShowLinkModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-4">

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">{t('modal.tablesInZone')}</h3>
                {getTablesForZone(g(linkingZone, 'name')).length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">{t('modal.noTablesAssigned')}</p>
                ) : (
                  <div className="space-y-2">
                    {getTablesForZone(g(linkingZone, 'name')).map(tbl => (
                      <div key={tbl.id} className="flex items-center justify-between p-2 rounded-lg border bg-blue-50 border-blue-200">
                        <span className="text-sm font-medium">{t('modal.tableRow', { number: tbl.tableNumber, capacity: tbl.capacity, status: tbl.status })}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">{t('modal.assignFromOtherZone')}</h3>
                {getUnassignedOrOtherTables(g(linkingZone, 'name')).length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">{t('modal.noTablesAvailable')}</p>
                ) : (
                  <div className="space-y-2">
                    {getUnassignedOrOtherTables(g(linkingZone, 'name')).map(tbl => (
                      <div key={tbl.id} className="flex items-center justify-between p-2 rounded-lg border hover:bg-gray-50">
                        <span className="text-sm">{t('modal.otherTableRow', { number: tbl.tableNumber, capacity: tbl.capacity })} — <span className="text-muted-foreground">{tbl.zoneName || t('modal.noZone')}</span></span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-blue-600 border-blue-200 hover:bg-blue-50"
                          onClick={() => assignTableToZone(tbl.id, linkingZone.id)}
                        >
                          <Link2 className="h-3.5 w-3.5 mr-1" />
                          {t('actions.assign')}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4">
              <Button variant="outline" className="w-full" onClick={() => setShowLinkModal(false)}>{t('actions.close')}</Button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">
                {editingZone ? t('modal.editZoneTitle', { type: getTypeLabel(activeTab) }) : t('modal.createZoneTitle', { type: getTypeLabel(activeTab) })}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('form.nameRequired')}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder={
                    activeTab === 'Kitchen' ? t('form.kitchenNamePlaceholder')
                    : activeTab === 'Bar' ? t('form.barNamePlaceholder')
                    : t('form.zoneNamePlaceholder')
                  }
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('form.description')}</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder={
                    activeTab === 'Kitchen' ? t('form.kitchenDescPlaceholder')
                    : activeTab === 'Bar' ? t('form.barDescPlaceholder')
                    : t('form.zoneDescPlaceholder')
                  }
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 resize-none"
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}>
                  {t('actions.cancel')}
                </Button>
                <Button className="flex-1" onClick={handleSave}>
                  {editingZone ? t('actions.saveChanges') : t('actions.create')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
