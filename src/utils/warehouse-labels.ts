export const translateWarehouseName = (t: (key: string, params?: Record<string, string>) => string, name?: string | null) =>
  name === 'Main Warehouse' ? t('inv.main_warehouse') : (name ?? '');

export const translateWarehouseLocation = (t: (key: string, params?: Record<string, string>) => string, location?: string | null) =>
  location === 'Default Location' ? t('inv.default_location') : (location ?? '');
