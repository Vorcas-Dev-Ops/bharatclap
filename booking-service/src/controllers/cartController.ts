import { Request, Response } from 'express';
import { Cart } from '../models/Cart';
import { AuthRequest } from '../middleware/authMiddleware';
import mongoose from 'mongoose';
import { getCatalogBatch } from '../utils/internalApi';
import axios from 'axios';

const PROVIDER_SERVICE_URL = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
const CATALOG_SERVICE_URL  = process.env.CATALOG_SERVICE_URL  || 'http://127.0.0.1:5002';

// Calls provider-service availability check (which already has direct access to its own DB)
const checkProviderAvailability = async (
  subservice_id: string,
  location_id?: string,
  location_name?: string
): Promise<boolean> => {
  try {
    const response = await axios.get(`${PROVIDER_SERVICE_URL}/api/providers/check-availability`, {
      params: { subservice_id, location_id, location_name }
    });
    return response.data?.available === true;
  } catch (err: any) {
    // If provider-service is down or returns error, fail open to avoid blocking users
    console.warn('[CART] Availability check failed, defaulting to available:', err.message);
    return true;
  }
};

// Populate cart items with subservice data via catalog-service
const populateCartItems = async (cart: any) => {
  if (!cart) return null;

  const subserviceIds = cart.items
    .map((item: any) => item.subservice_id?.toString())
    .filter(Boolean);

  const cartObj = cart.toObject ? cart.toObject() : { ...cart };

  if (subserviceIds.length === 0) return cartObj;

  const catalogData   = await getCatalogBatch(subserviceIds, [], [], []);
  const subserviceMap = new Map(catalogData.subservices.map((s: any) => [String(s._id), s]));

  cartObj.items = cartObj.items.map((item: any) => ({
    ...item,
    subservice_id: subserviceMap.get(String(item.subservice_id)) || { _id: item.subservice_id, subservice_name: '—' }
  }));

  return cartObj;
};

// Helper to get subservice price from catalog-service
const getSubServicePrice = async (subservice_id: string): Promise<any | null> => {
  try {
    const response = await axios.get(`${CATALOG_SERVICE_URL}/api/sub-services/${subservice_id}`);
    return response.data;
  } catch {
    return null;
  }
};

