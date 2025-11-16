import Category from "../models/categoryModel.js";
import asyncHandler from "../middlewares/asyncHandler.js";

// @desc    Create a new category
// @route   POST /api/category
// @access  Admin
const createCategory = asyncHandler(async (req, res) => {
  let { name } = req.body;

  name = name?.trim();
  if (!name) {
    return res.status(400).json({ message: "Name is required" });
  }

  // Case-insensitive check
  const existingCategory = await Category.findOne({
    name: { $regex: new RegExp(`^${name}$`, "i") },
  });

  if (existingCategory) {
    return res.status(409).json({ message: "Category already exists" });
  }

  const category = await Category.create({ name });
  res.status(201).json(category);
});

// @desc    Update a category
// @route   PUT /api/category/:id
// @access  Admin
const updateCategory = asyncHandler(async (req, res) => {
  const { name } = req.body;
  const { id } = req.params;

  if (!name?.trim()) {
    return res.status(400).json({ message: "Name is required" });
  }

  const category = await Category.findById(id);

  if (!category) {
    return res.status(404).json({ message: "Category not found" });
  }

  category.name = name.trim();
  const updatedCategory = await category.save();

  res.json(updatedCategory);
});

// @desc    Delete a category
// @route   DELETE /api/category/:id
// @access  Admin
const removeCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const removed = await Category.findByIdAndDelete(id);

  if (!removed) {
    return res.status(404).json({ message: "Category not found" });
  }

  res.json({ message: "Category removed", category: removed });
});

// @desc    Get all categories
// @route   GET /api/category
// @access  Public
const listCategory = asyncHandler(async (req, res) => {
  const all = await Category.find({}).sort({ name: 1 });
  res.json(all);
});

// @desc    Get single category
// @route   GET /api/category/:id
// @access  Public
const readCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const category = await Category.findById(id);

  if (!category) {
    return res.status(404).json({ message: "Category not found" });
  }

  res.json(category);
});

export {
  createCategory,
  updateCategory,
  removeCategory,
  listCategory,
  readCategory,
};
