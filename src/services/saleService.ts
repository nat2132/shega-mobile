import { insertSale } from '@/database/db';

// Records a whole cart as one batch (shared batchId) and returns that id.
// Used by both the in-app sale flow (sales.tsx) and the standalone
// app/sale-form route so the insert + discount-proration logic lives once.
export const recordSaleBatch = async (
  items: any[],
  saleMetadata: any,
): Promise<string> => {
  const batchId =
    Date.now().toString() + "_" + Math.random().toString(36).substring(2, 8);
  const totalDiscount = Math.max(0, Number(saleMetadata.discount) || 0);
  const totalSubtotal = (items || []).reduce((sum, i) => {
    const price =
      i.unitType === "pack"
        ? parseFloat(i.packSellingPrice) || 0
        : parseFloat(i.baseSellingPrice) || 0;
    return sum + price * Math.max(0, i.quantity || 0);
  }, 0);

  for (const item of items || []) {
    const finalUnitPrice =
      item.unitType === "pack" ? item.packSellingPrice : item.baseSellingPrice;
    const finalUnitLabel =
      item.unitType === "pack" ? item.purchaseUnit : item.baseUnit;
    const lineSubtotal =
      (parseFloat(finalUnitPrice) || 0) * Math.max(0, item.quantity || 0);
    const itemDiscount =
      totalSubtotal > 0
        ? (lineSubtotal / totalSubtotal) * Math.max(0, totalDiscount)
        : 0;
    const discountedTotal = lineSubtotal - itemDiscount;

    await insertSale({
      itemId: item.id,
      quantity: item.quantity,
      unit: finalUnitLabel,
      unitType: item.unitType,
      discount: itemDiscount,
      vat: saleMetadata.vat,
      taxType: saleMetadata.taxType || "VAT",
      totalPrice: discountedTotal,
      paymentMethod: saleMetadata.paymentMethod,
      paymentStatus: saleMetadata.paymentStatus,
      customerName: saleMetadata.customerName,
      customerPhone: saleMetadata.customerPhone,
      dueDate: saleMetadata.dueDate,
      packId: undefined,
      batchId,
    });
  }
  return batchId;
};