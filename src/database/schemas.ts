import { Schema, InferSchemaType } from 'mongoose';

export const medicineTypes = [
  'Injection',
  'Syrup',
  'Tablet',
  'Capsule',
  'Ointments & Creams',
  'Sprays',
  'Drops',
  'Effervescent Tablets',
  'Sachets',
] as const;
export const permissions = [
  'products:read',
  'products:write',
  'customers:read',
  'customers:write',
  'orders:read',
  'orders:write',
  'dashboard:read',
  'challans:read',
  'challans:write',
] as const;

export const RoleSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    permissions: { type: [String], required: true },
  },
  { timestamps: true },
);
export type Role = InferSchemaType<typeof RoleSchema>;

export const UserSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, required: true, default: 'admin' },
    active: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);
export type User = InferSchemaType<typeof UserSchema>;

export const ProductSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: medicineTypes, required: true },
    strength: { type: String, default: '' },
    company: { type: String, default: '' },
    purchasePriceCents: { type: Number, required: true, min: 0 },
    salePriceCents: { type: Number, required: true, min: 0 },
    discountType: {
      type: String,
      enum: ['percent', 'fixed'],
      default: 'percent',
      required: true,
    },
    discountValue: { type: Number, default: 0, required: true },
    stock: { type: Number, required: true, min: 0 },
    quantityPerPacking: { type: Number, required: true, min: 1, default: 1 },
    alarmType: {
      type: String,
      enum: ['packing', 'quantity'],
      required: true,
      default: 'quantity',
    },
    alarmLimit: { type: Number, required: true, min: 0 },
    alarmStockThreshold: { type: Number, required: true, min: 0, default: 0 },
    version: { type: Number, default: 0, required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
ProductSchema.index({ name: 1, _id: 1 });
ProductSchema.index({ type: 1, name: 1 });
export type Product = InferSchemaType<typeof ProductSchema>;

export const ExpenseSchema = new Schema(
  {
    date: { type: Date, required: true, index: true },
    category: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: '', trim: true, maxlength: 300 },
    amountCents: { type: Number, required: true, min: 1 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
ExpenseSchema.index({ deletedAt: 1, date: -1 });
export type Expense = InferSchemaType<typeof ExpenseSchema>;

export const CustomerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    balanceCents: { type: Number, default: 0, required: true, min: 0 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
CustomerSchema.index({ name: 1, _id: 1 });
export type Customer = InferSchemaType<typeof CustomerSchema>;

const ItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    strength: { type: String, default: '' },
    quantity: { type: Number, required: true },
    quantityPerPacking: { type: Number, required: true, min: 1, default: 1 },
    company: { type: String, default: '' },
    unitPriceCents: { type: Number, required: true },
    purchasePriceCents: { type: Number, default: null, min: 0 },
    discountType: { type: String, enum: ['percent', 'fixed'], required: true },
    discountValue: { type: Number, required: true },
    netUnitPriceCents: { type: Number, required: true },
    totalCents: { type: Number, required: true },
  },
  { _id: false },
);
const StatusEventSchema = new Schema(
  {
    status: {
      type: String,
      enum: ['paid', 'partial', 'pending'],
      required: true,
    },
    at: { type: Date, required: true },
    receivedCents: { type: Number, required: true },
  },
  { _id: false },
);
export const OrderSchema = new Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    requestId: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, required: true },
    customerName: { type: String, required: true },
    customerAddress: { type: String, default: '' },
    customerPhone: { type: String, default: '' },
    remarks: { type: String, default: '' },
    items: { type: [ItemSchema], required: true },
    subtotalCents: { type: Number, required: true },
    profitCents: { type: Number, default: null },
    discountCents: { type: Number, required: true },
    totalCents: { type: Number, required: true },
    previousPendingCents: { type: Number, required: true },
    grandTotalCents: { type: Number, required: true },
    receivedCents: { type: Number, required: true },
    remainingCents: { type: Number, required: true },
    status: {
      type: String,
      enum: ['paid', 'partial', 'pending'],
      required: true,
    },
    statusUpdatedAt: { type: Date, required: true },
    statusHistory: { type: [StatusEventSchema], default: [] },
    version: { type: Number, default: 0, required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
OrderSchema.index({ deletedAt: 1, createdAt: -1 });
OrderSchema.index({ customerId: 1, deletedAt: 1, createdAt: -1 });
OrderSchema.index({ status: 1, deletedAt: 1, createdAt: -1 });
export type Order = InferSchemaType<typeof OrderSchema>;