// @desc    Get current user's cart
// @route   GET /api/cart
// @access  Private
export const getCart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let cart = await Cart.findOne({ user_id: new mongoose.Types.ObjectId(req.user?._id) });

    if (!cart) {
      cart = await Cart.create({ user_id: new mongoose.Types.ObjectId(req.user?._id), items: [], total_amount: 0 });
    }

    const populated = await populateCartItems(cart);
    res.json(populated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add item to cart or update quantity
// @route   POST /api/cart/add
// @access  Private
export const addToCart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { subservice_id, quantity = 1, selected_date, selected_time_slot, package_name } = req.body;

    const subService = await getSubServicePrice(subservice_id);

    if (!subService) {
      res.status(404).json({ message: 'Sub-service not found' });
      return;
    }

    let priceSnapshot = subService.base_price || 0;
    if (subService.hasPackages) {
      const pkg = package_name 
        ? subService.packages?.find((p: any) => p.name === package_name)
        : subService.packages?.[0];
      if (pkg) {
        priceSnapshot = pkg.base_price;
      }
    }

    const realSubserviceObjectId = new mongoose.Types.ObjectId(subService._id);

    let cart = await Cart.findOne({ user_id: new mongoose.Types.ObjectId(req.user?._id) });

    if (!cart) {
      cart = new Cart({
        user_id: new mongoose.Types.ObjectId(req.user?._id),
        items: [{
          subservice_id:    realSubserviceObjectId,
          quantity,
          price_snapshot:   priceSnapshot,
          selected_date:    selected_date || null,
          selected_time_slot: selected_time_slot || null,
          package_name:     package_name || null,
          added_at:         new Date(),
        }],
      });
    } else {
      const itemIndex = cart.items.findIndex(
        (item) => item.subservice_id.toString() === realSubserviceObjectId.toString() && item.package_name === (package_name || undefined)
      );

      if (itemIndex > -1) {
        cart.items[itemIndex].quantity       += quantity;
        cart.items[itemIndex].price_snapshot  = priceSnapshot;
        if (selected_date)      (cart.items[itemIndex] as any).selected_date      = selected_date;
        if (selected_time_slot) (cart.items[itemIndex] as any).selected_time_slot = selected_time_slot;
      } else {
        cart.items.push({
          subservice_id:    realSubserviceObjectId,
          quantity,
          price_snapshot:   priceSnapshot,
          selected_date:    selected_date || null,
          selected_time_slot: selected_time_slot || null,
          package_name:     package_name || null,
          added_at:         new Date(),
        } as any);
      }
    }

    await cart.save();
    const populated = await populateCartItems(cart);
    res.status(200).json(populated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update item quantity in cart
// @route   PUT /api/cart/update
// @access  Private
export const updateCartItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { subservice_id, quantity } = req.body;

    const cart = await Cart.findOne({ user_id: new mongoose.Types.ObjectId(req.user?._id) });
    if (!cart) {
      res.status(404).json({ message: 'Cart not found' });
      return;
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.subservice_id.toString() === subservice_id
    );

    if (itemIndex === -1) {
      res.status(404).json({ message: 'Item not found in cart' });
      return;
    }

    if (quantity <= 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      cart.items[itemIndex].quantity = quantity;
      const subService = await getSubServicePrice(subservice_id);
      if (subService) {
        let priceSnapshot = subService.base_price || 0;
        if (subService.hasPackages) {
          const pkgName = cart.items[itemIndex].package_name;
          const pkg = pkgName 
            ? subService.packages?.find((p: any) => p.name === pkgName)
            : subService.packages?.[0];
          if (pkg) {
            priceSnapshot = pkg.base_price;
          }
        }
        cart.items[itemIndex].price_snapshot = priceSnapshot;
      }
    }

    await cart.save();
    const populated = await populateCartItems(cart);
    res.json(populated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Remove item from cart
// @route   DELETE /api/cart/item/:id
// @access  Private
export const removeFromCart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cart = await Cart.findOne({ user_id: new mongoose.Types.ObjectId(req.user?._id) });
    if (!cart) {
      res.status(404).json({ message: 'Cart not found' });
      return;
    }

    cart.items = cart.items.filter(
      (item) => item.subservice_id.toString() !== req.params.id
    );

    await cart.save();
    const populated = await populateCartItems(cart);
    res.json(populated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Clear cart
// @route   DELETE /api/cart
// @access  Private
export const clearCart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cart = await Cart.findOne({ user_id: new mongoose.Types.ObjectId(req.user?._id) });
    if (cart) {
      cart.items        = [];
      cart.total_amount = 0;
      await cart.save();
    }
    res.json({ message: 'Cart cleared' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update the scheduled date & time slot for a cart item
// @route   PUT /api/cart/slot
// @access  Private
export const updateSlot = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { subservice_id, selected_date, selected_time_slot } = req.body;

    if (!subservice_id || !selected_date || !selected_time_slot) {
      res.status(400).json({ message: 'subservice_id, selected_date and selected_time_slot are required' });
      return;
    }

    const cart = await Cart.findOne({ user_id: new mongoose.Types.ObjectId(req.user?._id) });
    if (!cart) {
      res.status(404).json({ message: 'Cart not found' });
      return;
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.subservice_id.toString() === subservice_id
    );

    if (itemIndex === -1) {
      res.status(404).json({ message: 'Item not found in cart' });
      return;
    }

    (cart.items[itemIndex] as any).selected_date      = selected_date;
    (cart.items[itemIndex] as any).selected_time_slot = selected_time_slot;

    await cart.save();
    const populated = await populateCartItems(cart);
    res.json(populated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get cart for internal service validation (Internal API)
// @route   GET /api/cart/internal/user-cart/:userId
// @access  Internal
export const getUserCartInternal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const cart = await Cart.findOne({ user_id: new mongoose.Types.ObjectId(userId) }).lean();
    if (!cart || !cart.items || cart.items.length === 0) {
      res.status(404).json({ message: 'Cart is empty or not found' });
      return;
    }
    res.json(cart);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update top-level cart scheduling preferences
// @route   PUT /api/cart/scheduling
// @access  Private
export const updateCartScheduling = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { preferred_date, preferred_start_time, scheduling_mode } = req.body;

    const cart = await Cart.findOne({ user_id: new mongoose.Types.ObjectId(req.user?._id) });
    if (!cart) {
      res.status(404).json({ message: 'Cart not found' });
      return;
    }

    if (preferred_date !== undefined) cart.preferred_date = preferred_date;
    if (preferred_start_time !== undefined) cart.preferred_start_time = preferred_start_time;
    if (scheduling_mode !== undefined && ['sequential', 'custom'].includes(scheduling_mode)) {
      cart.scheduling_mode = scheduling_mode;
    }

    await cart.save();
    const populated = await populateCartItems(cart);
    res.json(populated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

