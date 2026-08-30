// Shared cart/line math reused across the sale flow (pending cart, checkout,
// add-product screens). Kept in one place so price/unit/stock logic never drifts.

export const getLinePrice = (item: any): number =>
  parseFloat(item.unitType === "pack" ? item.packSellingPrice : item.baseSellingPrice) || 0;

export const getLineUnitLabel = (item: any): string | undefined =>
  item.unitType === "pack" ? item.purchaseUnit : item.baseUnit;

export const getLineStock = (item: any): number =>
  Math.floor(
    item.unitType === "pack"
      ? item.totalPackQuantity || 0
      : item.totalBaseQuantity || 0,
  );

export const calcLineTotal = (item: any): number =>
  getLinePrice(item) * Math.max(0, item.quantity || 0);

export const cartSubtotal = (items: any[]): number =>
  (Array.isArray(items) ? items : []).reduce((sum, i) => sum + calcLineTotal(i), 0);

export const cartUnitCount = (items: any[]): number =>
  (Array.isArray(items) ? items : []).reduce(
    (sum, i) => sum + Math.max(0, i.quantity || 0),
    0,
  );