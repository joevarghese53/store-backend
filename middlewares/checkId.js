import { isValidObjectId } from "mongoose";

function checkId(req, res, next) {
  const id = req.params.id || req.params.productId;

  if (!isValidObjectId(id)) {
    res.status(400); // 400 = Bad Request
    throw new Error(`Invalid ObjectId: ${id}`);
  }

  return next();
}

export default checkId;

// ------------- Checked --------------------