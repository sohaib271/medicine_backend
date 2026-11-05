import { InferSchemaType, Schema } from 'mongoose';

const WarrantyItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    strength: { type: String, default: '' },
    company: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 1 },
    quantityPerPacking: { type: Number, required: true, min: 1 },
    unitPriceCents: { type: Number, required: true, min: 0 },
    discountType: { type: String, enum: ['percent', 'fixed'], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    netUnitPriceCents: { type: Number, required: true, min: 0 },
    totalCents: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

export const WarrantySchema = new Schema(
  {
    warrantyNumber: { type: String, required: true, unique: true },
    requestId: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, required: true },
    customerName: { type: String, required: true },
    customerAddress: { type: String, default: '' },
    customerPhone: { type: String, default: '' },
    customerLicenseNumber: { type: String, default: '' },
    items: { type: [WarrantyItemSchema], required: true },
    subtotalCents: { type: Number, required: true },
    discountCents: { type: Number, required: true },
    overallDiscountCents: { type: Number, required: true, min: 0 },
    totalCents: { type: Number, required: true },
    remarks: { type: String, default: '' },
    version: { type: Number, required: true, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
WarrantySchema.index({ deletedAt: 1, createdAt: -1 });
export type Warranty = InferSchemaType<typeof WarrantySchema>;
