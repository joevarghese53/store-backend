import mongoose from "mongoose";

const shippingAddressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  label: {
    type: String,
    enum: ["Home", "Office", "Other"],
    default: "Home"
  },
  fullName: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true,
  },
  city: {
    type: String,
    required: true,
  },
  postalCode: {
    type: String,
    required: true,
    match: [/^[1-9][0-9]{5}$/, "Invalid postal code"], // Indian PIN validation
  },
  state: {
    type: String,
    required: true,
  },
  country: {
    type: String,
    required: true,
  },
  phoneno: {
    type: String,
    required: true,
    match: [/^[6-9][0-9]{9}$/, "Invalid phone number"], // 10-digit Indian numbers
  }
}, { timestamps: true });

shippingAddressSchema.pre("save", async function (next) {
  if (this.isDefault) {
    // Set all other addresses for this user to false
    await this.constructor.updateMany(
      { user: this.user, _id: { $ne: this._id } },
      { $set: { isDefault: false } }
    );
  }
  next();
});

shippingAddressSchema.index({ user: 1 });

export default mongoose.model("ShippingAddress", shippingAddressSchema);
