// controllers/cProductController.js
import cProduct from "../models/cProductModel.js";
import asyncHandler from "../middlewares/asyncHandler.js";

const addToCProducts = asyncHandler(async (req, res) => {

  try {
    const { name, description, price, category, offers, returnpolicy } = req.fields;
    console.log(req.fields);
    // Validation
    switch (true) {
      case !name:
        return res.status(400).json({ error: "Name is required" });
      case !description:
        return res.status(400).json({ error: "Description is required" });
      case !price:
        return res.status(400).json({ error: "Price is required" });
      case !category:
        return res.status(400).json({ error: "Category is required" });
      case !offers:
        return res.status(400).json({ error: "Offers are required" });
      case !returnpolicy:
        return res.status(400).json({ error: "Return Policy is required" });
    }

    const customProduct = { ...req.fields };

    let cProductContainer = await cProduct.findOne({ userId: req.user._id });

    if (cProductContainer) {

      console.log(`Custom Product Container found, adding new custom product`);
      cProductContainer.customProducts.push(customProduct);

    } else {

      console.log(`Custom Product Container not found, creating a new container with custom product`);
      cProductContainer = new cProduct({
        userId: req.user._id,
        customProducts: [customProduct],
      });
    }


    await cProductContainer.save();
    res.status(201).json(cProductContainer);
    console.log(cProductContainer);

  } catch (error) {
    console.log(error);
    res.status(400).json({ error: error.message });
  }

});

const getCProducts = asyncHandler(async (req, res) => {
  try {
    const cProductContainer = await cProduct.findOne({ userId: req.user._id }).populate("customProducts.category")
    .sort({ createAt: -1 });

    if (!cProductContainer) {
      return res.status(404).json({ message: "No custom products found for this user" });
    }

    res.status(200).json(cProductContainer);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Server error while fetching products" });
  }
});

const deleteCProduct = asyncHandler(async (req, res) => {
  try {
    const { productId } = req.params;

    let cProductContainer = await cProduct.findOne({ userId: req.user._id });

    if (!cProductContainer) {
      return res.status(404).json({ message: "Custom product container not found for this user" });
    }

    const productIndex = cProductContainer.customProducts.findIndex(
      (product) => product._id.toString() === productId
    );

    if (productIndex === -1) {
      return res.status(404).json({ message: "Product not found" });
    }

    cProductContainer.customProducts.splice(productIndex, 1); // Remove product from the array

    await cProductContainer.save();

    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Server error while deleting the product" });
  }
});

const fetchCProductById = asyncHandler(async (req, res) => {
  try {
    const { productId } = req.params;
    console.log("This is the prod id",productId);

    let cProductContainer = await cProduct.findOne({ userId: req.user._id }).populate("customProducts.category", "name");

    console.log(cProductContainer);

    if (!cProductContainer) {
      return res.status(404).json({ message: "Custom product container not found for this user" });
    }

    const product = cProductContainer.customProducts.find(
      (product) => product._id.toString() === productId
    );

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const modifiedProduct = {
      ...product.toObject(), // Convert Mongoose document to plain JS object
      category: product.category.name // Replace category with just its name
    };

    res.status(200).json(modifiedProduct);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Server error while fetching the product" });
  }
}
);

export { addToCProducts, getCProducts, deleteCProduct, fetchCProductById };