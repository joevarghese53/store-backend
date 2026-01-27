import mongoose from "mongoose";

const shippingAddressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    isDefault: {
      type: Boolean,
      default: false,
    },

    label: {
      type: String,
      enum: ["Home", "Office", "Other"],
      default: "Home",
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    addressLine1: {
      type: String,
      required: true,
      trim: true,
    },

    addressLine2: {
      type: String,
      trim: true,
    },

    landmark: {
      type: String,
      trim: true,
    },

    city: {
      type: String,
      required: true,
      trim: true,
    },

    state: {
      type: String,
      required: true,
      trim: true,
    },

    postalCode: {
      type: String,
      required: true,
      match: [/^[1-9][0-9]{5}$/, "Invalid postal code"],
    },

    phoneNumber: {
      type: String,
      required: true,
      trim: true,
      match: [/^[6-9][0-9]{9}$/, "Invalid phone number"],
    },

    country: {
      type: String,
      default: "India",
      immutable: true,
    },
  },
  { timestamps: true }
);

shippingAddressSchema.index(
  { user: 1, isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true } }
);

shippingAddressSchema.pre("save", async function (next) {
  if (!this.isDefault) return next();

  await this.constructor.updateMany(
    { user: this.user, _id: { $ne: this._id } },
    { $set: { isDefault: false } }
  );

  next();
});

shippingAddressSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate();

  const isDefault =
    update?.isDefault === true ||
    update?.$set?.isDefault === true;

  if (!isDefault) return next();

  const doc = await this.model.findOne(this.getQuery());
  if (!doc) return next();

  await this.model.updateMany(
    { user: doc.user, _id: { $ne: doc._id } },
    { $set: { isDefault: false } }
  );

  next();
});

export default mongoose.model("ShippingAddress", shippingAddressSchema);


// ------------------- Checked --------------------