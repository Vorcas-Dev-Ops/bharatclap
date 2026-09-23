import { Request, Response } from 'express';
import { CartRepository } from '../repositories/cartRepository';
import { AuthRequest } from '../middleware/authMiddleware';
import { getCatalogBatch } from '../utils/internalApi';
import axios from 'axios';

const PROVIDER_SERVICE_URL = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
const CATALOG_SERVICE_URL  = process.env.CATALOG_SERVICE_URL  || 'http://127.0.0.1:5002';

// Populate cart items with subservice data via catalog-service
const populateCartItems = async (cart: any) => {
  if (!cart) return null;

  const subserviceIds = (cart.items || [])
    .map((item: any) => item.subservice_id?.toString())
    .filter(Boolean);

  const cartObj = { ...cart };

  if (subserviceIds.length === 0) return cartObj;

  const catalogData   = await getCatalogBatch(subserviceIds, [], [], []);
  const subserviceMap = new Map((catalogData.subservices || []).map((s: any) => [String(s.id || s._id), s]));

  cartObj.items = cartObj.items.map((item: any) => ({
    ...item,
    subservice_id: subserviceMap.get(String(item.subservice_id)) || { _id: item.subservice_id, id: item.subservice_id, subservice_name: '—' }
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
    const userId = req.user!._id;
    let cart = await CartRepository.findByUserId(userId);

    if (!cart) {
      cart = await CartRepository.createOrUpdate(userId, [], 0);
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
    const userId = req.user!._id;
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

    const realSubserviceId = String(subService.id || subService._id);

    let cart = await CartRepository.findByUserId(userId);
    let items = cart ? [...(cart.items || [])] : [];

    const itemIndex = items.findIndex(
      (item) => String(item.subservice_id) === realSubserviceId && item.package_name === (package_name || undefined)
    );

    if (itemIndex > -1) {
      items[itemIndex].quantity       += quantity;
      items[itemIndex].price_snapshot  = priceSnapshot;
      if (selected_date)      items[itemIndex].selected_date      = selected_date;
      if (selected_time_slot) items[itemIndex].selected_time_slot = selected_time_slot;
    } else {
      items.push({
        subservice_id:    realSubserviceId,
        quantity,
        price_snapshot:   priceSnapshot,
        selected_date:    selected_date || null,
        selected_time_slot: selected_time_slot || null,
        package_name:     package_name || null,
        added_at:         new Date(),
      });
    }

    cart = await CartRepository.createOrUpdate(userId, items);
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
    const userId = req.user!._id;
    const { subservice_id, quantity } = req.body;

    const cart = await CartRepository.findByUserId(userId);
    if (!cart) {
      res.status(404).json({ message: 'Cart not found' });
      return;
    }

    let items = [...(cart.items || [])];
    const itemIndex = items.findIndex(
      (item) => String(item.subservice_id) === String(subservice_id)
    );

    if (itemIndex === -1) {
      res.status(404).json({ message: 'Item not found in cart' });
      return;
    }

    if (quantity <= 0) {
      items.splice(itemIndex, 1);
    } else {
      items[itemIndex].quantity = quantity;
      const subService = await getSubServicePrice(subservice_id);
      if (subService) {
        let priceSnapshot = subService.base_price || 0;
        if (subService.hasPackages) {
          const pkgName = items[itemIndex].package_name;
          const pkg = pkgName 
            ? subService.packages?.find((p: any) => p.name === pkgName)
            : subService.packages?.[0];
          if (pkg) {
            priceSnapshot = pkg.base_price;
          }
        }
        items[itemIndex].price_snapshot = priceSnapshot;
      }
    }

    const updated = await CartRepository.createOrUpdate(userId, items);
    const populated = await populateCartItems(updated);
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
    const userId = req.user!._id;
    const cart = await CartRepository.findByUserId(userId);
    if (!cart) {
      res.status(404).json({ message: 'Cart not found' });
      return;
    }

    const items = (cart.items || []).filter(
      (item) => String(item.subservice_id) !== String(req.params.id)
    );

    const updated = await CartRepository.createOrUpdate(userId, items);
    const populated = await populateCartItems(updated);
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
    const userId = req.user!._id;
    await CartRepository.clearCart(userId);
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
    const userId = req.user!._id;
    const { subservice_id, selected_date, selected_time_slot } = req.body;

    if (!subservice_id || !selected_date || !selected_time_slot) {
      res.status(400).json({ message: 'subservice_id, selected_date and selected_time_slot are required' });
      return;
    }

    const cart = await CartRepository.findByUserId(userId);
    if (!cart) {
      res.status(404).json({ message: 'Cart not found' });
      return;
    }

    let items = [...(cart.items || [])];
    const itemIndex = items.findIndex(
      (item) => String(item.subservice_id) === String(subservice_id)
    );

    if (itemIndex === -1) {
      res.status(404).json({ message: 'Item not found in cart' });
      return;
    }

    items[itemIndex].selected_date      = selected_date;
    items[itemIndex].selected_time_slot = selected_time_slot;

    const updated = await CartRepository.createOrUpdate(userId, items);
    const populated = await populateCartItems(updated);
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
    const cart = await CartRepository.findByUserId(userId);
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
    const userId = req.user!._id;
    const { preferred_date, preferred_start_time, scheduling_mode } = req.body;

    const cart = await CartRepository.findByUserId(userId);
    if (!cart) {
      res.status(404).json({ message: 'Cart not found' });
      return;
    }

    const updated = await CartRepository.createOrUpdate(userId, cart.items);
    const populated = await populateCartItems(updated);
    res.json(populated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
