import { Response } from 'express';
import { Cart } from '../models/Cart';
import { AuthRequest } from '../middleware/authMiddleware';
import mongoose, { Schema } from 'mongoose';

// Lazy loading catalog DB
let catalogConnection: mongoose.Connection | null = null;
let SubServiceModel: any = null;

const getSubServiceModel = () => {
  if (!SubServiceModel) {
    const catalogDbURI = process.env.CATALOG_DB_URI || 'mongodb://localhost:27017/catalog_db';
    catalogConnection = mongoose.createConnection(catalogDbURI);
    const subserviceSchema = new Schema({
      base_price: { type: Number, required: true },
      subservice_name: { type: String, required: true }
    }, { strict: false });
    SubServiceModel = catalogConnection.model('SubService', subserviceSchema, 'subservices');
  }
  return SubServiceModel;
};

let providerConnection: mongoose.Connection | null = null;
let authConnection: mongoose.Connection | null = null;
let ProviderModel: any = null;
let ProviderServiceModel: any = null;
let LocationModel: any = null;
let AddressModel: any = null;

const getAuthConnection = () => {
  if (!authConnection) {
    const authDbURI = process.env.AUTH_DB_URI || 'mongodb://localhost:27017/auth_db';
    authConnection = mongoose.createConnection(authDbURI);
  }
  return authConnection;
};

const getLocationModel = () => {
  if (!LocationModel) {
    const conn = getAuthConnection();
    LocationModel = conn.model('Location', new Schema({}, { strict: false }), 'locations');
  }
  return LocationModel;
};

const getAddressModel = () => {
  if (!AddressModel) {
    const conn = getAuthConnection();
    AddressModel = conn.model('Address', new Schema({}, { strict: false }), 'addresses');
  }
  return AddressModel;
};

const getProviderConnection = () => {
  if (!providerConnection) {
    const providerDbURI = process.env.PROVIDER_DB_URI || 'mongodb://localhost:27017/provider_db';
    providerConnection = mongoose.createConnection(providerDbURI);
  }
  return providerConnection;
};

const getProviderServiceModel = () => {
  if (!ProviderServiceModel) {
    const conn = getProviderConnection();
    ProviderServiceModel = conn.model('ProviderService', new Schema({}, { strict: false }), 'providerservices');
  }
  return ProviderServiceModel;
};

const getProviderModel = () => {
  if (!ProviderModel) {
    const conn = getProviderConnection();
    ProviderModel = conn.model('Provider', new Schema({}, { strict: false }), 'providers');
  }
  return ProviderModel;
};

const checkProviderAvailability = async (subservice_id: string, location_id?: string, location_name?: string): Promise<boolean> => {
  const PSModel = getProviderServiceModel();
  const providerServices = await PSModel.find({
    subservice_ids: new mongoose.Types.ObjectId(subservice_id),
    is_active: true,
    isDeleted: false
  }).lean();

  const providerIds = providerServices.map((ps: any) => ps.provider_id);
  if (providerIds.length === 0) return false;

  let coordinates: [number, number] | null = null;
  let cityLocationId: mongoose.Types.ObjectId | null = null;
  let locationText = location_name;

  const AModel = getAddressModel();
  const LModel = getLocationModel();

  if (location_id && location_id !== 'custom' && mongoose.Types.ObjectId.isValid(location_id)) {
    const address = await AModel.findById(location_id).lean() as any;
    if (address) {
      if (address.coordinates && address.coordinates.coordinates) {
        coordinates = address.coordinates.coordinates;
      }
      if (address.city) locationText = address.city;
    } else {
      const loc = await LModel.findById(location_id).lean() as any;
      if (loc) {
        cityLocationId = loc._id;
        locationText = loc.name;
        if (loc.coordinates && loc.coordinates.coordinates) {
          coordinates = loc.coordinates.coordinates;
        }
      }
    }
  }

  if (!cityLocationId && locationText) {
    const loc = await LModel.findOne({ name: new RegExp('^' + locationText + '$', 'i'), type: 'city' }).lean() as any;
    if (loc) cityLocationId = loc._id;
  }

  const PModel = getProviderModel();
  
  let query: any = {
    _id: { $in: providerIds },
    is_verified: true,
    isDeleted: false,
    kyc_status: 'verified'
  };

  if (coordinates) {
    const candidates = await PModel.find({
      ...query,
      live_location: {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates },
          $maxDistance: 30000 
        }
      }
    }).lean();
    if (candidates.length > 0) return true;
  }

  if (cityLocationId) {
    const candidates = await PModel.find({
      ...query,
      service_locations: cityLocationId
    }).lean();
    if (candidates.length > 0) return true;
  }

  // If no location info was provided but we have providers, we could technically allow it, 
  // but based on requirements we must verify location matching.
  // If we couldn't match coordinates or city, and yet providers exist, return false to be safe.
  return false;
};

const populateCartItems = async (cart: any) => {
  if (!cart) return null;
  const subserviceIds = cart.items.map((item: any) => item.subservice_id).filter(Boolean);
  
  const SModel = getSubServiceModel();
  const subservices = await SModel.find({ _id: { $in: subserviceIds } }).lean();
  const subserviceMap = new Map(subservices.map((s: any) => [String(s._id), s]));

  const cartObj = cart.toObject ? cart.toObject() : cart;
  cartObj.items = cartObj.items.map((item: any) => ({
    ...item,
    subservice_id: subserviceMap.get(String(item.subservice_id)) || { _id: item.subservice_id, subservice_name: '—' }
  }));
  return cartObj;
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
    const { subservice_id, quantity = 1, location_id, location_name, selected_date, selected_time_slot } = req.body;

    const SModel = getSubServiceModel();
    const subService = await SModel.findById(subservice_id);
    if (!subService) {
      res.status(404).json({ message: 'Sub-service not found' });
      return;
    }

    const isAvailable = await checkProviderAvailability(subservice_id, location_id, location_name);
    if (!isAvailable) {
      res.status(400).json({ 
        error: 'NO_PROVIDER_AVAILABLE', 
        message: 'No verified providers are available for this service in your selected location.' 
      });
      return;
    }

    let cart = await Cart.findOne({ user_id: new mongoose.Types.ObjectId(req.user?._id) });

    if (!cart) {
      cart = new Cart({
        user_id: new mongoose.Types.ObjectId(req.user?._id),
        items: [
          {
            subservice_id: new mongoose.Types.ObjectId(subservice_id as string),
            quantity,
            price_snapshot: subService.base_price,
            selected_date: selected_date || null,
            selected_time_slot: selected_time_slot || null,
            added_at: new Date(),
          },
        ],
      });
    } else {
      const itemIndex = cart.items.findIndex(
        (item) => item.subservice_id.toString() === subservice_id
      );

      if (itemIndex > -1) {
        cart.items[itemIndex].quantity += quantity;
        cart.items[itemIndex].price_snapshot = subService.base_price;
        if (selected_date)      (cart.items[itemIndex] as any).selected_date      = selected_date;
        if (selected_time_slot) (cart.items[itemIndex] as any).selected_time_slot = selected_time_slot;
      } else {
        cart.items.push({
          subservice_id: new mongoose.Types.ObjectId(subservice_id as string),
          quantity,
          price_snapshot: subService.base_price,
          selected_date: selected_date || null,
          selected_time_slot: selected_time_slot || null,
          added_at: new Date(),
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
      
      const SModel = getSubServiceModel();
      const subService = await SModel.findById(subservice_id);
      if (subService) {
        cart.items[itemIndex].price_snapshot = subService.base_price;
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
      cart.items = [];
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
